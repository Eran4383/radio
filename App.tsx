import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService';
import { Station, Theme, EqPreset, THEMES, EQ_PRESET_KEYS, VisualizerStyle, VISUALIZER_STYLES, CustomEqSettings, StationTrackInfo, GridSize, SortOrder, GRID_SIZES } from './types';
import Player from './components/Player';
import StationList from './components/StationList';
import SettingsPanel from './components/SettingsPanel';
import NowPlaying from './components/NowPlaying';
import ActionMenu from './components/ActionMenu';
import { PRIORITY_STATIONS } from './constants';
import { MenuIcon } from './components/Icons';
import { getCurrentProgram } from './services/scheduleService';
import { fetchStationSpecificTrackInfo, hasSpecificHandler } from './services/stationSpecificService';
import StationListSkeleton from './components/StationListSkeleton';
import { getCategory, CategoryType } from './services/categoryService';
import { auth, signInWithGoogle, signOut, saveUserSettings, loadUserSettings } from './services/firebase';
import type firebase from 'firebase/compat/app';


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
        if (parsedValue === null && defaultValue !== null) {
            return defaultValue;
        }
        return parsedValue;
    } catch (e) {
        return defaultValue;
    }
}

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
};


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

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'found' | 'not-found' | 'error';

interface AppProps {
  initialUser: firebase.User | null;
}

export default function App({ initialUser }: AppProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isVisualizerFullscreen, setIsVisualizerFullscreen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState<StationTrackInfo | null>(null);
  const pinchDistRef = useRef(0);
  const PINCH_THRESHOLD = 40; // pixels
  const [actionMenuState, setActionMenuState] = useState<{isOpen: boolean; songTitle: string | null}>({ isOpen: false, songTitle: null });

  const [user, setUser] = useState<firebase.User | null>(initialUser);
  
  // Flag to indicate if initial settings have been loaded, preventing race conditions
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // --- Centralized Settings State with default values for guest user ---
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  const [eqPreset, setEqPreset] = useState<EqPreset>('flat');
  const [customEqSettings, setCustomEqSettings] = useState<CustomEqSettings>({ bass: 0, mid: 0, treble: 0 });
  const [volume, setVolume] = useState<number>(1);
  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState<boolean>(true);
  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState<boolean>(true);
  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>('bars');
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState<boolean>(true);
  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState<boolean>(true);
  const [showNextSong, setShowNextSong] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [isMarqueeProgramEnabled, setIsMarqueeProgramEnabled] = useState<boolean>(true);
  const [isMarqueeCurrentTrackEnabled, setIsMarqueeCurrentTrackEnabled] = useState<boolean>(true);
  const [isMarqueeNextTrackEnabled, setIsMarqueeNextTrackEnabled] = useState<boolean>(true);
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(6);
  const [marqueeDelay, setMarqueeDelay] = useState<number>(3);
  const [filter, setFilter] = useState<StationFilter>(StationFilter.All);
  const [sortOrder, setSortOrder] = useState<SortOrder>('priority');

  const isFavorite = useCallback((stationUuid: string) => favorites.includes(stationUuid), [favorites]);

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  // Combine all settings into a single object for easier saving
  const allSettings = useMemo(() => ({
    favorites, customOrder, theme, eqPreset, customEqSettings, volume,
    isNowPlayingVisualizerEnabled, isPlayerBarVisualizerEnabled, visualizerStyle,
    isStatusIndicatorEnabled, isVolumeControlVisible, showNextSong, gridSize,
    isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled,
    marqueeSpeed, marqueeDelay, filter, sortOrder
  }), [
    favorites, customOrder, theme, eqPreset, customEqSettings, volume,
    isNowPlayingVisualizerEnabled, isPlayerBarVisualizerEnabled, visualizerStyle,
    isStatusIndicatorEnabled, isVolumeControlVisible, showNextSong, gridSize,
    isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled,
    marqueeSpeed, marqueeDelay, filter, sortOrder
  ]);

  // Function to load settings from localStorage for a guest user
  const loadGuestSettings = useCallback(() => {
    setFavorites(safeJsonParse(localStorage.getItem('radio-favorites'), []));
    setCustomOrder(safeJsonParse(localStorage.getItem('radio-station-custom-order'), []));
    setTheme(safeJsonParse(localStorage.getItem('radio-theme'), 'dark') as Theme);
    setEqPreset(safeJsonParse(localStorage.getItem('radio-eq'), 'flat') as EqPreset);
    setCustomEqSettings(safeJsonParse(localStorage.getItem('radio-custom-eq'), { bass: 0, mid: 0, treble: 0 }));
    setVolume(safeJsonParse(localStorage.getItem('radio-volume'), 1));
    setIsNowPlayingVisualizerEnabled(safeJsonParse(localStorage.getItem('radio-nowplaying-visualizer-enabled'), true));
    setIsPlayerBarVisualizerEnabled(safeJsonParse(localStorage.getItem('radio-playerbar-visualizer-enabled'), true));
    setVisualizerStyle(safeJsonParse(localStorage.getItem('radio-visualizer-style'), 'bars') as VisualizerStyle);
    setIsStatusIndicatorEnabled(safeJsonParse(localStorage.getItem('radio-status-indicator-enabled'), true));
    setIsVolumeControlVisible(safeJsonParse(localStorage.getItem('radio-volume-control-visible'), true));
    setShowNextSong(safeJsonParse(localStorage.getItem('radio-show-next-song'), true));
    setGridSize(safeJsonParse(localStorage.getItem('radio-grid-size'), 3) as GridSize);
    setIsMarqueeProgramEnabled(safeJsonParse(localStorage.getItem('radio-marquee-program-enabled'), true));
    setIsMarqueeCurrentTrackEnabled(safeJsonParse(localStorage.getItem('radio-marquee-current-enabled'), true));
    setIsMarqueeNextTrackEnabled(safeJsonParse(localStorage.getItem('radio-marquee-next-enabled'), true));
    setMarqueeSpeed(safeJsonParse(localStorage.getItem('radio-marquee-speed'), 6));
    setMarqueeDelay(safeJsonParse(localStorage.getItem('radio-marquee-delay'), 3));
    const savedFilter = localStorage.getItem('radio-last-filter');
    setFilter((savedFilter && Object.values(StationFilter).includes(savedFilter as StationFilter)) ? savedFilter as StationFilter : StationFilter.All);
    setSortOrder(safeJsonParse(localStorage.getItem('radio-last-sort'), 'priority') as SortOrder);
    setSettingsLoaded(true);
  }, []);

  // Effect to load settings based on user state. This is the core of the new data separation logic.
  useEffect(() => {
    const loadAllSettings = async () => {
      setSettingsLoaded(false);
      if (user) {
        const userSettings = await loadUserSettings(user.uid);
        if (userSettings) {
          // Apply settings from Firestore
          setFavorites(userSettings.favorites || []);
          setCustomOrder(userSettings.customOrder || []);
          setTheme(userSettings.theme || 'dark');
          setEqPreset(userSettings.eqPreset || 'flat');
          setCustomEqSettings(userSettings.customEqSettings || { bass: 0, mid: 0, treble: 0 });
          setVolume(userSettings.volume ?? 1);
          setIsNowPlayingVisualizerEnabled(userSettings.isNowPlayingVisualizerEnabled ?? true);
          setIsPlayerBarVisualizerEnabled(userSettings.isPlayerBarVisualizerEnabled ?? true);
          setVisualizerStyle(userSettings.visualizerStyle || 'bars');
          setIsStatusIndicatorEnabled(userSettings.isStatusIndicatorEnabled ?? true);
          setIsVolumeControlVisible(userSettings.isVolumeControlVisible ?? true);
          setShowNextSong(userSettings.showNextSong ?? true);
          setGridSize(userSettings.gridSize || 3);
          setIsMarqueeProgramEnabled(userSettings.isMarqueeProgramEnabled ?? true);
          setIsMarqueeCurrentTrackEnabled(userSettings.isMarqueeCurrentTrackEnabled ?? true);
          setIsMarqueeNextTrackEnabled(userSettings.isMarqueeNextTrackEnabled ?? true);
          setMarqueeSpeed(userSettings.marqueeSpeed || 6);
          setMarqueeDelay(userSettings.marqueeDelay || 3);
          setFilter(userSettings.filter || StationFilter.All);
          setSortOrder(userSettings.sortOrder || 'priority');
        } else {
          // First login: migrate local settings to Firestore
          const guestSettings = {
            favorites: safeJsonParse(localStorage.getItem('radio-favorites'), []),
            customOrder: safeJsonParse(localStorage.getItem('radio-station-custom-order'), []),
            theme: safeJsonParse(localStorage.getItem('radio-theme'), 'dark'),
            // ... load all other settings from localStorage
          };
          await saveUserSettings(user.uid, guestSettings);
          // And apply them to the current state
          setFavorites(guestSettings.favorites);
          setCustomOrder(guestSettings.customOrder);
          setTheme(guestSettings.theme as Theme);
        }
      } else {
        // User is logged out, load from localStorage
        loadGuestSettings();
      }
      setSettingsLoaded(true);
    };

    loadAllSettings();
  }, [user, loadGuestSettings]);


  // Debounced save to Firestore
  const debouncedSave = useCallback(debounce((settings, userId) => {
    saveUserSettings(userId, settings);
  }, 2000), []);

  // Effect to save settings whenever they change
  useEffect(() => {
    // Only save if the initial settings have been loaded to prevent overwriting
    if (!settingsLoaded) return;

    if (user) {
      // User is logged in, save to Firestore
      debouncedSave(allSettings, user.uid);
    } else {
      // User is a guest, save to localStorage
      Object.entries(allSettings).forEach(([key, value]) => {
        const lsKey = `radio-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        localStorage.setItem(lsKey, JSON.stringify(value));
      });
      // Legacy keys for simpler settings
      localStorage.setItem('radio-last-filter', filter);
      localStorage.setItem('radio-last-sort', sortOrder);
      localStorage.setItem('radio-favorites', JSON.stringify(favorites));
    }
  }, [allSettings, user, settingsLoaded, debouncedSave, filter, sortOrder, favorites]);
  
  const handleLogin = async () => {
    const loggedInUser = await signInWithGoogle();
    if (loggedInUser) {
      setUser(loggedInUser); // This state change will trigger the useEffect to load user settings
    }
  };
  
  const handleLogout = async () => {
    if (user) {
      try {
        await saveUserSettings(user.uid, allSettings); // Final save before logging out
        await signOut();
        setUser(null); // This state change will trigger the useEffect to load guest settings. No page reload needed.
      } catch (error) {
        console.error("Error during logout:", error);
      }
    }
  };

  // Service worker and stations loading effects remain largely the same
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').then(registration => {
        registration.onupdatefound = () => {
          setUpdateStatus('downloading');
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorkerRef.current = installingWorker;
                setIsUpdateAvailable(true);
                setUpdateStatus('found');
              }
            };
          }
        };
      }).catch(error => console.error('SW reg failed:', error));
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          window.location.reload();
          refreshing = true;
        }
      });
    }
  }, []);

  const handleManualUpdateCheck = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.ready) {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
      return;
    }
    setUpdateStatus('checking');
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      setTimeout(() => {
        setUpdateStatus(cs => cs === 'checking' ? 'not-found' : cs);
        if (updateStatus === 'not-found') setTimeout(() => setUpdateStatus('idle'), 3000);
      }, 5000);
    } catch (error) {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  }, [updateStatus]);

  const handleUpdateClick = () => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
      setIsUpdateAvailable(false);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedStations = await fetchIsraeliStations();
        if (fetchedStations.length === 0) setError('לא הצלחנו למצוא תחנות. נסה לרענן את העמוד.');
        else setStations(fetchedStations);
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
    if (stations.length > 0 && playerState.status === 'IDLE' && settingsLoaded) {
        const lastStationUuid = localStorage.getItem('radio-last-station-uuid');
        if (lastStationUuid) {
            const station = stations.find(s => s.stationuuid === lastStationUuid);
            if (station) dispatch({ type: 'SELECT_STATION', payload: station });
        }
    }
  }, [stations, playerState.status, settingsLoaded]);

  useEffect(() => {
      if (playerState.station) {
          localStorage.setItem('radio-last-station-uuid', playerState.station.stationuuid);
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
        if (!finalInfo.program) finalInfo.program = getCurrentProgram(name);
      } else {
        const [songTitle, programName] = await Promise.all([ fetchLiveTrackInfo(stationuuid), getCurrentProgram(name) ]);
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
    return () => clearInterval(intervalId);
  }, [playerState.station]);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const toggleFavorite = useCallback((stationUuid: string) => {
    setFavorites(currentFavorites =>
      currentFavorites.includes(stationUuid)
        ? currentFavorites.filter(uuid => uuid !== stationUuid)
        : [...currentFavorites, stationUuid]
    );
  }, []);

  const saveCustomOrder = (newOrder: string[]) => {
      setCustomOrder(newOrder);
      setSortOrder('custom');
  };

  const handleReorder = (reorderedDisplayedUuids: string[]) => {
      const allStationUuids = stations.map(s => s.stationuuid);
      const currentOrderUuids = customOrder.length > 0 ? customOrder : allStationUuids;
      const reorderedSet = new Set(reorderedDisplayedUuids);
      const newOrder = [...reorderedDisplayedUuids, ...currentOrderUuids.filter(uuid => !reorderedSet.has(uuid))];
      saveCustomOrder(newOrder);
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
      case 'name_asc': stationsToSort.sort((a, b) => a.name.localeCompare(b.name, 'he')); break;
      case 'name_desc': stationsToSort.sort((a, b) => b.name.localeCompare(a.name, 'he')); break;
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
            return a.name.localeCompare(b.name, 'he');
        });
        break;
      case 'priority':
      default:
        const getPriorityIndex = (stationName: string) => PRIORITY_STATIONS.findIndex(ps => ps.aliases.some(alias => stationName.toLowerCase().includes(alias.toLowerCase())));
        stationsToSort.sort((a, b) => {
          let aP = getPriorityIndex(a.name); let bP = getPriorityIndex(b.name);
          if (aP === -1) aP = Infinity; if (bP === -1) bP = Infinity;
          return aP !== bP ? aP - bP : a.name.localeCompare(b.name, 'he');
        });
        break;
    }
    return stationsToSort;
  }, [filteredStations, sortOrder, customOrder]);

  const handleSelectStation = useCallback((station: Station) => dispatch({ type: 'SELECT_STATION', payload: station }), []);
  const handlePlayPause = useCallback(() => {
    if (playerState.station) dispatch({ type: 'TOGGLE_PAUSE' });
    else if (displayedStations.length > 0) dispatch({ type: 'PLAY', payload: displayedStations[0] });
  }, [playerState.station, displayedStations]);
  const handlePlay = useCallback(async () => {
    if (playerState.status === 'PLAYING') return;
    if (playerState.station) dispatch({ type: 'TOGGLE_PAUSE' });
    else if (displayedStations.length > 0) dispatch({ type: 'PLAY', payload: displayedStations[0] });
  }, [playerState.status, playerState.station, displayedStations]);
  const handlePause = useCallback(async () => { if (playerState.status === 'PLAYING') dispatch({ type: 'TOGGLE_PAUSE' }); }, [playerState.status]);
  const handleNext = useCallback(async () => {
      if (displayedStations.length === 0) return;
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station!.stationuuid) : -1;
      handleSelectStation(displayedStations[(currentIndex + 1) % displayedStations.length]);
  }, [displayedStations, playerState.station, handleSelectStation]);
  const handlePrev = useCallback(async () => {
      if (displayedStations.length === 0) return;
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station!.stationuuid) : -1;
      handleSelectStation(displayedStations[(currentIndex - 1 + displayedStations.length) % displayedStations.length]);
  }, [displayedStations, playerState.station, handleSelectStation]);
    
  const handleTouchStart = useCallback((e: React.TouchEvent) => { if (e.touches.length === 2) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; pinchDistRef.current = Math.sqrt(dx * dx + dy * dy); } }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistRef.current > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      const delta = currentDist - pinchDistRef.current;
      if (Math.abs(delta) > PINCH_THRESHOLD) {
        setGridSize(gs => delta > 0 ? Math.min(5, gs + 1) as GridSize : Math.max(1, gs - 1) as GridSize);
        pinchDistRef.current = currentDist;
      }
    }
  }, []);
  const handleTouchEnd = useCallback(() => { pinchDistRef.current = 0; }, []);
  
  const handleCategorySortClick = () => {
    const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
    const nextIndex = currentCategoryIndex !== -1 ? (currentCategoryIndex + 1) % CATEGORY_SORTS.length : 0;
    setSortOrder(CATEGORY_SORTS[nextIndex].order);
  };

  const openActionMenu = useCallback((songTitle: string) => setActionMenuState({ isOpen: true, songTitle }), []);
  const closeActionMenu = useCallback(() => setActionMenuState({ isOpen: false, songTitle: null }), []);
  const handleCycleVisualizerStyle = useCallback(() => setVisualizerStyle(vs => VISUALIZER_STYLES[(VISUALIZER_STYLES.indexOf(vs) + 1) % VISUALIZER_STYLES.length]), []);
  
  const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
  const categoryButtonLabel = currentCategoryIndex !== -1 ? CATEGORY_SORTS[currentCategoryIndex].label : "קטגוריות";

  if (!settingsLoaded) {
    // While settings are loading for the first time, don't render the main UI
    // to prevent flicker. The loader in index.html covers this.
    return null;
  }

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
                    <button onClick={() => setSortOrder(so => so === 'name_asc' ? 'name_desc' : 'name_asc')} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${sortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>{sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'}</button>
                    <button onClick={handleCategorySortClick} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${currentCategoryIndex !== -1 ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>{categoryButtonLabel}</button>
                </div>
            </div>
        </div>
      </header>
      <main className="flex-grow pb-48" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {isLoading ? (
          <StationListSkeleton />
        ) : error ? (
          <p className="text-center text-red-400 p-4">{error}</p>
        ) : ( displayedStations.length > 0 ? (
                <StationList stations={displayedStations} currentStation={playerState.station} onSelectStation={handleSelectStation} isFavorite={isFavorite} toggleFavorite={toggleFavorite} onReorder={handleReorder} isStreamActive={playerState.status === 'PLAYING'} isStatusIndicatorEnabled={isStatusIndicatorEnabled} gridSize={gridSize} sortOrder={sortOrder} />
            ) : ( <div className="text-center p-8 text-text-secondary"><h2 className="text-xl font-semibold">{filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'}</h2><p>{filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.'}</p></div> )
        )}
      </main>
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={theme} onThemeChange={setTheme} currentEqPreset={eqPreset} onEqPresetChange={setEqPreset} isNowPlayingVisualizerEnabled={isNowPlayingVisualizerEnabled} onNowPlayingVisualizerEnabledChange={setIsNowPlayingVisualizerEnabled} isPlayerBarVisualizerEnabled={isPlayerBarVisualizerEnabled} onPlayerBarVisualizerEnabledChange={setIsPlayerBarVisualizerEnabled} isStatusIndicatorEnabled={isStatusIndicatorEnabled} onStatusIndicatorEnabledChange={setIsStatusIndicatorEnabled} isVolumeControlVisible={isVolumeControlVisible} onVolumeControlVisibleChange={setIsVolumeControlVisible} showNextSong={showNextSong} onShowNextSongChange={setShowNextSong} customEqSettings={customEqSettings} onCustomEqChange={setCustomEqSettings} gridSize={gridSize} onGridSizeChange={setGridSize} isMarqueeProgramEnabled={isMarqueeProgramEnabled} onMarqueeProgramEnabledChange={setIsMarqueeProgramEnabled} isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled} onMarqueeCurrentTrackEnabledChange={setIsMarqueeCurrentTrackEnabled} isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled} onMarqueeNextTrackEnabledChange={setIsMarqueeNextTrackEnabled} marqueeSpeed={marqueeSpeed} onMarqueeSpeedChange={setMarqueeSpeed} marqueeDelay={marqueeDelay} onMarqueeDelayChange={setMarqueeDelay} updateStatus={updateStatus} onManualUpdateCheck={handleManualUpdateCheck} user={user} onLogin={handleLogin} onLogout={handleLogout} />
      {/* FIX: Pass the correct 'openActionMenu' function to the 'onOpenActionMenu' prop to resolve the ReferenceError. */}
      {playerState.station && <NowPlaying isOpen={isNowPlayingOpen} onClose={() => !isVisualizerFullscreen && setIsNowPlayingOpen(false)} station={playerState.station} isPlaying={playerState.status === 'PLAYING'} onPlayPause={handlePlayPause} onNext={handleNext} onPrev={handlePrev} volume={volume} onVolumeChange={setVolume} trackInfo={trackInfo} showNextSong={showNextSong} frequencyData={frequencyData} visualizerStyle={visualizerStyle} isVisualizerEnabled={isNowPlayingVisualizerEnabled} onCycleVisualizerStyle={handleCycleVisualizerStyle} isVolumeControlVisible={isVolumeControlVisible} marqueeDelay={marqueeDelay} isMarqueeProgramEnabled={isMarqueeProgramEnabled} isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled} isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled} marqueeSpeed={marqueeSpeed} onOpenActionMenu={openActionMenu} isVisualizerFullscreen={isVisualizerFullscreen} setIsVisualizerFullscreen={setIsVisualizerFullscreen} />}
       <ActionMenu isOpen={actionMenuState.isOpen} onClose={closeActionMenu} songTitle={actionMenuState.songTitle} />
      <Player playerState={playerState} onPlay={handlePlay} onPause={handlePause} onPlayPause={handlePlayPause} onNext={handleNext} onPrev={handlePrev} onPlayerEvent={(event) => dispatch(event)} eqPreset={eqPreset} customEqSettings={customEqSettings} volume={volume} onVolumeChange={setVolume} trackInfo={trackInfo} showNextSong={showNextSong} onOpenNowPlaying={() => setIsNowPlayingOpen(true)} setFrequencyData={setFrequencyData} frequencyData={frequencyData} isVisualizerEnabled={isPlayerBarVisualizerEnabled} marqueeDelay={marqueeDelay} isMarqueeProgramEnabled={isMarqueeProgramEnabled} isMarqueeCurrentTrackEnabled={isMarqueeCurrentTrackEnabled} isMarqueeNextTrackEnabled={isMarqueeNextTrackEnabled} marqueeSpeed={marqueeSpeed} onOpenActionMenu={openActionMenu} />
      {isUpdateAvailable && ( <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 bg-accent text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in-up"><p className="text-sm font-semibold">עדכון חדש זמין</p><button onClick={handleUpdateClick} className="py-1 px-3 bg-white/20 hover:bg-white/40 rounded-md text-sm font-bold">רענן</button></div> )}
    </div>
  );
}