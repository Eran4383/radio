import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EQ_PRESETS } from '../types.js';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon } from './Icons.js';
import { CORS_PROXY_URL } from '../constants.js';

const PlayerVisualizer = ({ frequencyData }) => {
    const canvasRef = useRef(null);

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

    return React.createElement("canvas", { ref: canvasRef, width: "300", height: "4", className: "absolute top-0 left-0 right-0 w-full h-1" });
};


const Player = ({
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
}) => {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const bassFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const animationFrameRef = useRef();

  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [error, setError] = useState(null);
  
  // Report stream status changes to parent
  useEffect(() => {
    onStreamStatusChange(isActuallyPlaying);
  }, [isActuallyPlaying, onStreamStatusChange]);


  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
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
        } catch (e) {
          console.error("Error playing audio:", e);
          setError("לא ניתן לנגן את התחנה.");
          setIsActuallyPlaying(false);
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
      : EQ_PRESETS[eqPreset];

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
        const primaryInfo = [trackInfo?.program, trackInfo?.current].filter(Boolean).join(' | ');
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: primaryInfo || 'רדיו פרימיום',
          artwork: [{ src: station.favicon, sizes: '96x96', type: 'image/png' }],
        });

        navigator.mediaSession.setActionHandler('play', onPlayPause);
        navigator.mediaSession.setActionHandler('pause', onPlayPause);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
        navigator.mediaSession.setActionHandler('previoustrack', onPrev);

        if (isPlaying) {
            navigator.mediaSession.playbackState = 'playing';
        } else {
            navigator.mediaSession.playbackState = 'paused';
        }
      } else {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
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

  const defaultInfo = `${station.codec} @ ${station.bitrate}kbps`;
  const primaryInfo = [trackInfo?.program, trackInfo?.current].filter(Boolean).join(' | ');

  return (
    React.createElement("div", { className: "fixed bottom-0 left-0 right-0 z-30" },
      React.createElement("div", { className: "relative bg-bg-secondary/80 backdrop-blur-lg shadow-t-lg" },
        isVisualizerEnabled && isPlaying && React.createElement(PlayerVisualizer, { frequencyData: frequencyData }),
        React.createElement("div", { className: "max-w-7xl mx-auto p-4 flex items-center justify-between gap-4" },
          
          React.createElement("div", { 
            className: "flex items-center gap-3 flex-1 min-w-0 cursor-pointer",
            onClick: onOpenNowPlaying,
            role: "button",
            "aria-label": "פתח מסך ניגון"
          },
            React.createElement("img", { 
              src: station.favicon, 
              alt: station.name, 
              className: "w-14 h-14 rounded-md bg-gray-700 object-contain flex-shrink-0",
              onError: (e) => { e.currentTarget.src = 'https://picsum.photos/48'; }
            }),
            React.createElement("div", { className: "min-w-0" },
              React.createElement("h3", { className: "font-bold text-text-primary truncate" }, station.name),
              React.createElement("div", { className: "text-sm text-text-secondary leading-tight" },
                React.createElement("p", { className: "truncate" }, error || primaryInfo || defaultInfo),
                !error && showNextSong && trackInfo?.next && (
                  React.createElement("p", { className: "truncate text-xs opacity-80" },
                    React.createElement("span", { className: "font-semibold" }, "הבא:"), " ", trackInfo.next
                  )
                )
              )
            )
          ),
          
          React.createElement("div", { className: "flex items-center gap-1 sm:gap-2" },
             React.createElement("button", { onClick: onPrev, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הקודם" },
                React.createElement(SkipNextIcon, { className: "w-6 h-6" })
            ),
            React.createElement("button", { 
              onClick: onPlayPause, 
              className: "p-3 bg-accent text-white rounded-full shadow-md",
              "aria-label": isPlaying ? "השהה" : "נגן"
            },
              isPlaying ? React.createElement(PauseIcon, { className: "w-7 h-7" }) : React.createElement(PlayIcon, { className: "w-7 h-7" })
            ),
            React.createElement("button", { onClick: onNext, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הבא" },
                React.createElement(SkipPreviousIcon, { className: "w-6 h-6" })
            )
          ),

          React.createElement("audio", { 
            ref: audioRef,
            onPlaying: handlePlaying,
            onPause: handlePause,
            onWaiting: handleWaiting,
            onError: handleError,
            crossOrigin: "anonymous"
          })
        )
      )
    )
  );
};

export default Player;