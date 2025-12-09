
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EQ_PRESETS } from '../types.js';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, FastForwardIcon, RewindIcon } from './Icons.js';
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
            context.fillRect(centerX + (i * barWidth), height - barHeight, barWidth - 1, barHeight);
            context.fillRect(centerX - ((i + 1) * barWidth), height - barHeight, barWidth - 1, barHeight);
        }
    }, [frequencyData]);

    return React.createElement("canvas", { ref: canvasRef, width: "300", height: "4", className: "absolute top-0 left-0 right-0 w-full h-1" });
};


const Player = ({
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
  shouldUseProxy,
  marqueeDelay,
  isMarqueeProgramEnabled,
  isMarqueeCurrentTrackEnabled,
  isMarqueeNextTrackEnabled,
  marqueeSpeed,
  onOpenActionMenu,
  is100fmSmartPlayerEnabled,
  smartPlaylist,
  command
}) => {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const bassFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const animationFrameRef = useRef();
  
  const lastTimeUpdateRef = useRef(Date.now());
  const recoveryAttemptRef = useRef(0);
  const watchdogIntervalRef = useRef(null);

  const [startAnimation, setStartAnimation] = useState(false);
  
  const stationNameRef = useRef(null);
  const currentTrackRef = useRef(null);
  const nextTrackRef = useRef(null);
  const [marqueeConfig, setMarqueeConfig] = useState({ duration: 0, isOverflowing: [false, false, false] });

  // Smart Player
  const isSmartPlayerActive = is100fmSmartPlayerEnabled && (playerState.station?.stationuuid.startsWith('100fm-') || playerState.station?.url_resolved.includes('streamgates.net'));

  const { status, station, error } = playerState;
  const isPlaying = status === 'PLAYING';
  const isLoading = status === 'LOADING';

  useEffect(() => {
    setStartAnimation(false);
    const timer = setTimeout(() => {
        setStartAnimation(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [station?.stationuuid]);
  
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
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass({});
      audioContextRef.current = context;
      
      const source = context.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
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
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    const playAudio = async () => {
        if (shouldUseProxy) {
            setupAudioContext();
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
            }
        }
        
        let streamUrl = station.url_resolved;

        if (isSmartPlayerActive) {
            if (streamUrl.includes('streamgates.net') && !streamUrl.includes('dvr_timeshift')) {
                const lastSlashIndex = streamUrl.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    const baseUrl = streamUrl.substring(0, lastSlashIndex);
                    streamUrl = `${baseUrl}/playlist_dvr_timeshift-36000.m3u8`;
                }
            }
        }

        if (shouldUseProxy) {
            streamUrl = `${CORS_PROXY_URL}${streamUrl}`;
        }

        if (audio.src !== streamUrl) {
            audio.src = streamUrl;
            if (shouldUseProxy) {
                audio.crossOrigin = 'anonymous';
            } else {
                audio.removeAttribute('crossOrigin');
            }
        }
        try {
            await audio.play();
        } catch (e) {
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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
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

  useEffect(() => {
    const loop = () => {
      if (analyserRef.current && isPlaying && shouldUseProxy) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setFrequencyData(dataArray);
      } else if (!shouldUseProxy && isPlaying) {
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
      const streamUrl = shouldUseProxy 
          ? `${CORS_PROXY_URL}${station.url_resolved}` 
          : station.url_resolved;
          
      audio.src = '';
      audio.load();
      audio.src = `${streamUrl}?retry=${Date.now()}`;
      audio.load();
      audio.play().catch(e => {
          console.error('Recovery play() failed:', e);
          onPlayerEvent({ type: 'STREAM_ERROR', payload: 'שגיאה בהתאוששות' });
      });
  }, [station, onPlayerEvent, shouldUseProxy]);

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

  const getCurrentUnixTime = () => Math.floor(Date.now() / 1000);

  const calculateSeekTime = (targetUnixTimestamp) => {
      const audio = audioRef.current;
      if (!audio) return;
      
      let livePosition = 0;
      if (audio.seekable.length > 0) {
          livePosition = audio.seekable.end(0);
      } else {
          console.log("[SmartSeek] Stream not seekable yet, ignoring command.");
          return;
      }

      const now = getCurrentUnixTime();
      // Logic: target position is relative to live edge.
      // If song started 60s ago in real time: lag is 60s.
      // Target Buffer Pos = Live Buffer End - 60s.
      const secondsAgo = now - targetUnixTimestamp;
      const targetPosition = Math.max(0, livePosition - secondsAgo);
      
      console.log(`[SmartSeek] Song Start: ${targetUnixTimestamp}, Now: ${now}, Seconds Ago: ${secondsAgo}`);
      console.log(`[SmartSeek] Live Buffer End: ${livePosition}, Target Buffer Pos: ${targetPosition}`);

      if (isFinite(targetPosition)) {
          audio.currentTime = targetPosition;
      }
  };

  const getVirtualPlaybackTime = () => {
      const audio = audioRef.current;
      if (!audio || audio.seekable.length === 0) return getCurrentUnixTime();

      const liveEdge = audio.seekable.end(0);
      const currentPos = audio.currentTime;
      const lag = liveEdge - currentPos;
      
      // If lag is very small, we are live.
      // Virtual Time = Real Time - Lag.
      return getCurrentUnixTime() - lag;
  };

  const handleSmartPrev = () => {
      if (!isSmartPlayerActive || smartPlaylist.length === 0) return;
      
      // Calculate where we are "virtually" in history
      const virtualNow = getVirtualPlaybackTime();
      console.log(`[SmartPrev] Virtual Time: ${virtualNow}`);

      // Find the track that is playing at this virtual time
      // Track matches if timestamp <= virtualNow and (nextTrack.timestamp > virtualNow OR isLast)
      const sortedPlaylist = [...smartPlaylist].sort((a, b) => a.timestamp - b.timestamp);
      let currentIndex = -1;

      for (let i = 0; i < sortedPlaylist.length; i++) {
          const track = sortedPlaylist[i];
          const nextTrack = sortedPlaylist[i+1];
          // Adding 5 seconds buffer to 'virtualNow' to handle edge cases where song just ended
          if (track.timestamp <= virtualNow + 5 && (!nextTrack || nextTrack.timestamp > virtualNow + 5)) {
              currentIndex = i;
              break;
          }
      }

      if (currentIndex !== -1) {
          const currentTrack = sortedPlaylist[currentIndex];
          const timeSinceStart = virtualNow - currentTrack.timestamp;
          
          console.log(`[SmartPrev] Found Index: ${currentIndex}, Track: ${currentTrack.name}, Time Since Start: ${timeSinceStart}`);

          if (timeSinceStart > 10) {
              // Restart current song
              calculateSeekTime(currentTrack.timestamp);
          } else if (currentIndex > 0) {
              // Go to previous song
              calculateSeekTime(sortedPlaylist[currentIndex - 1].timestamp);
          } else {
              // Start of playlist
              calculateSeekTime(currentTrack.timestamp);
          }
      } else {
          console.log("[SmartPrev] Could not determine current track index.");
      }
  };

  const handleSmartNext = () => {
      if (!isSmartPlayerActive || smartPlaylist.length === 0) return;

      const virtualNow = getVirtualPlaybackTime();
      console.log(`[SmartNext] Virtual Time: ${virtualNow}`);

      const sortedPlaylist = [...smartPlaylist].sort((a, b) => a.timestamp - b.timestamp);
      let currentIndex = -1;

      for (let i = 0; i < sortedPlaylist.length; i++) {
          const track = sortedPlaylist[i];
          const nextTrack = sortedPlaylist[i+1];
          if (track.timestamp <= virtualNow + 5 && (!nextTrack || nextTrack.timestamp > virtualNow + 5)) {
              currentIndex = i;
              break;
          }
      }

      if (currentIndex !== -1 && currentIndex < sortedPlaylist.length - 1) {
          const nextTrack = sortedPlaylist[currentIndex + 1];
          console.log(`[SmartNext] Jumping to next track: ${nextTrack.name}`);
          calculateSeekTime(nextTrack.timestamp);
      } else {
          // We are at the last song (Live). Jump to Live Edge.
          const audio = audioRef.current;
          if (audio && audio.seekable.length) {
              console.log(`[SmartNext] Already at latest. Jumping to Live Edge.`);
              audio.currentTime = audio.seekable.end(0);
          }
      }
  };

  useEffect(() => {
      if (command) {
          if (command.type === 'NEXT') handleSmartNext();
          if (command.type === 'PREV') handleSmartPrev();
      }
  }, [command]);

  if (!station) {
    return null;
  }

  const isActuallyPlaying = status === 'PLAYING';

  return (
    React.createElement("div", { className: "fixed bottom-0 left-0 right-0 z-30" },
      React.createElement("div", { className: "relative bg-bg-secondary/80 backdrop-blur-lg shadow-t-lg" },
        isVisualizerEnabled && isActuallyPlaying && React.createElement(PlayerVisualizer, { frequencyData: frequencyData }),
        React.createElement("div", { className: "max-w-7xl mx-auto p-4 flex items-center justify-between gap-4" },
          
          React.createElement("div", { 
            className: "flex items-center gap-3 flex-1 min-w-0"
          },
            React.createElement("img", { 
              src: station.favicon, 
              alt: station.name, 
              className: "w-14 h-14 rounded-md bg-gray-700 object-contain flex-shrink-0 cursor-pointer",
              onClick: onOpenNowPlaying,
              onError: (e) => { (e.target).src = 'https://picsum.photos/48'; }
            }),
            React.createElement("div", { className: "min-w-0 cursor-pointer", key: station.stationuuid, onClick: onOpenNowPlaying },
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
                status === 'ERROR' ? (
                  React.createElement("span", { className: "text-red-400" }, error)
                ) : trackInfo?.current ? (
                  React.createElement(MarqueeText, {
                      loopDelay: marqueeDelay,
                      duration: marqueeConfig.duration,
                      startAnimation: startAnimation,
                      isOverflowing: marqueeConfig.isOverflowing[1] && isMarqueeCurrentTrackEnabled,
                      contentRef: currentTrackRef
                  },
                      React.createElement(InteractiveText, { text: trackInfo.current, onOpenActionMenu: onOpenActionMenu })
                  )
                ) : status === 'LOADING' ? (
                    React.createElement("span", { className: "text-text-secondary animate-pulse" }, "טוען...")
                ) : isSmartPlayerActive ? (
                    React.createElement("span", { className: "text-accent text-xs font-semibold animate-pulse" }, "נגן חכם 100FM פעיל")
                ) : null
              ),
               status !== 'ERROR' && showNextSong && trackInfo?.next && (
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
             React.createElement("button", { onClick: onPrev, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "תחנה קודמת" },
                React.createElement(SkipNextIcon, { className: "w-6 h-6" })
            ),
            
            isSmartPlayerActive && (
                React.createElement("button", { onClick: handleSmartPrev, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "שיר קודם" },
                    React.createElement(RewindIcon, { className: "w-5 h-5" })
                )
            ),

            React.createElement("button", { 
              onClick: onPlayPause, 
              className: "p-3 bg-accent text-white rounded-full shadow-md",
              "aria-label": isActuallyPlaying ? "השהה" : "נגן"
            },
              isActuallyPlaying || isLoading ? React.createElement(PauseIcon, { className: "w-7 h-7" }) : React.createElement(PlayIcon, { className: "w-7 h-7" })
            ),

            isSmartPlayerActive && (
                React.createElement("button", { onClick: handleSmartNext, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "שיר הבא" },
                    React.createElement(FastForwardIcon, { className: "w-5 h-5" })
                )
            ),

            React.createElement("button", { onClick: onNext, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "תחנה הבאה" },
                React.createElement(SkipPreviousIcon, { className: "w-6 h-6" })
            )
          )
        ),
        React.createElement("audio", { 
          ref: audioRef,
          onPlaying: () => {
              onPlayerEvent({ type: 'STREAM_STARTED' });
              lastTimeUpdateRef.current = Date.now();
              recoveryAttemptRef.current = 0;
          },
          onPause: () => onPlayerEvent({ type: 'STREAM_PAUSED' }),
          onTimeUpdate: () => {
              lastTimeUpdateRef.current = Date.now();
              recoveryAttemptRef.current = 0;
          },
          onStalled: () => {
              console.warn("Audio element received 'stalled' event. Triggering recovery.");
              attemptRecovery();
          },
          onWaiting: () => {},
          onError: () => onPlayerEvent({ type: 'STREAM_ERROR', payload: "שגיאה בניגון התחנה."}),
          crossOrigin: shouldUseProxy ? "anonymous" : undefined
        })
      )
    )
  );
};

export default Player;