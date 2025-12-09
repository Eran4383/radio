
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Station, EqPreset, EQ_PRESETS, CustomEqSettings, StationTrackInfo, SmartPlaylistItem } from '../types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, FastForwardIcon, RewindIcon } from './Icons';
import { CORS_PROXY_URL } from '../constants';
import InteractiveText from './InteractiveText';
import MarqueeText from './MarqueeText';

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
  smartPlaylist: SmartPlaylistItem[]; // NEW PROP
  command?: { type: 'NEXT' | 'PREV', id: number } | null;
  liveStreamDate: number | null; // The server time of the HLS stream (Unix Timestamp)
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
  is100fmSmartPlayerEnabled,
  smartPlaylist,
  command,
  liveStreamDate
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

  const [startAnimation, setStartAnimation] = useState(false);
  const [isHlsSupported, setIsHlsSupported] = useState(false);
  
  // HLS.js Reference
  const hlsRef = useRef<any>(null);
  
  // Refs for marquee synchronization
  const stationNameRef = useRef<HTMLSpanElement>(null);
  const currentTrackRef = useRef<HTMLSpanElement>(null);
  const nextTrackRef = useRef<HTMLSpanElement>(null);
  const [marqueeConfig, setMarqueeConfig] = useState<{ duration: number; isOverflowing: boolean[] }>({ duration: 0, isOverflowing: [false, false, false] });

  // --- Smart Player State ---
  // Only active if enabled, it's a 100fm station
  const isSmartPlayerActive = is100fmSmartPlayerEnabled && 
                              (playerState.station?.stationuuid.startsWith('100fm-') || playerState.station?.url_resolved.includes('streamgates.net'));
  
  const canUseSmartFeatures = isSmartPlayerActive && isHlsSupported;

  const { status, station, error } = playerState;
  const isPlaying = status === 'PLAYING';
  const isLoading = status === 'LOADING';

  // Check HLS Support on mount (Native or via hls.js)
  useEffect(() => {
      const audio = document.createElement('audio');
      const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl') || 
                          audio.canPlayType('audio/mpegurl');
      
      const hlsJsSupported = (window as any).Hls && (window as any).Hls.isSupported();
      
      setIsHlsSupported(!!nativeHls || !!hlsJsSupported);
  }, []);

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

    // Cleanup previous HLS instance
    if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }

    const playAudio = async () => {
        // Only set up audio context (EQ/Visualizer) if proxy is enabled (CORS)
        if (shouldUseProxy) {
            setupAudioContext();
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }
        }
        
        let streamUrl = station.url_resolved;
        let useHlsJs = false;

        // --- Smart Player URL Overwrite ---
        if (isSmartPlayerActive) {
            // Force DVR URL if we detect a 100FM stream on streamgates that isn't already DVR
            if (streamUrl.includes('streamgates.net') && !streamUrl.includes('dvr_timeshift')) {
                const lastSlashIndex = streamUrl.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    const baseUrl = streamUrl.substring(0, lastSlashIndex);
                    // Force the playlist URL, not chunks
                    streamUrl = `${baseUrl}/playlist_dvr_timeshift-36000.m3u8`;
                }
            }
            
            // Determine if we need hls.js (Desktop) or Native (Mobile)
            const audioEl = document.createElement('audio');
            const nativeHls = audioEl.canPlayType('application/vnd.apple.mpegurl') || 
                              audioEl.canPlayType('audio/mpegurl');
            
            if (!nativeHls && (window as any).Hls && (window as any).Hls.isSupported()) {
                useHlsJs = true;
            }
        }

        // Apply Proxy if needed
        if (shouldUseProxy && !useHlsJs) { // HLS.js usually handles its own XHR
            streamUrl = `${CORS_PROXY_URL}${streamUrl}`;
        }

        if (useHlsJs) {
             console.log('[Player] Initializing HLS.js for URL:', streamUrl);
             const Hls = (window as any).Hls;
             const hls = new Hls({
                 enableWorker: true,
                 lowLatencyMode: true,
             });
             hls.loadSource(streamUrl);
             hls.attachMedia(audio);
             hlsRef.current = hls;
             
             hls.on(Hls.Events.ERROR, function (event: any, data: any) {
                if (data.fatal) {
                    console.error('[HLS.js] Fatal Error:', data.type, data.details);
                    switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('[HLS.js] Network error, attempting recovery...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('[HLS.js] Media error, attempting recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.log('[HLS.js] Unrecoverable error.');
                        hls.destroy();
                        break;
                    }
                }
             });

        } else {
            if (audio.src !== streamUrl) {
                audio.src = streamUrl;
                // Only request CORS if using proxy, otherwise direct connection might fail
                if (shouldUseProxy) {
                    audio.crossOrigin = 'anonymous';
                } else {
                    audio.removeAttribute('crossOrigin');
                }
            }
        }

        try {
            await audio.play();
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.debug('Audio play request was interrupted by a new load request (normal behavior).');
            } else if (e.name === 'NotAllowedError') {
                console.warn("Autoplay blocked by browser policy. User interaction required.");
                onPlayerEvent({ type: 'AUTOPLAY_BLOCKED' });
            } else {
                console.error("Error playing audio:", e);
                onPlayerEvent({ type: 'STREAM_ERROR', payload: "לא ניתן לנגן את התחנה." });
            }
        }
    };

    if (status === 'LOADING') {
      playAudio();
    } else if (status === 'PAUSED' || status === 'IDLE' || status === 'ERROR') {
      audio.pause();
    }
  }, [status, station, setupAudioContext, onPlayerEvent, shouldUseProxy, isSmartPlayerActive]);


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
      // Only get data if using proxy (AudioContext is valid)
      if (analyserRef.current && isPlaying && shouldUseProxy) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      } else if (!shouldUseProxy && isPlaying) {
          // Fallback: if visualizer is off/direct mode, send zero data so visualizers flatten
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
  }, [isPlaying, setFrequencyData, shouldUseProxy]);

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
        navigator.mediaSession.setActionHandler('nexttrack', () => handleSmartNext());
        navigator.mediaSession.setActionHandler('previoustrack', () => handleSmartPrev());
        
        if (status === 'PLAYING') {
            navigator.mediaSession.playbackState = 'playing';
        } else {
            navigator.mediaSession.playbackState = 'paused';
        }
    }
  }, [station, status, trackInfo, onPlay, onPause, onNext, onPrev, isSmartPlayerActive, smartPlaylist]); 

  // Automatic stream recovery logic
  const attemptRecovery = useCallback(() => {
      if (!audioRef.current || !station || recoveryAttemptRef.current >= 3) {
          if (recoveryAttemptRef.current >= 3) {
              console.error("Recovery failed after 3 attempts.");
              onPlayerEvent({ type: 'STREAM_ERROR', payload: "החיבור נכשל סופית" });
          }
          return;
      }

      console.warn(`Stream stalled. Attempting recovery #${recoveryAttemptRef.current + 1}...`);
      recoveryAttemptRef.current += 1;
      lastTimeUpdateRef.current = Date.now();

      const audio = audioRef.current;
      
      // Basic recovery for HLS might need internal HLS.js recovery
      if (hlsRef.current) {
          hlsRef.current.recoverMediaError();
          audio.play();
          return;
      }

      const streamUrl = shouldUseProxy 
          ? `${CORS_PROXY_URL}${station.url_resolved}` 
          : station.url_resolved;
          
      audio.src = '';
      audio.load();
      audio.src = `${streamUrl}?retry=${Date.now()}`; // Append retry to bust cache if needed
      audio.load();
      audio.play().catch(e => {
          console.error('Recovery play() failed:', e);
          onPlayerEvent({ type: 'STREAM_ERROR', payload: 'שגיאה בהתאוששות' });
      });
  }, [station, onPlayerEvent, shouldUseProxy]);

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
              if (Date.now() - lastTimeUpdateRef.current > 7000) { // 7-second stall threshold
                  attemptRecovery();
              }
          }, 3000); // Check every 3 seconds
      } else {
          clearWatchdog();
          recoveryAttemptRef.current = 0;
      }

      return clearWatchdog;
  }, [status, attemptRecovery]);

  // --- Smart Seeking Logic (Anchor: Live Edge) ---
  
  const getSeekableEnd = () => {
      const audio = audioRef.current;
      if (!audio || audio.seekable.length === 0) return 0;
      return audio.seekable.end(0);
  }

  const executeSeekToSecondsAgo = (secondsAgo: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const liveEdge = getSeekableEnd();
      
      if (liveEdge < 60) {
          console.warn("[SmartSeek] Buffer too small for seeking. Live Edge: " + liveEdge);
          // With HLS.js, we might need to wait for buffer to grow or check config
      }

      const targetPos = Math.max(0, liveEdge - secondsAgo);
      
      console.log(`[SmartSeek] Live Edge: ${liveEdge}, Seconds Ago: ${secondsAgo}, Target: ${targetPos}`);
      
      if (isFinite(targetPos)) {
          audio.currentTime = targetPos;
      }
  };

  const handleSmartPrev = () => {
      if (!canUseSmartFeatures || smartPlaylist.length === 0) {
          console.warn("[SmartPrev] Smart features unavailable.");
          return;
      }
      
      // ANCHOR LOGIC: The last track in the playlist IS the live edge.
      const lastTrack = smartPlaylist[smartPlaylist.length - 1];
      const liveAnchorTime = lastTrack.timestamp; 
      
      // Calculate current virtual position based on audio buffer
      const audio = audioRef.current;
      if (!audio) return;
      
      const liveEdgePos = getSeekableEnd();
      const currentPos = audio.currentTime;
      const secondsBehindLive = liveEdgePos - currentPos;
      
      // Virtual Time = (Last Song Time) - (Seconds Behind Buffer End)
      const virtualNow = liveAnchorTime - secondsBehindLive;
      console.log(`[SmartPrev] Virtual Time: ${virtualNow}`);

      // Find current track index based on virtual time
      let currentIndex = -1;
      for (let i = 0; i < smartPlaylist.length; i++) {
          const track = smartPlaylist[i];
          const nextTrack = smartPlaylist[i+1];
          // Use a small buffer
          if (track.timestamp <= virtualNow + 5 && (!nextTrack || nextTrack.timestamp > virtualNow + 5)) {
              currentIndex = i;
              break;
          }
      }

      if (currentIndex !== -1) {
          const currentTrack = smartPlaylist[currentIndex];
          const timeSinceStart = virtualNow - currentTrack.timestamp;
          
          if (timeSinceStart > 10) {
              // Restart current song
              // Seek Amount = (Last Track Time) - (Current Track Time)
              const seekSecondsAgo = liveAnchorTime - currentTrack.timestamp;
              executeSeekToSecondsAgo(seekSecondsAgo);
          } else if (currentIndex > 0) {
              // Prev song
              const prevTrack = smartPlaylist[currentIndex - 1];
              const seekSecondsAgo = liveAnchorTime - prevTrack.timestamp;
              executeSeekToSecondsAgo(seekSecondsAgo);
          } else {
              // Start of playlist
              const seekSecondsAgo = liveAnchorTime - currentTrack.timestamp;
              executeSeekToSecondsAgo(seekSecondsAgo);
          }
      } else {
          // Fallback: Jump to last track if logic fails
           executeSeekToSecondsAgo(0); 
      }
  };

  const handleSmartNext = () => {
      if (!canUseSmartFeatures || smartPlaylist.length === 0) {
          return;
      }

      const lastTrack = smartPlaylist[smartPlaylist.length - 1];
      const liveAnchorTime = lastTrack.timestamp;
      
      const audio = audioRef.current;
      if (!audio) return;
      
      const liveEdgePos = getSeekableEnd();
      const currentPos = audio.currentTime;
      const secondsBehindLive = liveEdgePos - currentPos;
      const virtualNow = liveAnchorTime - secondsBehindLive;

      let currentIndex = -1;
      for (let i = 0; i < smartPlaylist.length; i++) {
          const track = smartPlaylist[i];
          const nextTrack = smartPlaylist[i+1];
          if (track.timestamp <= virtualNow + 5 && (!nextTrack || nextTrack.timestamp > virtualNow + 5)) {
              currentIndex = i;
              break;
          }
      }

      if (currentIndex !== -1 && currentIndex < smartPlaylist.length - 1) {
          const nextTrack = smartPlaylist[currentIndex + 1];
          // Seek Amount = (Last Track Time) - (Next Track Time)
          const seekSecondsAgo = liveAnchorTime - nextTrack.timestamp;
          executeSeekToSecondsAgo(seekSecondsAgo);
      } else {
          // Jump to Live
          console.log(`[SmartNext] Jumping to Live Edge.`);
          if (audio) audio.currentTime = getSeekableEnd();
      }
  };

  // Listen for remote commands from NowPlaying (via App)
  useEffect(() => {
      if (command) {
          if (command.type === 'NEXT') handleSmartNext();
          if (command.type === 'PREV') handleSmartPrev();
      }
  }, [command]);


  if (!station) {
    return null; // Don't render the player if no station is selected
  }

  const isActuallyPlaying = status === 'PLAYING';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="relative bg-bg-secondary/80 backdrop-blur-lg shadow-t-lg">
        {isVisualizerEnabled && isActuallyPlaying && <PlayerVisualizer frequencyData={frequencyData} />}
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
            <div className="min-w-0 cursor-pointer" key={station.stationuuid} onClick={onOpenNowPlaying}>
               <MarqueeText
                  loopDelay={marqueeDelay}
                  duration={marqueeConfig.duration}
                  startAnimation={startAnimation}
                  isOverflowing={marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled}
                  contentRef={stationNameRef}
                  className="font-bold text-text-primary"
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
                ) : canUseSmartFeatures ? (
                    <span className="text-accent text-xs font-semibold animate-pulse">נגן חכם 100FM פעיל</span>
                ) : null}
              </div>
               {status !== 'ERROR' && showNextSong && trackInfo?.next && (
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
             {/* Station Prev (Right in RTL) */}
             <button onClick={onPrev} className="p-2 text-text-secondary hover:text-text-primary" aria-label="תחנה קודמת">
                <SkipNextIcon className="w-6 h-6" />
            </button>

            {/* Song Prev (Right in RTL) - Rewind Icon for Previous Song */}
            {canUseSmartFeatures && (
                <button onClick={handleSmartPrev} className="p-2 text-text-secondary hover:text-text-primary" aria-label="שיר קודם">
                    <RewindIcon className="w-5 h-5" /> 
                </button>
            )}

            <button 
              onClick={onPlayPause} 
              className="p-3 bg-accent text-white rounded-full shadow-md"
              aria-label={isActuallyPlaying ? "השהה" : "נגן"}
            >
              {isActuallyPlaying || isLoading ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
            </button>

            {/* Song Next (Left in RTL) - FastForward Icon for Next Song */}
            {canUseSmartFeatures && (
                <button onClick={handleSmartNext} className="p-2 text-text-secondary hover:text-text-primary" aria-label="שיר הבא">
                    <FastForwardIcon className="w-5 h-5" />
                </button>
            )}

            {/* Station Next (Left in RTL) */}
            <button onClick={onNext} className="p-2 text-text-secondary hover:text-text-primary" aria-label="תחנה הבאה">
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
            onError={() => onPlayerEvent({ type: 'STREAM_ERROR', payload: "שגיאה בניגון התחנה."})}
            // crossorigin removed here, handled dynamically
          />
      </div>
    </div>
  );
};

export default Player;
