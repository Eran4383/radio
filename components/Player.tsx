import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Station, EqPreset, EQ_PRESETS, CustomEqSettings, StationTrackInfo } from '../types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon } from './Icons';
import { CORS_PROXY_URL } from '../constants';
import InteractiveText from './InteractiveText';
import MarqueeText from './MarqueeText';

interface PlayerProps {
  station: Station | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  eqPreset: EqPreset;
  customEqSettings: CustomEqSettings;
  volume: number;
  onVolumeChange: (volume: number) => void;
  trackInfo: StationTrackInfo | null;
  showNextSong: boolean;
  onOpenNowPlaying: () => void;
  setFrequencyData: (data: Uint8Array) => void;
  onStreamStatusChange: (isActive: boolean) => void;
  frequencyData: Uint8Array;
  isVisualizerEnabled: boolean;
  marqueeDelay: number;
  isMarqueeProgramEnabled: boolean;
  isMarqueeCurrentTrackEnabled: boolean;
  isMarqueeNextTrackEnabled: boolean;
  marqueeSpeed: number;
}

const PlayerVisualizer: React.FC<{ frequencyData: Uint8Array }> = ({ frequencyData }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const { width, height } = canvas;
        context.clearRect(0, 0, width, height);

        const computedStyle = getComputedStyle(document.documentElement);
        const accentColor = computedStyle.getPropertyValue('--accent').trim() || '#14b8a6';
        
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, `${accentColor}40`);
        context.fillStyle = gradient;

        const bufferLength = frequencyData.length;
        const halfBuffer = Math.floor(bufferLength / 2);
        const centerX = width / 2;
        const barWidth = (width / 2) / halfBuffer;

        for (let i = 0; i < halfBuffer; i++) {
            const barHeight = (frequencyData[i] / 255) * height;
            // Draw right side
            context.fillRect(centerX + (i * barWidth), height - barHeight, barWidth - 1, barHeight);
            // Draw left side (mirrored)
            context.fillRect(centerX - ((i + 1) * barWidth), height - barHeight, barWidth - 1, barHeight);
        }
    }, [frequencyData]);

    return <canvas ref={canvasRef} width="300" height="4" className="absolute top-0 left-0 right-0 w-full h-1" />;
};


const Player: React.FC<PlayerProps> = ({
  station,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  eqPreset,
  customEqSettings,
  volume,
  onVolumeChange,
  trackInfo,
  showNextSong,
  onOpenNowPlaying,
  setFrequencyData,
  onStreamStatusChange,
  frequencyData,
  isVisualizerEnabled,
  marqueeDelay,
  isMarqueeProgramEnabled,
  isMarqueeCurrentTrackEnabled,
  isMarqueeNextTrackEnabled,
  marqueeSpeed,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const animationFrameRef = useRef<number>();

  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startAnimation, setStartAnimation] = useState(false);
  
  // Refs for marquee synchronization
  const stationNameRef = useRef<HTMLSpanElement>(null);
  const currentTrackRef = useRef<HTMLSpanElement>(null);
  const nextTrackRef = useRef<HTMLSpanElement>(null);
  const [marqueeConfig, setMarqueeConfig] = useState<{ duration: number; isOverflowing: boolean[] }>({ duration: 0, isOverflowing: [false, false, false] });


  // Effect for initial animation delay
  useEffect(() => {
    setStartAnimation(false);
    const timer = setTimeout(() => {
        setStartAnimation(true);
    }, 3000); // 3-second initial delay

    return () => clearTimeout(timer);
  }, [station?.stationuuid]);
  
  // Effect for marquee synchronization
  useEffect(() => {
      const calculateMarquee = () => {
          const refs = [stationNameRef, currentTrackRef, nextTrackRef];
          let maxContentWidth = 0;
          const newIsOverflowing = refs.map(ref => {
              const content = ref.current;
              if (!content) return false;
              
              const container = content.closest('.marquee-wrapper, .truncate');
              
              if (container && content.scrollWidth > container.clientWidth) {
                  maxContentWidth = Math.max(maxContentWidth, content.scrollWidth);
                  return true;
              }
              return false;
          });

          const anyOverflowing = newIsOverflowing.some(Boolean);
          // New exponential scale for speed (1-10). Gives finer control over slower speeds.
          const pixelsPerSecond = 3.668 * Math.pow(1.363, marqueeSpeed);
          const newDuration = anyOverflowing ? Math.max(5, maxContentWidth / pixelsPerSecond) : 0;
          
          setMarqueeConfig({ duration: newDuration, isOverflowing: newIsOverflowing });
      };

      const timeoutId = setTimeout(calculateMarquee, 50);

      return () => clearTimeout(timeoutId);
  }, [station, trackInfo, showNextSong, marqueeSpeed]);

  // Report stream status changes to parent
  useEffect(() => {
    onStreamStatusChange(isActuallyPlaying);
  }, [isActuallyPlaying, onStreamStatusChange]);


  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;
      
      const source = context.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      const analyser = context.createAnalyser();
      analyser.fftSize = 128; // for 64 frequency bins
      analyserRef.current = analyser;

      const bassFilter = context.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 250;
      bassFilterRef.current = bassFilter;
      
      const midFilter = context.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1;
      midFilterRef.current = midFilter;
      
      const trebleFilter = context.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;
      trebleFilterRef.current = trebleFilter;

      source
        .connect(bassFilter)
        .connect(midFilter)
        .connect(trebleFilter)
        .connect(analyser)
        .connect(context.destination);
    } catch (e) {
      console.error("Failed to initialize AudioContext", e);
    }
  }, []);
  
  // Start/Stop playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const