import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService';
import { Station, Theme, EqPreset, THEMES, EQ_PRESET_KEYS, VisualizerStyle, VISUALIZER_STYLES, CustomEqSettings, StationTrackInfo, GridSize, SortOrder, GRID_SIZES } from './types';
import Player from './components/Player';
import StationList from './components/StationList';
import SettingsPanel from './components/SettingsPanel';
import NowPlaying from './components/NowPlaying';
import ActionMenu from './components/ActionMenu';
import { useFavorites } from './hooks/useFavorites';
import { PRIORITY_STATIONS } from './constants';
import { MenuIcon } from './components/Icons';
import { getCurrentProgram } from './services/scheduleService';
import { fetchStationSpecificTrackInfo, hasSpecificHandler } from './services/stationSpecificService';
import StationListSkeleton from './components/StationListSkeleton';
import { getCategory, CategoryType } from './services/categoryService';


enum StationFilter {
  All = 'הכל',
  Favorites = 'מועדפים',
}

// Player State Machine
type PlayerStatus = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ERROR';
interface PlayerState {
  status: PlayerStatus;
  station: Station | null;
  error?: string;
}
type PlayerAction =
  | { type: 'PLAY'; payload: Station }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_PAUSED' }
  | { type: 'STREAM_ERROR'; payload: string }
  | { type: 'SELECT_STATION'; payload: Station };

const initialPlayerState: PlayerState = {
  status: 'IDLE',
  station: null,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
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
      return { status: 'LOADING', station: action.payload, error: undefined };
    case 'PLAY':
       return { ...state, status: 'LOADING', station: action.payload, error: undefined };
    case 'TOGGLE_PAUSE':
      if (state.status === 'PLAYING') {
        return { ...state, status: 'PAUSED' };
      }
      if (state.status === 'PAUSED' && state.station) {
        return { ...state, status: 'LOADING', error: undefined };
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

// Helper function for safely parsing JSON from localStorage
function safeJsonParse<T>(jsonString: string | null, defaultValue: T): T {
    if (jsonString === null) {
        return defaultValue;
    }
    try {
        const parsedValue = JSON.parse(jsonString);
        // Don't return null if the default isn't null.
        if (parsedValue === null && defaultValue !== null) {
            return defaultValue;
        }
        return parsedValue;
    } catch (e) {
        console.warn('Failed to parse JSON from localStorage. Returning default value.', e);
        return defaultValue;
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

const SortButton: React.FC<{ label: string; order: SortOrder; currentOrder: SortOrder; setOrder: (order: SortOrder) => void }> = ({ label, order, currentOrder, setOrder }) => (
  <button
    onClick={() => setOrder(order)}
    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
      currentOrder === order ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
    }`}
  >
    {label}
  </button>
);

const CATEGORY_SORTS: { order: SortOrder; label: string }[] = [
    { order: 'category_style', label: 'סגנון' },
    { order: 'category_identity', label: 'אופי' },
    { order: 'category_region', label: 'אזור' },
    { order: 'category_nameStructure', label: 'שם' },
];

export default function App() {
  const [stations, setStations] = useState<Station[]>([]);
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState<StationTrackInfo | null>(null);
  const pinchDistRef = useRef(0);
  const PINCH_THRESHOLD = 40; // pixels
  const [actionMenuState, setActionMenuState] = useState<{isOpen: boolean; songTitle: string | null}>({ isOpen: false, songTitle: null });

  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    return safeJsonParse(localStorage.getItem(CUSTOM_ORDER_KEY), []);
  });

  const [filter, setFilter] = useState<StationFilter>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') === 'favorites') {
      return StationFilter.Favorites;
    }
    const saved = localStorage.getItem(LAST_FILTER_KEY);
    return (saved && Object.values(StationFilter).includes(saved as StationFilter)) ? saved as StationFilter : StationFilter.All;
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    let savedSort = localStorage.getItem(LAST_SORT_KEY);
    if (savedSort === 'name') savedSort = 'name_asc';
    if (savedSort === 'tags') savedSort = 'category_style';
    const customOrderExists = !!localStorage.getItem(CUSTOM_ORDER_KEY);
    if (savedSort) {
      if (savedSort === 'custom' && !customOrderExists) {
        // Fallback
      } else {
        return savedSort as SortOrder;
      }
    }
    return customOrderExists ? 'custom' : 'priority';
  });
  
  const [theme, setTheme] = useState<Theme>(() => {
      const saved = localStorage.getItem(THEME_KEY) as Theme;
      return (saved && THEMES.includes(saved)) ? saved : 'dark';
  });

  const [eqPreset, setEqPreset] = useState<EqPreset>(() => {
      const saved = localStorage.getItem(EQ_KEY) as EqPreset;
      return (saved && EQ_PRESET_KEYS.includes(saved)) ? saved : 'flat';
  });
  
  const [customEqSettings, setCustomEqSettings] = useState<CustomEqSettings>(() => {
    return safeJsonParse(localStorage.getItem(CUSTOM_EQ_KEY), { bass: 0, mid: 0, treble: 0 });
  });

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved === null) return 1;
    const parsed = parseFloat(saved);
    return isNaN(parsed) ? 1 : parsed;
  });

  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState(() => {
      return safeJsonParse(localStorage.getItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY), true);
  });

  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState(() => {
      return safeJsonParse(localStorage.getItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY), true);
  });

  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>(() => {
      const saved = localStorage.getItem(VISUALIZER_STYLE_KEY) as VisualizerStyle;
      return (saved && VISUALIZER_STYLES.includes(saved)) ? saved : 'bars';
  });
  
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState(() => {
    return safeJsonParse(localStorage.getItem(STATUS_INDICATOR_ENABLED_KEY), true);
  });

  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState(() => {
      return safeJsonParse(localStorage.getItem(VOLUME_CONTROL_VISIBLE_KEY), true);
  });
  
  const [showNextSong, setShowNextSong] = useState(() => {
      return safeJsonParse(localStorage.getItem(SHOW_NEXT_SONG_KEY), true);
  });
    
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const size = safeJsonParse(localStorage.getItem(GRID_SIZE_KEY), 3);
    return GRID_SIZES.includes(size as GridSize) ? size as GridSize : 3;
  });
  
  const [isMarqueeProgramEnabled, setIsMarqueeProgramEnabled] = useState(() => {
    return safeJsonParse(localStorage.getItem(MARQUEE_PROGRAM_ENABLED_KEY), true);
  });

  const [isMarqueeCurrentTrackEnabled, setIsMarqueeCurrentTrackEnabled] = useState(() => {
    return safeJsonParse(localStorage.getItem(MARQUEE_CURRENT_ENABLED_KEY), true);
  });
  
  const [isMarqueeNextTrackEnabled, setIsMarqueeNextTrackEnabled] = useState(() => {
    return safeJsonParse(localStorage.getItem(MARQUEE_NEXT_ENABLED_KEY), true);
  });
  
  const [marqueeSpeed, setMarqueeSpeed] = useState(() => {
    return safeJsonParse(localStorage.getItem(MARQUEE_SPEED_KEY), 6);
  });

  const [marqueeDelay, setMarqueeDelay] = useState(() => {
      return safeJsonParse(localStorage.getItem(MARQUEE_DELAY_KEY), 3);
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
                dispatch({ type: 'SELECT_STATION', payload: station });
            }
        }
    }
  }, [stations, playerState.status]);

  useEffect(() => {
      if (playerState.station) {
          localStorage.setItem(LAST_STATION_KEY, playerState.station.stationuuid);
      }
  }, [playerState.station]);

  useEffect(() => {
    let intervalId: number;
    const fetchAndSetInfo = async () => {
      if (!playerState.station) return;
      const { name, stationuuid } = playerState.station;
      
      let finalInfo: StationTrackInfo | null = null;
      
      if (hasSpecificHandler(name)) {
        const specificInfo = await fetchStationSpecificTrackInfo(name);
        finalInfo = specificInfo ? { ...specificInfo } : { program: null, current: null, next: null };
        if (!finalInfo.program) {
            finalInfo.program = getCurrentProgram(name);
        }
      } else {
        const [songTitle, programName] = await Promise.all([
          fetchLiveTrackInfo(stationuuid),
          getCurrentProgram(name)
        ]);
        const current = songTitle && songTitle.toLowerCase() !== name.toLowerCase() ? songTitle : null;
        finalInfo = { program: programName, current, next: null };
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('filter') !== 'favorites') {
        localStorage.setItem(LAST_FILTER_KEY, filter);
    }
  }, [filter]);

  useEffect(() => {
    localStorage.setItem(LAST_SORT_KEY, sortOrder);
  }, [sortOrder]);
  
  const handleSetVolume = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem(VOLUME_KEY, newVolume.toString());
  };

  const handleSetEqPreset = (preset: EqPreset) => {
    setEqPreset(preset);
    localStorage.setItem(EQ_KEY, preset);
  };
  
  const handleSetCustomEqSettings = (settings: CustomEqSettings) => {
    setCustomEqSettings(settings);
    localStorage.setItem(CUSTOM_EQ_KEY, JSON.stringify(settings));
  };
  
  const handleSetIsNowPlayingVisualizerEnabled = (enabled: boolean) => {
    setIsNowPlayingVisualizerEnabled(enabled);
    localStorage.setItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsPlayerBarVisualizerEnabled = (enabled: boolean) => {
    setIsPlayerBarVisualizerEnabled(enabled);
    localStorage.setItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY, JSON.stringify(enabled));
  };
  
  const handleSetStatusIndicatorEnabled = (enabled: boolean) => {
    setIsStatusIndicatorEnabled(enabled);
    localStorage.setItem(STATUS_INDICATOR_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsVolumeControlVisible = (visible: boolean) => {
    setIsVolumeControlVisible(visible);
    localStorage.setItem(VOLUME_CONTROL_VISIBLE_KEY, JSON.stringify(visible));
  };

  const handleSetShowNextSong = (enabled: boolean) => {
    setShowNextSong(enabled);
    localStorage.setItem(SHOW_NEXT_SONG_KEY, JSON.stringify(enabled));
  };
    
  const handleSetGridSize = useCallback((size: GridSize) => {
    setGridSize(size);
    localStorage.setItem(GRID_SIZE_KEY, JSON.stringify(size));
  }, []);
  
  const handleSetIsMarqueeProgramEnabled = (enabled: boolean) => {
    setIsMarqueeProgramEnabled(enabled);
    localStorage.setItem(MARQUEE_PROGRAM_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetIsMarqueeCurrentTrackEnabled = (enabled: boolean) => {
    setIsMarqueeCurrentTrackEnabled(enabled);
    localStorage.setItem(MARQUEE_CURRENT_ENABLED_KEY, JSON.stringify(enabled));
  };
  
  const handleSetIsMarqueeNextTrackEnabled = (enabled: boolean) => {
    setIsMarqueeNextTrackEnabled(enabled);
    localStorage.setItem(MARQUEE_NEXT_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetMarqueeSpeed = (speed: number) => {
      setMarqueeSpeed(speed);
      localStorage.setItem(MARQUEE_SPEED_KEY, JSON.stringify(speed));
  };

  const handleSetMarqueeDelay = (delay: number) => {
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


  const saveCustomOrder = (newOrder: string[]) => {
      setCustomOrder(newOrder);
      localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(newOrder));
  };

  const handleReorder = (reorderedDisplayedUuids: string[]) => {
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
      return stations.filter(s => isFavorite(s.stationuuid));
    }
    return stations;
  }, [stations, filter, isFavorite]);
  
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
        stationsToSort.sort((a, b) => b.name.localeCompare(b.name, 'he'));
        break;
      case 'category_style':
      case 'category_identity':
      case 'category_region':
      case 'category_nameStructure':
        const categoryType = sortOrder.replace('category_', '') as CategoryType;
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
        const getPriorityIndex = (stationName: string) => {
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

  const handleSelectStation = useCallback((station: Station) => {
      dispatch({ type: 'SELECT_STATION', payload: station });
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playerState.station) {
      dispatch({ type: 'TOGGLE_PAUSE' });
    } else if (displayedStations.length > 0) {
      dispatch({ type: 'PLAY', payload: displayedStations[0] });
    }
  }, [playerState.station, displayedStations]);
  
  // Specific async handlers for Media Session API to prevent notification shade from closing
  const handlePlay = useCallback(async () => {
    if (playerState.status === 'PLAYING') return;
    if (playerState.station) {
        dispatch({ type: 'TOGGLE_PAUSE' });
    } else if (displayedStations.length > 0) {
        dispatch({ type: 'PLAY', payload: displayedStations[0] });
    }
  }, [playerState.status, playerState.station, displayedStations]);
  
  const handlePause = useCallback(async () => {
    if (playerState.status === 'PLAYING') {
      dispatch({ type: 'TOGGLE_PAUSE' });
    }
  }, [playerState.status]);

  const handleNext = useCallback(async () => {
      if (displayedStations.length === 0) return;
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station!.stationuuid) : -1;
      const nextIndex = (currentIndex + 1) % displayedStations.length;
      handleSelectStation(displayedStations[nextIndex]);
  }, [displayedStations, playerState.station, handleSelectStation]);

  const handlePrev = useCallback(async () => {
      if (displayedStations.length === 0) return;
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station!.stationuuid) : -1;
      const prevIndex = (currentIndex - 1 + displayedStations.length) % displayedStations.length;
      handleSelectStation(displayedStations[prevIndex]);
  }, [displayedStations, playerState.station, handleSelectStation]);
    
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchDistRef.current > 0) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const delta = currentDist - pinchDistRef.current;

          if (Math.abs(delta) > PINCH_THRESHOLD) {
              if (delta > 0) {
                  const newSize = Math.min(5, gridSize + 1) as GridSize;
                  handleSetGridSize(newSize);
              } else {
                  const newSize = Math.max(1, gridSize - 1) as GridSize;
                  handleSetGridSize(newSize);
              }
              pinchDistRef.current = currentDist;
          }
      }
  }, [gridSize, handleSetGridSize]);

  const handleTouchEnd = useCallback(() => {
      pinchDistRef.current = 0;
  }, []);
  
  const handleCategorySortClick = () => {
    const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
    const isCategorySortActive = currentCategoryIndex !== -1;
    if (isCategorySortActive) {
        const nextIndex = (currentCategoryIndex + 1) % CATEGORY_SORTS.length;
        setSortOrder(CATEGORY_SORTS[nextIndex].order);
    } else {
        setSortOrder(CATEGORY_SORTS[0].order);
    }
  };

  const openActionMenu = useCallback((songTitle: string) => {
    setActionMenuState({ isOpen: true, songTitle });
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenuState({ isOpen: false, songTitle: null });
  }, []);

  const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
  const isCategorySortActive = currentCategoryIndex !== -1;
  const categoryButtonLabel = isCategorySortActive ? CATEGORY_SORTS[currentCategoryIndex].label : "קטגוריות";

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      <header className="p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-text-secondary hover:text-text-primary" aria-label="הגדרות">
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center bg-gray-700 rounded-full p-1">
              <button onClick={() => setFilter(StationFilter.All)} className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}`}>{StationFilter.All}</button>
              <button onClick={() => setFilter(StationFilter.Favorites)} className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}`}>{StationFilter.Favorites}</button>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-accent">רדיו פרימיום</h1>
        </div>
        <div className="max-w-7xl mx-auto mt-4">
            <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-text-secondary">מיון:</span>
                <div className="flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center">
                    <SortButton label="שלי" order="custom" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <SortButton label="פופולריות" order="priority" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <button
                      onClick={() => sortOrder === 'name_asc' ? setSortOrder('name_desc') : setSortOrder('name_asc')}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        sortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >{sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'}</button>
                    <button
                      onClick={handleCategorySortClick}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        isCategorySortActive ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >{categoryButtonLabel}</button>
                </div>
            </div>
        </div>
      </header>
      <main className="flex-grow pb-48" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {isLoading ? (
          <StationListSkeleton />
        ) : error ? (
          <p className="text-center text-red-400 p-4">{error}</p>
        ) : (
            displayedStations.length > 0 ? (
                <StationList
                    stations={displayedStations}
                    currentStation={playerState.station}
                    onSelectStation={handleSelectStation}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    onReorder={handleReorder}
                    isStreamActive={playerState.status === 'PLAYING'}
                    isStatusIndicatorEnabled={isStatusIndicatorEnabled}
                    gridSize={gridSize}
                    sortOrder={sortOrder}
                />
            ) : (
                <div className="text-center p-8 text-text-secondary">
                    <h2 className="text-xl font-semibold">{filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'}</h2>
                    <p>{filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.'}</p>
                </div>
            )
        )}
      </main>
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={setTheme}
        currentEqPreset={eqPreset}
        onEqPresetChange={handleSetEqPreset}
        isNowPlayingVisualizerEnabled={isNowPlayingVisualizerEnabled}
        onNowPlayingVisualizerEnabledChange={handleSetIsNowPlayingVisualizerEnabled}
        isPlayerBarVisualizerEnabled={isPlayerBarVisualizerEnabled}
        onPlayerBarVisualizerEnabledChange={handleSetIsPlayerBarVisualizerEnabled}
        isStatusIndicatorEnabled={isStatusIndicatorEnabled}
        onStatusIndicatorEnabledChange={handleSetStatusIndicatorEnabled}
        isVolumeControlVisible={isVolumeControlVisible}
        onVolumeControlVisibleChange={handleSetIsVolumeControlVisible}
        showNextSong={showNextSong}
        onShowNextSongChange={handleSetShowNextSong}
        customEqSettings={customEqSettings}
        onCustomEqChange={handleSetCustomEqSettings}
        gridSize={gridSize}
        onGridSizeChange={handleSetGridSize}
        isMarqueeProgramEnabled={isMarqueeProgramEnabled}
        onMarqueeProgramEnabledChange={handleSetIsMarqueeProgramEnabled}
        isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled}
        onMarqueeCurrentTrackEnabledChange={handleSetIsMarqueeCurrentTrackEnabled}
        isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled}
        onMarqueeNextTrackEnabledChange={handleSetIsMarqueeNextTrackEnabled}
        marqueeSpeed={marqueeSpeed}
        onMarqueeSpeedChange={handleSetMarqueeSpeed}
        marqueeDelay={marqueeDelay}
        onMarqueeDelayChange={handleSetMarqueeDelay}
      />
      {playerState.station && <NowPlaying
        isOpen={isNowPlayingOpen}
        onClose={() => setIsNowPlayingOpen(false)}
        station={playerState.station}
        isPlaying={playerState.status === 'PLAYING'}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        volume={volume}
        onVolumeChange={handleSetVolume}
        trackInfo={trackInfo}
        showNextSong={showNextSong}
        frequencyData={frequencyData}
        visualizerStyle={visualizerStyle}
        isVisualizerEnabled={isNowPlayingVisualizerEnabled}
        onCycleVisualizerStyle={handleCycleVisualizerStyle}
        isVolumeControlVisible={isVolumeControlVisible}
        marqueeDelay={marqueeDelay}
        isMarqueeProgramEnabled={isMarqueeProgramEnabled}
        isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled}
        isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled}
        marqueeSpeed={marqueeSpeed}
        onOpenActionMenu={openActionMenu}
      />}
       <ActionMenu
        isOpen={actionMenuState.isOpen}
        onClose={closeActionMenu}
        songTitle={actionMenuState.songTitle}
      />
      <Player
        playerState={playerState}
        onPlay={handlePlay}
        onPause={handlePause}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onPlayerEvent={(event) => dispatch(event)}
        eqPreset={eqPreset}
        customEqSettings={customEqSettings}
        volume={volume}
        onVolumeChange={handleSetVolume}
        trackInfo={trackInfo}
        showNextSong={showNextSong}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        setFrequencyData={setFrequencyData}
        frequencyData={frequencyData}
        isVisualizerEnabled={isPlayerBarVisualizerEnabled}
        marqueeDelay={marqueeDelay}
        isMarqueeProgramEnabled={isMarqueeProgramEnabled}
        isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled}
        isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled}
        marqueeSpeed={marqueeSpeed}
        onOpenActionMenu={openActionMenu}
      />
    </div>
  );
}