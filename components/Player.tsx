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
    
    const playAudio = async () => {
      if (station && isPlaying) {
        setupAudioContext(); // Ensure context is setup before playing
        if(audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        const newSrc = `${CORS_PROXY_URL}${station.url_resolved}`;
        if (audio.src !== newSrc) {
            audio.src = newSrc;
            audio.crossOrigin = 'anonymous';
            audio.load(); // Explicitly tell the browser to load the new source
        }
        try {
          await audio.play();
          setError(null);
        } catch (e: any) {
          console.error("Error playing audio:", e);
          if (e.name !== 'AbortError') {
            setError("לא ניתן לנגן את התחנה.");
            setIsActuallyPlaying(false);
          }
        }
      } else {
        audio.pause();
      }
    };
    
    playAudio();

  }, [station, isPlaying, setupAudioContext]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
  // Apply EQ settings
  useEffect(() => {
    if (!bassFilterRef.current || !midFilterRef.current || !trebleFilterRef.current) return;
    
    const settings = eqPreset === 'custom' 
      ? customEqSettings 
      : EQ_PRESETS[eqPreset as Exclude<EqPreset, 'custom'>];

    if (settings) {
      bassFilterRef.current.gain.value = settings.bass;
      midFilterRef.current.gain.value = settings.mid;
      trebleFilterRef.current.gain.value = settings.treble;
    }
  }, [eqPreset, customEqSettings]);

  // Visualizer data loop
  useEffect(() => {
    const loop = () => {
      if (analyserRef.current && isActuallyPlaying) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isActuallyPlaying) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActuallyPlaying, setFrequencyData]);

  // Update Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (station) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${station.name}${trackInfo?.program ? ` | ${trackInfo.program}` : ''}`,
          artist: trackInfo?.current || 'רדיו פרימיום',
          artwork: [{ src: station.favicon, sizes: '96x96', type: 'image/png' }],
        });
        
        // Wrap handlers in an async function to prevent the media notification from
        // closing immediately on mobile when an action is performed.
        const createDelayedHandler = (handler: () => void) => {
            return async () => {
                try {
                    handler();
                    // This short delay gives the app time to process the state change
                    // and begin playback of the new stream before the handler promise resolves.
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (e) {
                    console.error('Media session action failed:', e);
                }
            };
        };

        navigator.mediaSession.setActionHandler('play', createDelayedHandler(onPlayPause));
        navigator.mediaSession.setActionHandler('pause', createDelayedHandler(onPlayPause));
        navigator.mediaSession.setActionHandler('nexttrack', createDelayedHandler(onNext));
        navigator.mediaSession.setActionHandler('previoustrack', createDelayedHandler(onPrev));

        if (isPlaying) {
            navigator.mediaSession.playbackState = 'playing';
        } else {
            navigator.mediaSession.playbackState = 'paused';
        }
      } else {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    }
  }, [station, isPlaying, trackInfo, onPlayPause, onNext, onPrev]);

  const handlePlaying = () => {
    setIsActuallyPlaying(true);
    setError(null);
  };
  
  const handlePause = () => {
    setIsActuallyPlaying(false);
  }

  const handleWaiting = () => {
    setIsActuallyPlaying(false);
  };

  const handleError = () => {
    setError("שגיאה בניגון התחנה.");
    setIsActuallyPlaying(false);
  };
  
  if (!station) {
    return null; // Don't render the player if no station is selected
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="relative bg-bg-secondary/80 backdrop-blur-lg shadow-t-lg">
        {isVisualizerEnabled && isPlaying && <PlayerVisualizer frequencyData={frequencyData} />}
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-4">
          
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onClick={onOpenNowPlaying}
            role="button"
            aria-label="פתח מסך ניגון"
          >
            <img 
              src={station.favicon} 
              alt={station.name} 
              className="w-14 h-14 rounded-md bg-gray-700 object-contain flex-shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/48'; }}
            />
            <div className="min-w-0" key={station.stationuuid}>
               <MarqueeText
                  loopDelay={marqueeDelay}
                  duration={marqueeConfig.duration}
                  startAnimation={startAnimation}
                  isOverflowing={marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled}
                  contentRef={stationNameRef}
                  className="font-bold text-text-primary"
              >
                  <span>{station.name}{trackInfo?.program && ` | ${trackInfo.program}`}</span>
              </MarqueeText>

              <div className="text-sm text-text-secondary leading-tight h-[1.25rem] flex items-center">
                {error ? (
                  <span className="text-red-400">{error}</span>
                ) : trackInfo?.current ? (
                  <MarqueeText
                      loopDelay={marqueeDelay}
                      duration={marqueeConfig.duration}
                      startAnimation={startAnimation}
                      isOverflowing={marqueeConfig.isOverflowing[1] && isMarqueeCurrentTrackEnabled}
                      contentRef={currentTrackRef}
                  >
                      <InteractiveText text={trackInfo.current} />
                  </MarqueeText>
                ) : null}
              </div>
               {!error && showNextSong && trackInfo?.next && (
                  <div className="text-xs opacity-80 h-[1.125rem] flex items-center">
                    <span className="font-semibold flex-shrink-0">הבא:&nbsp;</span>
                    <MarqueeText 
                        loopDelay={marqueeDelay} 
                        duration={marqueeConfig.duration}
                        startAnimation={startAnimation}
                        isOverflowing={marqueeConfig.isOverflowing[2] && isMarqueeNextTrackEnabled}
                        contentRef={nextTrackRef}
                    >
                      <span>{trackInfo.next}</span>
                    </MarqueeText>
                  </div>
                )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
             <button onClick={onPrev} className="p-2 text-text-secondary hover:text-text-primary" aria-label="הקודם">
                <SkipNextIcon className="w-6 h-6" />
            </button>
            <button 
              onClick={onPlayPause} 
              className="p-3 bg-accent text-white rounded-full shadow-md"
              aria-label={isPlaying ? "השהה" : "נגן"}
            >
              {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
            </button>
            <button onClick={onNext} className="p-2 text-text-secondary hover:text-text-primary" aria-label="הבא">
                <SkipPreviousIcon className="w-6 h-6" />
            </button>
          </div>

          <audio 
            ref={audioRef}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onWaiting={handleWaiting}
            onError={handleError}
            crossOrigin="anonymous"
          />
        </div>
      </div>
    </div>
  );
};

export default Player;