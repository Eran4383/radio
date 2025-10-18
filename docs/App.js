import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
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
import { getCategory } from './services/categoryService.js';

const StationFilter = {
  All: 'הכל',
  Favorites: 'מועדפים',
};

const initialPlayerState = {
  status: 'IDLE',
  station: null,
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'SELECT_STATION':
      if (state.station?.stationuuid === action.payload.stationuuid) {
        // It's the same station, toggle play/pause
        if (state.status === 'PLAYING') {
          return { ...state, status: 'PAUSED' };
        } else if (state.status === 'PAUSED' || state.status === 'ERROR' || state.status === 'IDLE') {
          return { ...state, status: 'LOADING' };
        }
      }
      // It's a new station
      return { status: 'LOADING', station: action.payload };
    case 'PLAY':
       if (state.station) {
         return { ...state, status: 'LOADING' };
       }
       return { ...state, status: 'LOADING', station: action.payload };
    case 'TOGGLE_PAUSE':
      if (state.status === 'PLAYING') {
        return { ...state, status: 'PAUSED' };
      }
      if (state.status === 'PAUSED' && state.station) {
        return { ...state, status: 'LOADING' };
      }
      return state;
    case 'STREAM_STARTED':
      return { ...state, status: 'PLAYING', error: undefined };
    case 'STREAM_PAUSED':
        if(state.status === 'LOADING') return state; // Ignore pause event during load
        return { ...state, status: 'PAUSED' };
    case 'STREAM_ERROR':
      return { ...state, status: 'ERROR', error: action.payload };
    default:
      return state;
  }
}


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
const MARQUEE_PROGRAM_ENABLED_KEY = 'radio-marquee-program-enabled';
const MARQUEE_CURRENT_ENABLED_KEY = 'radio-marquee-current-enabled';
const MARQUEE_NEXT_ENABLED_KEY = 'radio-marquee-next-enabled';
const MARQUEE_SPEED_KEY = 'radio-marquee-speed';
const MARQUEE_DELAY_KEY = 'radio-marquee-delay';

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

const CATEGORY_SORTS = [
    { order: 'category_style', label: 'סגנון' },
    { order: 'category_identity', label: 'אופי' },
    { order: 'category_region', label: 'אזור' },
    { order: 'category_nameStructure', label: 'שם' },
];

export default function App() {
  const [stations, setStations] = useState([]);
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState(null);
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') === 'favorites') {
      return StationFilter.Favorites;
    }
    const saved = localStorage.getItem(LAST_FILTER_KEY);
    return (saved && Object.values(StationFilter).includes(saved)) ? saved : StationFilter.All;
  });

  const [sortOrder, setSortOrder] = useState(() => {
    let savedSort = localStorage.getItem(LAST_SORT_KEY);
    // Handle legacy 'name' value from older versions
    if (savedSort === 'name') {
        savedSort = 'name_asc';
    }
    // Handle legacy 'tags' value
    if (savedSort === 'tags') {
        savedSort = 'category_style';
    }
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
  
  const [isMarqueeProgramEnabled, setIsMarqueeProgramEnabled] = useState(() => {
    const saved = localStorage.getItem(MARQUEE_PROGRAM_ENABLED_KEY);
    return saved ? JSON.parse(saved) : true;
  });

  const [isMarqueeCurrentTrackEnabled, setIsMarqueeCurrentTrackEnabled] = useState(() => {
    const saved = localStorage.getItem(MARQUEE_CURRENT_ENABLED_KEY);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [isMarqueeNextTrackEnabled, setIsMarqueeNextTrackEnabled] = useState(() => {
    const saved = localStorage.getItem(MARQUEE_NEXT_ENABLED_KEY);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [marqueeSpeed, setMarqueeSpeed] = useState(() => {
    const saved = localStorage.getItem(MARQUEE_SPEED_KEY);
    // Defaulting to 6 on a 1-10 scale. Slower than the old default.
    return saved ? JSON.parse(saved) : 6;
  });

  const [marqueeDelay, setMarqueeDelay] = useState(() => {
      const saved = localStorage.getItem(MARQUEE_DELAY_KEY);
      return saved ? JSON.parse(saved) : 3;
  });


  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
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
    if (stations.length > 0 && playerState.status === 'IDLE') {
        const lastStationUuid = localStorage.getItem(LAST_STATION_KEY);
        if (lastStationUuid) {
            const station = stations.find(s => s.stationuuid === lastStationUuid);
            if (station) {
                // Don't auto-play, just set it as the current station
                dispatch({ type: 'SELECT_STATION', payload: station });
            }
        }
    }
  }, [stations, playerState.status]);

  // Save last station to localStorage
  useEffect(() => {
      if (playerState.station) {
          localStorage.setItem(LAST_STATION_KEY, playerState.station.stationuuid);
      }
  }, [playerState.station]);

  useEffect(() => {
    let intervalId;
    const fetchAndSetInfo = async () => {
      if (!playerState.station) return;
      
      let finalInfo = null;
      const stationName = playerState.station.name;

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
        const songTitle = await fetchLiveTrackInfo(playerState.station.stationuuid);
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

    if (playerState.station) {
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
  }, [playerState.station]);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    // Only save filter to local storage if it's not from a URL param on initial load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') !== 'favorites') {
        localStorage.setItem(LAST_FILTER_KEY, filter);
    }
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
  
  const handleSetIsMarqueeProgramEnabled = (enabled) => {
    setIsMarqueeProgramEnabled(enabled);
    localStorage.setItem(MARQUEE_PROGRAM_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsMarqueeCurrentTrackEnabled = (enabled) => {
    setIsMarqueeCurrentTrackEnabled(enabled);
    localStorage.setItem(MARQUEE_CURRENT_ENABLED_KEY, JSON.stringify(enabled));
  };
  
  const handleSetIsMarqueeNextTrackEnabled = (enabled) => {
    setIsMarqueeNextTrackEnabled(enabled);
    localStorage.setItem(MARQUEE_NEXT_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetMarqueeSpeed = (speed) => {
      setMarqueeSpeed(speed);
      localStorage.setItem(MARQUEE_SPEED_KEY, JSON.stringify(speed));
  };

  const handleSetMarqueeDelay = (delay) => {
      setMarqueeDelay(delay);
      localStorage.setItem(MARQUEE_DELAY_KEY, JSON.stringify(delay));
  };

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
      case 'name_asc':
        stationsToSort.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        break;
      case 'name_desc':
        stationsToSort.sort((a, b) => b.name.localeCompare(a.name, 'he'));
        break;
      case 'category_style':
      case 'category_identity':
      case 'category_region':
      case 'category_nameStructure':
        const categoryType = sortOrder.replace('category_', '');
        stationsToSort.sort((a, b) => {
            const categoryA = getCategory(a, categoryType);
            const categoryB = getCategory(b, categoryType);
            if (categoryA < categoryB) return -1;
            if (categoryA > categoryB) return 1;
            return a.name.localeCompare(b.name, 'he'); // secondary sort by name
        });
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

  const handleSelectStation = useCallback((station) => {
      dispatch({ type: 'SELECT_STATION', payload: station });
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playerState.station) {
      dispatch({ type: 'TOGGLE_PAUSE' });
    } else if (displayedStations.length > 0) {
      dispatch({ type: 'PLAY', payload: displayedStations[0] });
    }
  }, [playerState.station, displayedStations]);
  
  const handleNext = useCallback(() => {
      if (displayedStations.length === 0) return;
      
      const currentIndexInDisplayed = playerState.station
        ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid)
        : -1;

      const nextIndexInDisplayed = (currentIndexInDisplayed === -1) 
        ? 0 
        : (currentIndexInDisplayed + 1) % displayedStations.length;
      
      const nextStation = displayedStations[nextIndexInDisplayed];
      dispatch({ type: 'SELECT_STATION', payload: nextStation });
  }, [displayedStations, playerState.station]);

  const handlePrev = useCallback(() => {
      if (displayedStations.length === 0) return;

      const currentIndexInDisplayed = playerState.station
        ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid)
        : -1;
      
      const prevIndexInDisplayed = (currentIndexInDisplayed <= 0) 
        ? displayedStations.length - 1 
        : currentIndexInDisplayed - 1;

      const prevStation = displayedStations[prevIndexInDisplayed];
      dispatch({ type: 'SELECT_STATION', payload: prevStation });
  }, [displayedStations, playerState.station]);
    
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
  
  const handleCategorySortClick = () => {
    const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
    const isCategorySortActive = currentCategoryIndex !== -1;

    if (isCategorySortActive) {
        const nextIndex = (currentCategoryIndex + 1) % CATEGORY_SORTS.length;
        setSortOrder(CATEGORY_SORTS[nextIndex].order);
    } else {
        // If it's not a category sort, start from the first one
        setSortOrder(CATEGORY_SORTS[0].order);
    }
  };

  const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
  const isCategorySortActive = currentCategoryIndex !== -1;
  const categoryButtonLabel = isCategorySortActive ? CATEGORY_SORTS[currentCategoryIndex].label : "קטגוריות";

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
                    React.createElement(SortButton, { label: "שלי", order: "custom", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "פופולריות", order: "priority", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement("button", {
                      onClick: () => {
                        if (sortOrder === 'name_asc') {
                          setSortOrder('name_desc');
                        } else {
                          setSortOrder('name_asc');
                        }
                      },
                      className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        sortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`
                    }, sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'),
                    React.createElement("button", {
                      onClick: handleCategorySortClick,
                      className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        isCategorySortActive ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`
                    }, categoryButtonLabel)
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
                    currentStation: playerState.station,
                    onSelectStation: handleSelectStation,
                    isFavorite: isFavorite,
                    toggleFavorite: toggleFavorite,
                    onReorder: handleReorder,
                    isStreamActive: playerState.status === 'PLAYING',
                    isStatusIndicatorEnabled: isStatusIndicatorEnabled,
                    gridSize: gridSize,
                    sortOrder: sortOrder
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
        onGridSizeChange: handleSetGridSize,
        isMarqueeProgramEnabled: isMarqueeProgramEnabled,
        onMarqueeProgramEnabledChange: handleSetIsMarqueeProgramEnabled,
        isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled,
        onMarqueeCurrentTrackEnabledChange: handleSetIsMarqueeCurrentTrackEnabled,
        isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled,
        onMarqueeNextTrackEnabledChange: handleSetIsMarqueeNextTrackEnabled,
        marqueeSpeed: marqueeSpeed,
        onMarqueeSpeedChange: handleSetMarqueeSpeed,
        marqueeDelay: marqueeDelay,
        onMarqueeDelayChange: handleSetMarqueeDelay
      }),
      playerState.station && React.createElement(NowPlaying, {
        isOpen: isNowPlayingOpen,
        onClose: () => setIsNowPlayingOpen(false),
        station: playerState.station,
        isPlaying: playerState.status === 'PLAYING',
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
        marqueeDelay: marqueeDelay,
        isMarqueeProgramEnabled: isMarqueeProgramEnabled,
        isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled,
        isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled,
        marqueeSpeed: marqueeSpeed
      }),
      React.createElement(Player, {
        playerState: playerState,
        onPlayPause: handlePlayPause,
        onNext: handleNext,
        onPrev: handlePrev,
        onPlayerEvent: (event) => dispatch(event),
        eqPreset: eqPreset,
        customEqSettings: customEqSettings,
        volume: volume,
        onVolumeChange: handleSetVolume,
        trackInfo: trackInfo,
        showNextSong: showNextSong,
        onOpenNowPlaying: () => setIsNowPlayingOpen(true),
        setFrequencyData: setFrequencyData,
        frequencyData: frequencyData,
        isVisualizerEnabled: isPlayerBarVisualizerEnabled,
        marqueeDelay: marqueeDelay,
        isMarqueeProgramEnabled: isMarqueeProgramEnabled,
        isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled,
        isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled,
        marqueeSpeed: marqueeSpeed
      })
    )
  );
}
