import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EQ_PRESETS } from '../types.js';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon } from './Icons.js';
import { CORS_PROXY_URL } from '../constants.js';
import InteractiveText from './InteractiveText.js';
import MarqueeText from './MarqueeText.js';

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
  marqueeDelay,
  isMarqueeProgramEnabled,
  isMarqueeCurrentTrackEnabled,
  isMarqueeNextTrackEnabled,
  marqueeSpeed,
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
  const [startAnimation, setStartAnimation] = useState(false);
  
  // Refs for marquee synchronization
  const stationNameRef = useRef(null);
  const currentTrackRef = useRef(null);
  const nextTrackRef = useRef(null);
  const [marqueeConfig, setMarqueeConfig] = useState({ duration: 0, isOverflowing: [false, false, false] });


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
            React.createElement("div", { className: "min-w-0", key: station.stationuuid },
               React.createElement(MarqueeText, {
                  loopDelay: marqueeDelay,
                  duration: marqueeConfig.duration,
                  startAnimation: startAnimation,
                  isOverflowing: marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled,
                  contentRef: stationNameRef,
                  className: "font-bold text-text-primary"
              },
                  React.createElement("span", null, `${station.name}${trackInfo?.program ? ` | ${trackInfo.program}` : ''}`)
              ),

              React.createElement("div", { className: "text-sm text-text-secondary leading-tight h-[1.25rem] flex items-center" },
                error ? (
                  React.createElement("span", { className: "text-red-400" }, error)
                ) : trackInfo?.current ? (
                  React.createElement(MarqueeText, {
                      loopDelay: marqueeDelay,
                      duration: marqueeConfig.duration,
                      startAnimation: startAnimation,
                      isOverflowing: marqueeConfig.isOverflowing[1] && isMarqueeCurrentTrackEnabled,
                      contentRef: currentTrackRef
                  },
                      React.createElement(InteractiveText, { text: trackInfo.current })
                  )
                ) : null
              ),
               !error && showNextSong && trackInfo?.next && (
                  React.createElement("div", { className: "text-xs opacity-80 h-[1.125rem] flex items-center" },
                    React.createElement("span", { className: "font-semibold flex-shrink-0" }, "הבא:\u00A0"),
                    React.createElement(MarqueeText, { 
                        loopDelay: marqueeDelay, 
                        duration: marqueeConfig.duration,
                        startAnimation: startAnimation,
                        isOverflowing: marqueeConfig.isOverflowing[2] && isMarqueeNextTrackEnabled,
                        contentRef: nextTrackRef
                    },
                      React.createElement("span", null, trackInfo.next)
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