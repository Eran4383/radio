import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CORS_PROXY_URL } from '../constants.js';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, VolumeUpIcon, OpenInNewIcon } from './Icons.js';
import { EQ_PRESETS } from '../types.js';

const Player = ({ 
  station, isPlaying, onPlayPause, onNext, onPrev, eqPreset,
  volume, onVolumeChange, displayInfo, onOpenNowPlaying, setFrequencyData
}) => {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const bassFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const analyserRef = useRef(null);

  const [streamUrl, setStreamUrl] = useState(null);
  const [streamError, setStreamError] = useState(false);

  const handleError = useCallback(() => {
    if (station && streamUrl && !streamUrl.startsWith(CORS_PROXY_URL)) {
      console.warn(`Direct stream failed for ${station.name}, trying CORS proxy.`);
      setStreamUrl(CORS_PROXY_URL + station.url_resolved);
    } else {
      console.error(`Stream failed for ${station?.name} even with CORS proxy.`);
      setStreamError(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [station, streamUrl]);

  // One-time setup for Web Audio API
  useEffect(() => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = context;

        const source = context.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;

        const bassFilter = context.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 300;
        bassFilterRef.current = bassFilter;
        
        const midFilter = context.createBiquadFilter();
        midFilter.type = 'peaking';
        midFilter.frequency.value = 1000;
        midFilter.Q.value = 1;
        midFilterRef.current = midFilter;

        const trebleFilter = context.createBiquadFilter();
        trebleFilter.type = 'highshelf';
        trebleFilter.frequency.value = 3000;
        trebleFilterRef.current = trebleFilter;

        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        analyserRef.current = analyser;

        source.connect(bassFilter).connect(midFilter).connect(trebleFilter).connect(analyser).connect(context.destination);
        console.log("Audio context, EQ filters, and Analyser initialized.");
    } catch (e) {
        console.error("Web Audio API is not supported or failed to initialize.", e);
    }
  }, []);

  // Apply EQ preset changes
  useEffect(() => {
    const presetValues = EQ_PRESETS[eqPreset];
    if (!presetValues || !bassFilterRef.current || !midFilterRef.current || !trebleFilterRef.current || !audioContextRef.current) return;
    
    const now = audioContextRef.current.currentTime;
    bassFilterRef.current.gain.setTargetAtTime(presetValues.bass, now, 0.1);
    midFilterRef.current.gain.setTargetAtTime(presetValues.mid, now, 0.1);
    trebleFilterRef.current.gain.setTargetAtTime(presetValues.treble, now, 0.1);

  }, [eqPreset]);

  useEffect(() => {
    if (station) {
      setStreamUrl(station.url_resolved);
      setStreamError(false);
    }
  }, [station]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (streamUrl && isPlaying) {
      if (audioElement.src !== streamUrl) {
          audioElement.src = streamUrl;
          audioElement.load();
      }
      audioContextRef.current?.resume();
      audioElement.play().catch(e => {
        console.error("Error playing audio:", e)
        handleError();
      });
    } else {
      audioElement.pause();
    }
  }, [streamUrl, isPlaying, handleError]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
  useEffect(() => {
    let animationFrameId;

    const renderFrame = () => {
        if (analyserRef.current && isPlaying) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteFrequencyData(dataArray);
            setFrequencyData(dataArray);
        }
        animationFrameId = requestAnimationFrame(renderFrame);
    };

    if (isPlaying) {
        renderFrame();
    } else {
      setFrequencyData(new Uint8Array(analyserRef.current?.frequencyBinCount || 64));
    }

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, setFrequencyData]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (station && isPlaying) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: displayInfo || `${station.codec} @ ${station.bitrate}kbps`,
          album: 'רדיו דרכים',
          artwork: [ { src: station.favicon, sizes: '512x512', type: 'image/png' } ]
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', onPlayPause);
        navigator.mediaSession.setActionHandler('pause', onPlayPause);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
        navigator.mediaSession.setActionHandler('previoustrack', onPrev);
      } else {
        navigator.mediaSession.playbackState = 'paused';
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    }
  }, [station, isPlaying, displayInfo, onPlayPause, onNext, onPrev]);

  const handleVolumeChange = (e) => {
    onVolumeChange(parseFloat(e.target.value));
  };

  const defaultInfo = station ? `${station.codec} @ ${station.bitrate}kbps` : '...';

  return (
    React.createElement("div", { className: "fixed bottom-0 right-0 left-0 bg-bg-secondary/80 backdrop-blur-md shadow-lg p-2 sm:p-4 z-10" },
      React.createElement("audio", { ref: audioRef, onError: handleError, onCanPlay: () => setStreamError(false), crossOrigin: "anonymous" }),
      React.createElement("div", { className: "max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4" },
        React.createElement("div", { 
          className: "flex items-center gap-2 sm:gap-4 flex-1 min-w-0 cursor-pointer",
          onClick: onOpenNowPlaying,
          role: "button",
          tabIndex: 0,
          "aria-label": "פתח נגן ראשי"
        },
          React.createElement("img", { 
            src: station?.favicon || 'https://picsum.photos/64', 
            alt: station?.name || 'תחנה', 
            className: "w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-gray-700 object-cover flex-shrink-0",
            onError: (e) => { e.currentTarget.src = 'https://picsum.photos/64'; }
          }),
          React.createElement("div", { className: "truncate" },
            React.createElement("h3", { className: "font-bold text-base sm:text-lg truncate text-text-primary" }, station?.name || 'בחר תחנה'),
            React.createElement("p", { className: "text-xs sm:text-sm text-text-secondary truncate" },
              displayInfo || defaultInfo
            )
          )
        ),
        React.createElement("div", { className: "flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0" },
          React.createElement("button", { onClick: onPrev, className: "p-2 sm:p-3 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "הקודם" },
            React.createElement(SkipNextIcon, { className: "w-7 h-7 sm:w-8 sm:h-8" })
          ),
          React.createElement("button", { 
            onClick: onPlayPause, 
            className: "p-3 sm:p-4 bg-accent text-white rounded-full shadow-lg hover:bg-accent-hover transition-transform transform hover:scale-105",
            "aria-label": isPlaying ? "השהה" : "נגן"
          },
            isPlaying ? React.createElement(PauseIcon, { className: "w-8 h-8 sm:w-10 sm:h-10" }) : React.createElement(PlayIcon, { className: "w-8 h-8 sm:w-10 sm:h-10" })
          ),
          React.createElement("button", { onClick: onNext, className: "p-2 sm:p-3 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "הבא" },
            React.createElement(SkipPreviousIcon, { className: "w-7 h-7 sm:w-8 sm:h-8" })
          )
        ),
        React.createElement("div", { className: "hidden sm:flex items-center gap-2 justify-end flex-shrink-0" },
          React.createElement(VolumeUpIcon, { className: "w-6 h-6 text-text-secondary" }),
          React.createElement("input", {
            type: "range",
            min: "0",
            max: "1",
            step: "0.05",
            value: volume,
            onChange: handleVolumeChange,
            className: "w-24 accent-teal-500",
            "aria-label": "עוצמת שמע"
          })
        )
      ),
      streamError && station && (
        React.createElement("div", { className: "max-w-4xl mx-auto mt-2 text-center bg-red-800/50 p-2 rounded-md flex items-center justify-center gap-4" },
          React.createElement("p", { className: "text-sm" }, "שגיאה בניגון התחנה. ייתכן שהשידור חסום."),
          React.createElement("a", {
            href: station.url_resolved,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded"
          },
            React.createElement(OpenInNewIcon, { className: "w-4 h-4" }),
            "פתח בחלון חדש"
          )
        )
      )
    )
  );
};

export default Player;
