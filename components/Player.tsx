
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Station, EqPreset, EQ_PRESETS, CustomEqSettings, StationTrackInfo, SmartPlaylistItem } from '../types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon } from './Icons';
import { CORS_PROXY_URL } from '../constants';
import InteractiveText from './InteractiveText';
import MarqueeText from './MarqueeText';
import { fetch100fmPlaylist } from '../services/radioService';

// Types from App.tsx's state machine
type PlayerStatus = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ERROR';
interface PlayerState {
  status: PlayerStatus;
  station: Station | null;
  error?: string;
}
type PlayerEvent =
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_PAUSED' }
  | { type: 'STREAM_ERROR'; payload: string }
  | { type: 'AUTOPLAY_BLOCKED' };


interface PlayerProps {
  playerState: PlayerState;
  onPlayPause: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPlayerEvent: (event: PlayerEvent) => void;
  eqPreset: EqPreset;
  customEqSettings: CustomEqSettings;
  volume: number;
  onVolumeChange: (volume: number) => void;
  trackInfo: StationTrackInfo | null;
  showNextSong: boolean;
  onOpenNowPlaying: () => void;
  setFrequencyData: (data: Uint8Array) => void;
  frequencyData: Uint8Array;
  isVisualizerEnabled: boolean;
  shouldUseProxy: boolean; // New prop to control direct/proxy mode
  marqueeDelay: number;
  isMarqueeProgramEnabled: boolean;
  isMarqueeCurrentTrackEnabled: boolean;
  isMarqueeNextTrackEnabled: boolean;
  marqueeSpeed: number;
  onOpenActionMenu: (songTitle: string) => void;
  is100fmSmartPlayerEnabled: boolean; // New prop for feature toggle
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
  playerState,
  onPlayPause,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onPlayerEvent,
  eqPreset,
  customEqSettings,
  volume,
  onVolumeChange,
  trackInfo,
  showNextSong,
  onOpenNowPlaying,
  setFrequencyData,
  frequencyData,
  isVisualizerEnabled,
  shouldUseProxy, // Destructure new prop
  marqueeDelay,
  isMarqueeProgramEnabled,
  isMarqueeCurrentTrackEnabled,
  isMarqueeNextTrackEnabled,
  marqueeSpeed,
  onOpenActionMenu,
  is100fmSmartPlayerEnabled
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Refs for stream recovery
  const lastTimeUpdateRef = useRef<number>(Date.now());
  const recoveryAttemptRef = useRef<number>(0);
  const watchdogIntervalRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isDirectFallback, setIsDirectFallback] = useState(false);

  const [startAnimation, setStartAnimation] = useState(false);
  
  // Refs for marquee synchronization
  const stationNameRef = useRef<HTMLSpanElement>(null);
  const currentTrackRef = useRef<HTMLSpanElement>(null);
  const nextTrackRef = useRef<HTMLSpanElement>(null);
  const [marqueeConfig, setMarqueeConfig] = useState<{ duration: number; isOverflowing: boolean[] }>({ duration: 0, isOverflowing: [false, false, false] });

  // --- Smart Player State ---
  const isSmartPlayerActive = is100fmSmartPlayerEnabled && (playerState.station?.stationuuid.startsWith('100fm-') || playerState.station?.url_resolved.includes('streamgates.net'));

  const { status, station, error } = playerState;
  const isPlaying = status === 'PLAYING';
  const isLoading = status === 'LOADING';

  // Effect for initial animation delay
  useEffect(() => {
    setStartAnimation(false);
    const timer = setTimeout(() => {
        setStartAnimation(true);
    }, 3000); // 3-second initial delay

    return () => clearTimeout(timer);
  }, [station?.stationuuid]);
  
  // Reset fallback state when station changes
  useEffect(() => {
      setIsDirectFallback(false);
      recoveryAttemptRef.current = 0;
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


  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextClass({});
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
  
  // Audio Element State Machine Driver
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    const playAudio = async () => {
        // If falling back to direct stream, bypass proxy and context setup
        const effectivelyUsingProxy = shouldUseProxy && !isDirectFallback;

        if (effectivelyUsingProxy) {
            setupAudioContext();
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }
        }
        
        let streamUrl = station.url_resolved;

        // Apply Proxy if needed
        if (effectivelyUsingProxy) {
            streamUrl = `${CORS_PROXY_URL}${streamUrl}`;
        }

        if (audio.src !== streamUrl) {
            audio.src = streamUrl;
            if (effectivelyUsingProxy) {
                audio.crossOrigin = 'anonymous';
            } else {
                audio.removeAttribute('crossOrigin');
            }
            audio.load();
        }

        try {
            playPromiseRef.current = audio.play();
            await playPromiseRef.current;
            playPromiseRef.current = null;
        } catch (e: any) {
            playPromiseRef.current = null;
            if (e.name === 'AbortError') {
                console.debug('Audio play request was interrupted (normal behavior).');
            } else if (e.name === 'NotAllowedError') {
                console.warn("Autoplay blocked by browser policy.");
                onPlayerEvent({ type: 'AUTOPLAY_BLOCKED' });
            } else {
                console.error("Error playing audio:", e);
                // If we failed with proxy, try fallback
                if (shouldUseProxy && !isDirectFallback) {
                    console.warn("Proxy failed, switching to direct stream...");
                    setIsDirectFallback(true);
                    // The effect will re-run because isDirectFallback changed state
                } else {
                    onPlayerEvent({ type: 'STREAM_ERROR', payload: "לא ניתן לנגן את התחנה." });
                }
            }
        }
    };

    if (status === 'LOADING') {
      playAudio();
    } else if (status === 'PAUSED' || status === 'IDLE' || status === 'ERROR') {
      // Safe pause
      if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
              audio.pause();
          }).catch(() => {});
      } else {
          audio.pause();
      }
    }
  }, [status, station, setupAudioContext, onPlayerEvent, shouldUseProxy, isSmartPlayerActive, isDirectFallback]);


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
      // Only get data if using proxy (AudioContext is valid) AND not in fallback mode
      if (analyserRef.current && isPlaying && shouldUseProxy && !isDirectFallback) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      } else if (isPlaying) {
          // Fallback: send zero data so visualizers flatten
          setFrequencyData(new Uint8Array(64));
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, setFrequencyData, shouldUseProxy, isDirectFallback]);

  // Update Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator && station) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${station.name}${trackInfo?.program ? ` | ${trackInfo.program}` : ''}`,
          artist: trackInfo?.current || 'רדיו פרימיום',
          artwork: [{ src: station.favicon, sizes: '96x96', type: 'image/png' }],
        });

        navigator.mediaSession.setActionHandler('play', onPlay);
        navigator.mediaSession.setActionHandler('pause', onPause);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
        navigator.mediaSession.setActionHandler('previoustrack', onPrev);
        
        if (status === 'PLAYING') {
            navigator.mediaSession.playbackState = 'playing';
        } else {
            navigator.mediaSession.playbackState = 'paused';
        }
    }
  }, [station, status, trackInfo, onPlay, onPause, onNext, onPrev]);

  // Automatic stream recovery logic
  const attemptRecovery = useCallback(() => {
      if (!audioRef.current || !station) return;
      
      // Debounce recovery: if we just tried, wait.
      if (Date.now() - lastTimeUpdateRef.current < 2000) return;

      if (recoveryAttemptRef.current >= 3) {
          // If proxy failed 3 times, switch to direct
          if (shouldUseProxy && !isDirectFallback) {
              console.warn("Max recovery attempts with proxy. Switching to direct.");
              setIsDirectFallback(true);
              recoveryAttemptRef.current = 0;
              return;
          }
          console.error("Recovery failed after 3 attempts.");
          onPlayerEvent({ type: 'STREAM_ERROR', payload: "החיבור נכשל סופית" });
          return;
      }

      console.warn(`Stream stalled. Attempting recovery #${recoveryAttemptRef.current + 1}...`);
      recoveryAttemptRef.current += 1;
      lastTimeUpdateRef.current = Date.now();

      const audio = audioRef.current;
      const effectivelyUsingProxy = shouldUseProxy && !isDirectFallback;
      
      const streamUrl = effectivelyUsingProxy 
          ? `${CORS_PROXY_URL}${station.url_resolved}` 
          : station.url_resolved;
          
      // Safe reload
      const reload = async () => {
          try {
              if (playPromiseRef.current) await playPromiseRef.current;
              audio.src = `${streamUrl}?retry=${Date.now()}`;
              audio.load();
              playPromiseRef.current = audio.play();
              await playPromiseRef.current;
              playPromiseRef.current = null;
          } catch(e) {
              console.error("Recovery failed", e);
          }
      };
      reload();

  }, [station, onPlayerEvent, shouldUseProxy, isDirectFallback]);

  // Watchdog effect to detect stalled stream
  useEffect(() => {
      const clearWatchdog = () => {
          if (watchdogIntervalRef.current) {
              clearInterval(watchdogIntervalRef.current);
              watchdogIntervalRef.current = null;
          }
      };

      if (status === 'PLAYING') {
          clearWatchdog();
          lastTimeUpdateRef.current = Date.now();
          recoveryAttemptRef.current = 0;

          watchdogIntervalRef.current = window.setInterval(() => {
              if (Date.now() - lastTimeUpdateRef.current > 8000) { // Relaxed to 8s
                  attemptRecovery();
              }
          }, 4000); 
      } else {
          clearWatchdog();
          recoveryAttemptRef.current = 0;
      }

      return clearWatchdog;
  }, [status, attemptRecovery]);


  if (!station) {
    return null; // Don't render the player if no station is selected
  }

  const isActuallyPlaying = status === 'PLAYING';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="relative bg-bg-secondary/80 backdrop-blur-lg shadow-t-lg">
        {isVisualizerEnabled && isActuallyPlaying && !isDirectFallback && <PlayerVisualizer frequencyData={frequencyData} />}
        <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-4">
          
          <div 
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <img 
              src={station.favicon} 
              alt={station.name} 
              className="w-14 h-14 rounded-md bg-gray-700 object-contain flex-shrink-0 cursor-pointer"
              onClick={onOpenNowPlaying}
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/48'; }}
            />
            <div className="min-w-0" key={station.stationuuid}>
               <MarqueeText
                  loopDelay={marqueeDelay}
                  duration={marqueeConfig.duration}
                  startAnimation={startAnimation}
                  isOverflowing={marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled}
                  contentRef={stationNameRef}
                  className="font-bold text-text-primary cursor-pointer"
                  onClick={onOpenNowPlaying}
              >
                  <span>{`${station.name}${trackInfo?.program ? ` | ${trackInfo.program}` : ''}`}</span>
              </MarqueeText>

              <div className="text-sm text-text-secondary leading-tight h-[1.25rem] flex items-center">
                {status === 'ERROR' ? (
                  <span className="text-red-400">{error}</span>
                ) : trackInfo?.current ? (
                  <MarqueeText
                      loopDelay={marqueeDelay}
                      duration={marqueeConfig.duration}
                      startAnimation={startAnimation}
                      isOverflowing={marqueeConfig.isOverflowing[1] && isMarqueeCurrentTrackEnabled}
                      contentRef={currentTrackRef}
                  >
                      <InteractiveText text={trackInfo.current} onOpenActionMenu={onOpenActionMenu} />
                  </MarqueeText>
                ) : status === 'LOADING' ? (
                    <span className="text-text-secondary animate-pulse">טוען...</span>
                ) : null}
              </div>
               {status !== 'ERROR' && showNextSong && trackInfo?.next && (
                  <div className="text-xs opacity-80 h-[1.125rem] flex items-center cursor-pointer" onClick={onOpenNowPlaying}>
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
              aria-label={isActuallyPlaying ? "השהה" : "נגן"}
            >
              {isActuallyPlaying || isLoading ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
            </button>
            <button onClick={onNext} className="p-2 text-text-secondary hover:text-text-primary" aria-label="הבא">
                <SkipPreviousIcon className="w-6 h-6" />
            </button>
          </div>

        </div>
          <audio 
            ref={audioRef}
            onPlaying={() => {
                onPlayerEvent({ type: 'STREAM_STARTED' });
                lastTimeUpdateRef.current = Date.now();
                recoveryAttemptRef.current = 0;
            }}
            onPause={() => onPlayerEvent({ type: 'STREAM_PAUSED' })}
            onTimeUpdate={() => {
                lastTimeUpdateRef.current = Date.now();
                recoveryAttemptRef.current = 0;
            }}
            onStalled={() => {
                console.warn("Audio element received 'stalled' event. Triggering recovery.");
                attemptRecovery();
            }}
            onWaiting={() => {}} // We use the LOADING state now
            onError={() => {
                // If error happens while using proxy, try direct fallback immediately
                if (shouldUseProxy && !isDirectFallback) {
                    console.warn("Audio error with proxy. Falling back to direct stream.");
                    setIsDirectFallback(true);
                } else {
                    onPlayerEvent({ type: 'STREAM_ERROR', payload: "שגיאה בניגון התחנה."});
                }
            }}
            // crossorigin removed here, handled dynamically
          />
      </div>
    </div>
  );
};

export default Player;
