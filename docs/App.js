import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService.js';
import { THEMES, EQ_PRESET_KEYS, VISUALIZER_STYLES, GRID_SIZES } from './types.js';
import Player from './components/Player.js';
import StationList from './components/StationList.js';
import SettingsPanel from './components/SettingsPanel.js';
import NowPlaying from './components/NowPlaying.js';
import ActionMenu from './components/ActionMenu.js';
import { PRIORITY_STATIONS } from './constants.js';
import { MenuIcon } from './components/Icons.js';
import { getCurrentProgram } from './services/scheduleService.js';
import { fetchStationSpecificTrackInfo, hasSpecificHandler } from './services/stationSpecificService.js';
import StationListSkeleton from './components/StationListSkeleton.js';
import { getCategory } from './services/categoryService.js';
import { signInWithGoogle, signOut, saveUserSettings, loadUserSettings } from './services/firebase.js';

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
        if (state.status === 'PLAYING') {
          return { ...state, status: 'PAUSED' };
        } else if (state.status === 'PAUSED' || state.status === 'ERROR' || state.status === 'IDLE') {
          return { ...state, status: 'LOADING' };
        }
      }
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
      if (state.status === 'LOADING') return state;
      return { ...state, status: 'PAUSED' };
    case 'STREAM_ERROR':
      return { ...state, status: 'ERROR', error: action.payload };
    default:
      return state;
  }
}

function safeJsonParse(jsonString, defaultValue) {
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

const debounce = (func, waitFor) => {
  let timeout = null;
  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

const SortButton = ({ label, order, currentOrder, setOrder }) => (
  React.createElement("button", {
    onClick: () => setOrder(order),
    className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${
      currentOrder === order ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
    }`
  }, label)
);

const CATEGORY_SORTS = [
    { order: 'category_style', label: 'סגנון' },
    { order: 'category_identity', label: 'אופי' },
    { order: 'category_region', label: 'אזור' },
    { order: 'category_nameStructure', label: 'שם' },
];

export default function App({ initialUser }) {
  const [stations, setStations] = useState([]);
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isVisualizerFullscreen, setIsVisualizerFullscreen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState(null);
  const pinchDistRef = useRef(0);
  const PINCH_THRESHOLD = 40;
  const [actionMenuState, setActionMenuState] = useState({ isOpen: false, songTitle: null });

  const [user, setUser] = useState(initialUser);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [customOrder, setCustomOrder] = useState([]);
  const [theme, setTheme] = useState('dark');
  const [eqPreset, setEqPreset] = useState('flat');
  const [customEqSettings, setCustomEqSettings] = useState({ bass: 0, mid: 0, treble: 0 });
  const [volume, setVolume] = useState(1);
  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState(true);
  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState(true);
  const [visualizerStyle, setVisualizerStyle] = useState('bars');
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState(true);
  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState(true);
  const [showNextSong, setShowNextSong] = useState(true);
  const [gridSize, setGridSize] = useState(3);
  const [isMarqueeProgramEnabled, setIsMarqueeProgramEnabled] = useState(true);
  const [isMarqueeCurrentTrackEnabled, setIsMarqueeCurrentTrackEnabled] = useState(true);
  const [isMarqueeNextTrackEnabled, setIsMarqueeNextTrackEnabled] = useState(true);
  const [marqueeSpeed, setMarqueeSpeed] = useState(6);
  const [marqueeDelay, setMarqueeDelay] = useState(3);
  const [filter, setFilter] = useState(StationFilter.All);
  const [sortOrder, setSortOrder] = useState('priority');

  const isFavorite = useCallback((stationUuid) => favorites.includes(stationUuid), [favorites]);

  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef(null);
  const [updateStatus, setUpdateStatus] = useState('idle');

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

  const loadGuestSettings = useCallback(() => {
    setFavorites(safeJsonParse(localStorage.getItem('radio-favorites'), []));
    setCustomOrder(safeJsonParse(localStorage.getItem('radio-station-custom-order'), []));
    setTheme(safeJsonParse(localStorage.getItem('radio-theme'), 'dark'));
    setEqPreset(safeJsonParse(localStorage.getItem('radio-eq'), 'flat'));
    setCustomEqSettings(safeJsonParse(localStorage.getItem('radio-custom-eq'), { bass: 0, mid: 0, treble: 0 }));
    setVolume(safeJsonParse(localStorage.getItem('radio-volume'), 1));
    setIsNowPlayingVisualizerEnabled(safeJsonParse(localStorage.getItem('radio-nowplaying-visualizer-enabled'), true));
    setIsPlayerBarVisualizerEnabled(safeJsonParse(localStorage.getItem('radio-playerbar-visualizer-enabled'), true));
    setVisualizerStyle(safeJsonParse(localStorage.getItem('radio-visualizer-style'), 'bars'));
    setIsStatusIndicatorEnabled(safeJsonParse(localStorage.getItem('radio-status-indicator-enabled'), true));
    setIsVolumeControlVisible(safeJsonParse(localStorage.getItem('radio-volume-control-visible'), true));
    setShowNextSong(safeJsonParse(localStorage.getItem('radio-show-next-song'), true));
    setGridSize(safeJsonParse(localStorage.getItem('radio-grid-size'), 3));
    setIsMarqueeProgramEnabled(safeJsonParse(localStorage.getItem('radio-marquee-program-enabled'), true));
    setIsMarqueeCurrentTrackEnabled(safeJsonParse(localStorage.getItem('radio-marquee-current-enabled'), true));
    setIsMarqueeNextTrackEnabled(safeJsonParse(localStorage.getItem('radio-marquee-next-enabled'), true));
    setMarqueeSpeed(safeJsonParse(localStorage.getItem('radio-marquee-speed'), 6));
    setMarqueeDelay(safeJsonParse(localStorage.getItem('radio-marquee-delay'), 3));
    const savedFilter = localStorage.getItem('radio-last-filter');
    setFilter((savedFilter && Object.values(StationFilter).includes(savedFilter)) ? savedFilter : StationFilter.All);
    setSortOrder(safeJsonParse(localStorage.getItem('radio-last-sort'), 'priority'));
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    const loadAllSettings = async () => {
      setSettingsLoaded(false);
      if (user) {
        const result = await loadUserSettings(user.uid);
  
        switch (result.status) {
          case 'success':
            if (result.data) {
                setFavorites(result.data.favorites || []);
                setCustomOrder(result.data.customOrder || []);
                setTheme(result.data.theme || 'dark');
                setEqPreset(result.data.eqPreset || 'flat');
                setCustomEqSettings(result.data.customEqSettings || { bass: 0, mid: 0, treble: 0 });
                setVolume(result.data.volume ?? 1);
                setIsNowPlayingVisualizerEnabled(result.data.isNowPlayingVisualizerEnabled ?? true);
                setIsPlayerBarVisualizerEnabled(result.data.isPlayerBarVisualizerEnabled ?? true);
                setVisualizerStyle(result.data.visualizerStyle || 'bars');
                setIsStatusIndicatorEnabled(result.data.isStatusIndicatorEnabled ?? true);
                setIsVolumeControlVisible(result.data.isVolumeControlVisible ?? true);
                setShowNextSong(result.data.showNextSong ?? true);
                setGridSize(result.data.gridSize || 3);
                setIsMarqueeProgramEnabled(result.data.isMarqueeProgramEnabled ?? true);
                setIsMarqueeCurrentTrackEnabled(result.data.isMarqueeCurrentTrackEnabled ?? true);
                setIsMarqueeNextTrackEnabled(result.data.isMarqueeNextTrackEnabled ?? true);
                setMarqueeSpeed(result.data.marqueeSpeed || 6);
                setMarqueeDelay(result.data.marqueeDelay || 3);
                setFilter(result.data.filter || StationFilter.All);
                setSortOrder(result.data.sortOrder || 'priority');
            }
            break;
          case 'not-found':
            console.log("New user detected. Migrating local settings to cloud.");
            await saveUserSettings(user.uid, allSettings);
            break;
          case 'error':
            console.warn("Could not load user settings from cloud. Using local settings as fallback.");
            break;
        }
      } else {
        loadGuestSettings();
      }
      setSettingsLoaded(true);
    };
  
    loadAllSettings();
  }, [user, loadGuestSettings]);

  const debouncedSave = useCallback(debounce((settings, userId) => {
    saveUserSettings(userId, settings);
  }, 2000), []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (user) {
      debouncedSave(allSettings, user.uid);
    } else {
      Object.entries(allSettings).forEach(([key, value]) => {
        const lsKey = `radio-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        localStorage.setItem(lsKey, JSON.stringify(value));
      });
      localStorage.setItem('radio-last-filter', filter);
      localStorage.setItem('radio-last-sort', sortOrder);
      localStorage.setItem('radio-favorites', JSON.stringify(favorites));
    }
  }, [allSettings, user, settingsLoaded, debouncedSave, filter, sortOrder, favorites]);
  
  const handleLogin = async () => {
    const loggedInUser = await signInWithGoogle();
    if (loggedInUser) {
      setUser(loggedInUser);
    }
  };
  
  const handleLogout = async () => {
    if (user) {
      try {
        await saveUserSettings(user.uid, allSettings);
        await signOut();
        setUser(null);
      } catch (error) {
        console.error("Error during logout:", error);
      }
    }
  };

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
    let intervalId;
    const fetchAndSetInfo = async () => {
      if (!playerState.station) return;
      const { name, stationuuid } = playerState.station;
      let finalInfo = null;
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

  const toggleFavorite = useCallback((stationUuid) => {
    setFavorites(currentFavorites =>
      currentFavorites.includes(stationUuid)
        ? currentFavorites.filter(uuid => uuid !== stationUuid)
        : [...currentFavorites, stationUuid]
    );
  }, []);

  const saveCustomOrder = (newOrder) => {
      setCustomOrder(newOrder);
      setSortOrder('custom');
  };

  const handleReorder = (reorderedDisplayedUuids) => {
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
        const categoryType = sortOrder.replace('category_', '');
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
        const getPriorityIndex = (stationName) => PRIORITY_STATIONS.findIndex(ps => ps.aliases.some(alias => stationName.toLowerCase().includes(alias.toLowerCase())));
        stationsToSort.sort((a, b) => {
          let aP = getPriorityIndex(a.name); let bP = getPriorityIndex(b.name);
          if (aP === -1) aP = Infinity; if (bP === -1) bP = Infinity;
          return aP !== bP ? aP - bP : a.name.localeCompare(b.name, 'he');
        });
        break;
    }
    return stationsToSort;
  }, [filteredStations, sortOrder, customOrder]);

  const handleSelectStation = useCallback((station) => dispatch({ type: 'SELECT_STATION', payload: station }), []);
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
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid) : -1;
      handleSelectStation(displayedStations[(currentIndex + 1) % displayedStations.length]);
  }, [displayedStations, playerState.station, handleSelectStation]);
  const handlePrev = useCallback(async () => {
      if (displayedStations.length === 0) return;
      const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid) : -1;
      handleSelectStation(displayedStations[(currentIndex - 1 + displayedStations.length) % displayedStations.length]);
  }, [displayedStations, playerState.station, handleSelectStation]);
    
  const handleTouchStart = useCallback((e) => { if (e.touches.length === 2) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; pinchDistRef.current = Math.sqrt(dx * dx + dy * dy); } }, []);
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchDistRef.current > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      const delta = currentDist - pinchDistRef.current;
      if (Math.abs(delta) > PINCH_THRESHOLD) {
        setGridSize(gs => delta > 0 ? Math.min(5, gs + 1) : Math.max(1, gs - 1));
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

  const openActionMenu = useCallback((songTitle) => setActionMenuState({ isOpen: true, songTitle }), []);
  const closeActionMenu = useCallback(() => setActionMenuState({ isOpen: false, songTitle: null }), []);
  const handleCycleVisualizerStyle = useCallback(() => setVisualizerStyle(vs => VISUALIZER_STYLES[(VISUALIZER_STYLES.indexOf(vs) + 1) % VISUALIZER_STYLES.length]), []);
  
  const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === sortOrder);
  const categoryButtonLabel = currentCategoryIndex !== -1 ? CATEGORY_SORTS[currentCategoryIndex].label : "קטגוריות";

  if (!settingsLoaded) {
    return null;
  }

  return (
    React.createElement("div", { className: "min-h-screen bg-bg-primary text-text-primary flex flex-col" },
      React.createElement("header", { className: "p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md" },
        React.createElement("div", { className: "max-w-7xl mx-auto flex items-center justify-between gap-4" },
            React.createElement("button", { onClick: () => setIsSettingsOpen(true), className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הגדרות" },
              React.createElement(MenuIcon, { className: "w-6 h-6" })
            ),
            React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1" },
              React.createElement("button", { onClick: () => setFilter(StationFilter.All), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}` }, StationFilter.All),
              React.createElement("button", { onClick: () => setFilter(StationFilter.Favorites), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}` }, StationFilter.Favorites)
            ),
            React.createElement("h1", { className: "text-xl sm:text-2xl font-bold text-accent" }, "רדיו פרימיום")
        ),
        React.createElement("div", { className: "max-w-7xl mx-auto mt-4" },
            React.createElement("div", { className: "flex items-center justify-center gap-2" },
                React.createElement("span", { className: "text-xs text-text-secondary" }, "מיון:"),
                React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center" },
                    React.createElement(SortButton, { label: "שלי", order: "custom", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "פופולריות", order: "priority", currentOrder: sortOrder, setOrder: setSortOrder }),
                    React.createElement("button", { onClick: () => setSortOrder(so => so === 'name_asc' ? 'name_desc' : 'name_asc'), className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${sortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}` }, sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'),
                    React.createElement("button", { onClick: handleCategorySortClick, className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${currentCategoryIndex !== -1 ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}` }, categoryButtonLabel)
                )
            )
        )
      ),
      React.createElement("main", { className: "flex-grow pb-48", onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd },
        isLoading ? React.createElement(StationListSkeleton, null) :
        error ? React.createElement("p", { className: "text-center text-red-400 p-4" }, error) :
        displayedStations.length > 0 ?
            React.createElement(StationList, { stations: displayedStations, currentStation: playerState.station, onSelectStation: handleSelectStation, isFavorite: isFavorite, toggleFavorite: toggleFavorite, onReorder: handleReorder, isStreamActive: playerState.status === 'PLAYING', isStatusIndicatorEnabled: isStatusIndicatorEnabled, gridSize: gridSize, sortOrder: sortOrder }) :
            React.createElement("div", { className: "text-center p-8 text-text-secondary" },
                React.createElement("h2", { className: "text-xl font-semibold" }, filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'),
                React.createElement("p", null, filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.')
            )
      ),
      React.createElement(SettingsPanel, { isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false), currentTheme: theme, onThemeChange: setTheme, currentEqPreset: eqPreset, onEqPresetChange: setEqPreset, isNowPlayingVisualizerEnabled: isNowPlayingVisualizerEnabled, onNowPlayingVisualizerEnabledChange: setIsNowPlayingVisualizerEnabled, isPlayerBarVisualizerEnabled: isPlayerBarVisualizerEnabled, onPlayerBarVisualizerEnabledChange: setIsPlayerBarVisualizerEnabled, isStatusIndicatorEnabled: isStatusIndicatorEnabled, onStatusIndicatorEnabledChange: setIsStatusIndicatorEnabled, isVolumeControlVisible: isVolumeControlVisible, onVolumeControlVisibleChange: setIsVolumeControlVisible, showNextSong: showNextSong, onShowNextSongChange: setShowNextSong, customEqSettings: customEqSettings, onCustomEqChange: setCustomEqSettings, gridSize: gridSize, onGridSizeChange: setGridSize, isMarqueeProgramEnabled: isMarqueeProgramEnabled, onMarqueeProgramEnabledChange: setIsMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled, onMarqueeCurrentTrackEnabledChange: setIsMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled, onMarqueeNextTrackEnabledChange: setIsMarqueeNextTrackEnabled, marqueeSpeed: marqueeSpeed, onMarqueeSpeedChange: setMarqueeSpeed, marqueeDelay: marqueeDelay, onMarqueeDelayChange: setMarqueeDelay, updateStatus: updateStatus, onManualUpdateCheck: handleManualUpdateCheck, user: user, onLogin: handleLogin, onLogout: handleLogout }),
      playerState.station && React.createElement(NowPlaying, { isOpen: isNowPlayingOpen, onClose: () => !isVisualizerFullscreen && setIsNowPlayingOpen(false), station: playerState.station, isPlaying: playerState.status === 'PLAYING', onPlayPause: handlePlayPause, onNext: handleNext, onPrev: handlePrev, volume: volume, onVolumeChange: setVolume, trackInfo: trackInfo, showNextSong: showNextSong, frequencyData: frequencyData, visualizerStyle: visualizerStyle, isVisualizerEnabled: isNowPlayingVisualizerEnabled, onCycleVisualizerStyle: handleCycleVisualizerStyle, isVolumeControlVisible: isVolumeControlVisible, marqueeDelay: marqueeDelay, isMarqueeProgramEnabled: isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled, marqueeSpeed: marqueeSpeed, onOpenActionMenu: openActionMenu, isVisualizerFullscreen: isVisualizerFullscreen, setIsVisualizerFullscreen: setIsVisualizerFullscreen }),
      React.createElement(ActionMenu, { isOpen: actionMenuState.isOpen, onClose: closeActionMenu, songTitle: actionMenuState.songTitle }),
      React.createElement(Player, { playerState: playerState, onPlay: handlePlay, onPause: handlePause, onPlayPause: handlePlayPause, onNext: handleNext, onPrev: handlePrev, onPlayerEvent: (event) => dispatch(event), eqPreset: eqPreset, customEqSettings: customEqSettings, volume: volume, onVolumeChange: setVolume, trackInfo: trackInfo, showNextSong: showNextSong, onOpenNowPlaying: () => setIsNowPlayingOpen(true), setFrequencyData: setFrequencyData, frequencyData: frequencyData, isVisualizerEnabled: isPlayerBarVisualizerEnabled, marqueeDelay: marqueeDelay, isMarqueeProgramEnabled: isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled: isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled: isMarqueeNextTrackEnabled, marqueeSpeed: marqueeSpeed, onOpenActionMenu: openActionMenu }),
      isUpdateAvailable && React.createElement("div", { className: "fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 bg-accent text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in-up" },
        React.createElement("p", { className: "text-sm font-semibold" }, "עדכון חדש זמין"),
        React.createElement("button", { onClick: handleUpdateClick, className: "py-1 px-3 bg-white/20 hover:bg-white/40 rounded-md text-sm font-bold" }, "רענן")
      )
    )
  );
}