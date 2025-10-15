import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService.js';
import { THEMES, EQ_PRESET_KEYS, VISUALIZER_STYLES } from './types.js';
import Player from './components/Player.js';
import StationList from './components/StationList.js';
import SettingsPanel from './components/SettingsPanel.js';
import NowPlaying from './components/NowPlaying.js';
import { useFavorites } from './hooks/useFavorites.js';
import { PRIORITY_STATIONS } from './constants.js';
import { MenuIcon } from './components/Icons.js';
import { getCurrentProgram } from './services/scheduleService.js';
import { fetchStationSpecificTrackInfo, hasSpecificHandler } from './services/stationSpecificService.js';
import StationListSkeleton from './components/StationListSkeleton.js';

const StationFilter = {
  All: 'הכל',
  Favorites: 'מועדפים',
};

// LocalStorage Keys
const CUSTOM_ORDER_KEY = 'radio-station-custom-order';
const THEME_KEY = 'radio-theme';
const EQ_KEY = 'radio-eq';
const CUSTOM_EQ_KEY = 'radio-custom-eq';
const LAST_STATION_KEY = 'radio-last-station-uuid';
const LAST_FILTER_KEY = 'radio-last-filter';
const LAST_SORT_KEY = 'radio-last-sort';
const VOLUME_KEY = 'radio-volume';
const NOW_PLAYING_VISUALIZER_ENABLED_KEY = 'radio-nowplaying-visualizer-enabled';
const PLAYER_BAR_VISUALIZER_ENABLED_KEY = 'radio-playerbar-visualizer-enabled';
const VISUALIZER_STYLE_KEY = 'radio-visualizer-style';
const STATUS_INDICATOR_ENABLED_KEY = 'radio-status-indicator-enabled';
const VOLUME_CONTROL_VISIBLE_KEY = 'radio-volume-control-visible';
const SHOW_NEXT_SONG_KEY = 'radio-show-next-song';
const GRID_SIZE_KEY = 'radio-grid-size';

const SortButton = ({ label, order, currentOrder, setOrder }) => (
  React.createElement("button", {
    onClick: () => setOrder(order),
    className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${
      currentOrder === order ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
    }`
  },
    label
  )
);

export default function App() {
  const [stations, setStations] = useState([]);
  const [currentStationIndex, setCurrentStationIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const pinchDistRef = useRef(0);
  const PINCH_THRESHOLD = 40; // pixels

  const [customOrder, setCustomOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_ORDER_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filter, setFilter] = useState(() => {
    const saved = localStorage.getItem(LAST_FILTER_KEY);
    return (saved && Object.values(StationFilter).includes(saved)) ? saved : StationFilter.All;
  });

  const [sortOrder, setSortOrder] = useState(() => {
    const savedSort = localStorage.getItem(LAST_SORT_KEY);
    const customOrderExists = !!localStorage.getItem(CUSTOM_ORDER_KEY);
    if (savedSort) {
      if (savedSort === 'custom' && !customOrderExists) {
        // Fallback
      } else {
        return savedSort;
      }
    }
    return customOrderExists ? 'custom' : 'priority';
  });
  
  const [theme, setTheme] = useState(() => {
      const saved = localStorage.getItem(THEME_KEY);
      return (saved && THEMES.includes(saved)) ? saved : 'dark';
  });

  const [eqPreset, setEqPreset] = useState(() => {
      const saved = localStorage.getItem(EQ_KEY);
      return (saved && EQ_PRESET_KEYS.includes(saved)) ? saved : 'flat';
  });
  
  const [customEqSettings, setCustomEqSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_EQ_KEY);
      return saved ? JSON.parse(saved) : { bass: 0, mid: 0, treble: 0 };
    } catch {
      return { bass: 0, mid: 0, treble: 0 };
    }
  });

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved ? parseFloat(saved) : 1;
  });

  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState(() => {
      const saved = localStorage.getItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState(() => {
      const saved = localStorage.getItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [visualizerStyle, setVisualizerStyle] = useState(() => {
      const saved = localStorage.getItem(VISUALIZER_STYLE_KEY);
      return (saved && VISUALIZER_STYLES.includes(saved)) ? saved : 'bars';
  });
  
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState(() => {
    const saved = localStorage.getItem(STATUS_INDICATOR_ENABLED_KEY);
    return saved ? JSON.parse(saved) : true;
  });

  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState(() => {
      const saved = localStorage.getItem(VOLUME_CONTROL_VISIBLE_KEY);
      return saved ? JSON.parse(saved) : true;
  });
  
  const [showNextSong, setShowNextSong] = useState(() => {
      const saved = localStorage.getItem(SHOW_NEXT_SONG_KEY);
      return saved ? JSON.parse(saved) : true;
  });
    
  const [gridSize, setGridSize] = useState(() => {
    const saved = localStorage.getItem(GRID_SIZE_KEY);
    // 1 is smallest, 5 is largest. Let's default to 3.
    return saved ? JSON.parse(saved) : 3;
  });


  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
  const currentStation = useMemo(() => {
     if (currentStationIndex !== null && stations[currentStationIndex]) {
        return stations[currentStationIndex];
     }
     return null;
  }, [stations, currentStationIndex]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedStations = await fetchIsraeliStations();
        if (fetchedStations.length === 0) {
          setError('לא הצלחנו למצוא תחנות. נסה לרענן את העמוד.');
        } else {
          setStations(fetchedStations);
        }
      } catch (err) {
        setError('אירעה שגיאה בטעינת התחנות.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (stations.length > 0 && currentStationIndex === null) {
        const lastStationUuid = localStorage.getItem(LAST_STATION_KEY);
        if (lastStationUuid) {
            const stationIndex = stations.findIndex(s => s.stationuuid === lastStationUuid);
            if (stationIndex !== -1) {
                setCurrentStationIndex(stationIndex);
            }
        }
    }
  }, [stations, currentStationIndex]);

  useEffect(() => {
    let intervalId;
    const fetchAndSetInfo = async () => {
      if (!currentStation) return;
      
      let finalInfo = null;
      const stationName = currentStation.name;

      // New logic: Check if there's a specific, high-accuracy API for this station.
      if (hasSpecificHandler(stationName)) {
        // This station has a dedicated API. Use it exclusively for live data.
        const specificInfo = await fetchStationSpecificTrackInfo(stationName);
        if (specificInfo) {
          finalInfo = specificInfo;
        } else {
          // If the specific API fails, only fall back to the schedule, not the generic API.
          const scheduledProgram = getCurrentProgram(stationName);
          if (scheduledProgram) {
            finalInfo = { program: scheduledProgram, current: null, next: null };
          }
        }
      } else {
        // This station has NO dedicated API. Use the generic Radio-Browser API.
        const songTitle = await fetchLiveTrackInfo(currentStation.stationuuid);
        if (songTitle && songTitle.toLowerCase() !== stationName.toLowerCase()) {
          finalInfo = { program: null, current: songTitle, next: null };
        } else {
          // If the generic API fails, fall back to the schedule.
          const scheduledProgram = getCurrentProgram(stationName);
          if (scheduledProgram) {
            finalInfo = { program: scheduledProgram, current: null, next: null };
          }
        }
      }
      
      setTrackInfo(finalInfo);
    };

    if (currentStation) {
      fetchAndSetInfo(); 
      intervalId = window.setInterval(fetchAndSetInfo, 20000);
    } else {
      setTrackInfo(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentStation]);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LAST_FILTER_KEY, filter);
  }, [filter]);

  useEffect(() => {
    localStorage.setItem(LAST_SORT_KEY, sortOrder);
  }, [sortOrder]);
  
  const handleSetVolume = (newVolume) => {
    setVolume(newVolume);
    localStorage.setItem(VOLUME_KEY, newVolume.toString());
  };

  const handleSetEqPreset = (preset) => {
    setEqPreset(preset);
    localStorage.setItem(EQ_KEY, preset);
  };
  
  const handleSetCustomEqSettings = (settings) => {
    setCustomEqSettings(settings);
    localStorage.setItem(CUSTOM_EQ_KEY, JSON.stringify(settings));
  };
  
  const handleSetIsNowPlayingVisualizerEnabled = (enabled) => {
    setIsNowPlayingVisualizerEnabled(enabled);
    localStorage.setItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsPlayerBarVisualizerEnabled = (enabled) => {
    setIsPlayerBarVisualizerEnabled(enabled);
    localStorage.setItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY, JSON.stringify(enabled));
  };
  
  const handleSetStatusIndicatorEnabled = (enabled) => {
    setIsStatusIndicatorEnabled(enabled);
    localStorage.setItem(STATUS_INDICATOR_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsVolumeControlVisible = (visible) => {
    setIsVolumeControlVisible(visible);
    localStorage.setItem(VOLUME_CONTROL_VISIBLE_KEY, JSON.stringify(visible));
  };

  const handleSetShowNextSong = (enabled) => {
    setShowNextSong(enabled);
    localStorage.setItem(SHOW_NEXT_SONG_KEY, JSON.stringify(enabled));
  };
    
  const handleSetGridSize = useCallback((size) => {
    setGridSize(size);
    localStorage.setItem(GRID_SIZE_KEY, JSON.stringify(size));
  }, []);

  const handleCycleVisualizerStyle = useCallback(() => {
    const currentIndex = VISUALIZER_STYLES.indexOf(visualizerStyle);
    const nextIndex = (currentIndex + 1) % VISUALIZER_STYLES.length;
    const newStyle = VISUALIZER_STYLES[nextIndex];
    setVisualizerStyle(newStyle);
    localStorage.setItem(VISUALIZER_STYLE_KEY, newStyle);
  }, [visualizerStyle]);


  const saveCustomOrder = (newOrder) => {
      setCustomOrder(newOrder);
      localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(newOrder));
  };

  const handleReorder = (reorderedDisplayedUuids) => {
      const allStationUuids = stations.map(s => s.stationuuid);
      const currentOrder = customOrder.length > 0 ? customOrder : allStationUuids;
      const reorderedSet = new Set(reorderedDisplayedUuids);
      const newOrder = [...reorderedDisplayedUuids];
      currentOrder.forEach(uuid => {
        if (!reorderedSet.has(uuid)) {
          newOrder.push(uuid);
        }
      });
      saveCustomOrder(newOrder);
      setSortOrder('custom');
  };

  const filteredStations = useMemo(() => {
    if (filter === StationFilter.Favorites) {
      return stations.filter(s => favorites.includes(s.stationuuid));
    }
    return stations;
  }, [stations, filter, favorites]);
  
  const displayedStations = useMemo(() => {
    let stationsToSort = [...filteredStations];
    const customOrderMap = new Map(customOrder.map((uuid, index) => [uuid, index]));
    switch (sortOrder) {
      case 'custom':
        stationsToSort.sort((a, b) => {
            const indexA = customOrderMap.get(a.stationuuid);
            const indexB = customOrderMap.get(b.stationuuid);
            if (typeof indexA === 'number' && typeof indexB === 'number') return indexA - indexB;
            if (typeof indexA === 'number') return -1;
            if (typeof indexB === 'number') return 1;
            return a.name.localeCompare(b.name, 'he');
        });
        break;
      case 'name':
        stationsToSort.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        break;
      case 'tags':
        stationsToSort.sort((a, b) => a.tags.localeCompare(b.tags, 'he'));
        break;
      case 'priority':
      default:
        const getPriorityIndex = (stationName) => {
          const lowerCaseName = stationName.toLowerCase();
          return PRIORITY_STATIONS.findIndex(priorityStation => 
            priorityStation.aliases.some(alias => 
              lowerCaseName.includes(alias.toLowerCase())
            )
          );
        };
        stationsToSort.sort((a, b) => {
          let aPriority = getPriorityIndex(a.name);
          let bPriority = getPriorityIndex(b.name);
          if (aPriority === -1) aPriority = Infinity;
          if (bPriority === -1) bPriority = Infinity;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          return a.name.localeCompare(b.name, 'he');
        });
        break;
    }
    return stationsToSort;
  }, [filteredStations, sortOrder, customOrder]);

  const playStationAtIndex = useCallback((index) => {
    if (index >= 0 && index < stations.length) {
        localStorage.setItem(LAST_STATION_KEY, stations[index].stationuuid);
        setCurrentStationIndex(index);
        setIsPlaying(true);
    }
  }, [stations]);

  const handleSelectStation = useCallback((station) => {
    const stationIndexInMainList = stations.findIndex(s => s.stationuuid === station.stationuuid);
    if (stationIndexInMainList !== -1) {
        if (currentStationIndex === stationIndexInMainList) {
          setIsPlaying(prev => !prev);
        } else {
          playStationAtIndex(stationIndexInMainList);
        }
    }
  }, [stations, currentStationIndex, playStationAtIndex]);

  const handlePlayPause = useCallback(() => {
    if (currentStation) {
      setIsPlaying(!isPlaying);
    } else if (displayedStations.length > 0) {
        const firstStationIndex = stations.findIndex(s => s.stationuuid === displayedStations[0].stationuuid);
        playStationAtIndex(firstStationIndex);
    }
  }, [isPlaying, currentStation, displayedStations, stations, playStationAtIndex]);
  
  const handleNext = useCallback(() => {
      if (displayedStations.length === 0) return;
      const currentStationObject = currentStationIndex !== null ? stations[currentStationIndex] : null;
      const currentIndexInDisplayed = currentStationObject ? displayedStations.findIndex(s => s.stationuuid === currentStationObject.stationuuid) : -1;
      let nextIndexInDisplayed = (currentIndexInDisplayed === -1) ? 0 : (currentIndexInDisplayed + 1) % displayedStations.length;
      const nextStation = displayedStations[nextIndexInDisplayed];
      const globalIndex = stations.findIndex(s => s.stationuuid === nextStation.stationuuid);
      playStationAtIndex(globalIndex);
  }, [currentStationIndex, displayedStations, stations, playStationAtIndex]);

  const handlePrev = useCallback(() => {
      if (displayedStations.length === 0) return;
      const currentStationObject = currentStationIndex !== null ? stations[currentStationIndex] : null;
      const currentIndexInDisplayed = currentStationObject ? displayedStations.findIndex(s => s.stationuuid === currentStationObject.stationuuid) : -1;
      let prevIndexInDisplayed = (currentIndexInDisplayed <= 0) ? displayedStations.length - 1 : currentIndexInDisplayed - 1;
      const prevStation = displayedStations[prevIndexInDisplayed];
      const globalIndex = stations.findIndex(s => s.stationuuid === prevStation.stationuuid);
      playStationAtIndex(globalIndex);
  }, [currentStationIndex, displayedStations, stations, playStationAtIndex]);
    
  const handleTouchStart = useCallback((e) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      }
  }, []);

  const handleTouchMove = useCallback((e) => {
      if (e.touches.length === 2 && pinchDistRef.current > 0) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const delta = currentDist - pinchDistRef.current;

          if (Math.abs(delta) > PINCH_THRESHOLD) {
              if (delta > 0) { // Pinch out -> bigger items
                  const newSize = Math.min(5, gridSize + 1);
                  handleSetGridSize(newSize);
              } else { // Pinch in -> smaller items
                  const newSize = Math.max(1, gridSize - 1);
                  handleSetGridSize(newSize);
              }
              pinchDistRef.current = currentDist;
          }
      }
  }, [gridSize, handleSetGridSize]);

  const handleTouchEnd = useCallback((e) => {
      if (e.touches.length < 2) {
          pinchDistRef.current = 0;
      }
  }, []);

  return (
    React.createElement("div", { className: "min-h-screen bg-bg-primary text-text-primary flex flex-col" },
      React.createElement("header", { className: "p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md" },
        React.createElement("div", { className: "max-w-7xl mx-auto flex items-center justify-between gap-4" },
            React.createElement("button", { onClick: () => setIsSettingsOpen(true), className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הגדרות" },
              React.createElement(MenuIcon, { className: "w-6 h-6" })
            ),
            React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1" },
              React.createElement("button", { onClick: () => setFilter(StationFilter.All), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}`}, StationFilter.All),
              React.createElement("button", { onClick: () => setFilter(StationFilter.Favorites), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}`}, StationFilter.Favorites)
            ),
            React.createElement("h1", { className: "text-xl sm:text-2xl font-bold text-accent" }, "רדיו פרימיום")
        ),
        React.createElement("div", { className: "max-w-7xl mx-auto mt-4" },
            React.createElement("div", { className: "flex items-center justify-center gap-2" },
                React.createElement("span", { className: "text-xs text-text-secondary" }, "מיון:"),
                React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center" },
                    React.createElement(SortButton, { label: "אישי", order: "custom", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "פופולריות", order: "priority", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "שם", order: "name", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "ז'אנר", order: "tags", currentOrder: sortOrder, setOrder: setSortOrder })
                )
            )
        )
      ),
      React.createElement("main", { className: "flex-grow pb-48", onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd }, 
        isLoading ? (
          React.createElement(StationListSkeleton, null)
        ) : error ? (
          React.createElement("p", { className: "text-center text-red-400 p-4" }, error)
        ) : (
            displayedStations.length > 0 ? (
                React.createElement(StationList, {
                    stations: displayedStations,
                    currentStation: currentStation,
                    onSelectStation: handleSelectStation,
                    isFavorite: isFavorite,
                    toggleFavorite: toggleFavorite,
                    onReorder: handleReorder,
                    isStreamActive: isStreamActive,
                    isStatusIndicatorEnabled: isStatusIndicatorEnabled,
                    gridSize: gridSize
                })
            ) : (
                React.createElement("div", { className: "text-center p-8 text-text-secondary" },
                    React.createElement("h2", { className: "text-xl font-semibold" }, filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'),
                    React.createElement("p", null, filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.')
                )
            )
        )
      ),
      React.createElement(SettingsPanel, {
        isOpen: isSettingsOpen,
        onClose: () => setIsSettingsOpen(false),
        currentTheme: theme,
        onThemeChange: setTheme,
        currentEqPreset: eqPreset,
        onEqPresetChange: handleSetEqPreset,
        isNowPlayingVisualizerEnabled: isNowPlayingVisualizerEnabled,
        onNowPlayingVisualizerEnabledChange: handleSetIsNowPlayingVisualizerEnabled,
        isPlayerBarVisualizerEnabled: isPlayerBarVisualizerEnabled,
        onPlayerBarVisualizerEnabledChange: handleSetIsPlayerBarVisualizerEnabled,
        isStatusIndicatorEnabled: isStatusIndicatorEnabled,
        onStatusIndicatorEnabledChange: handleSetStatusIndicatorEnabled,
        isVolumeControlVisible: isVolumeControlVisible,
        onVolumeControlVisibleChange: handleSetIsVolumeControlVisible,
        showNextSong: showNextSong,
        onShowNextSongChange: handleSetShowNextSong,
        customEqSettings: customEqSettings,
        onCustomEqChange: handleSetCustomEqSettings,
        gridSize: gridSize,
        onGridSizeChange: handleSetGridSize
      }),
      currentStation && React.createElement(NowPlaying, {
        isOpen: isNowPlayingOpen,
        onClose: () => setIsNowPlayingOpen(false),
        station: currentStation,
        isPlaying: isPlaying,
        onPlayPause: handlePlayPause,
        onNext: handleNext,
        onPrev: handlePrev,
        volume: volume,
        onVolumeChange: handleSetVolume,
        trackInfo: trackInfo,
        showNextSong: showNextSong,
        frequencyData: frequencyData,
        visualizerStyle: visualizerStyle,
        isVisualizerEnabled: isNowPlayingVisualizerEnabled,
        onCycleVisualizerStyle: handleCycleVisualizerStyle,
        isVolumeControlVisible: isVolumeControlVisible,
      }),
      React.createElement(Player, {
        station: currentStation,
        isPlaying: isPlaying,
        onPlayPause: handlePlayPause,
        onNext: handleNext,
        onPrev: handlePrev,
        eqPreset: eqPreset,
        customEqSettings: customEqSettings,
        volume: volume,
        onVolumeChange: handleSetVolume,
        trackInfo: trackInfo,
        showNextSong: showNextSong,
        onOpenNowPlaying: () => setIsNowPlayingOpen(true),
        setFrequencyData: setFrequencyData,
        onStreamStatusChange: setIsStreamActive,
        frequencyData: frequencyData,
        isVisualizerEnabled: isPlayerBarVisualizerEnabled
      })
    )
  );
}