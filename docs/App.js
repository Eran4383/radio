
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService.js';
import { 
    signInWithGoogle, 
    signOutUser, 
    onAuthStateChangedListener,
    saveUserSettings,
    getUserSettings
} from './services/firebase.js';
import { THEMES, EQ_PRESET_KEYS, VISUALIZER_STYLES, GRID_SIZES, StationFilter } from './types.js';
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
import MergeDataModal from './components/MergeDataModal.js';


// Player State Machine
const initialPlayerState = {
  status: 'IDLE',
  station: null,
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'SELECT_STATION':
      if (state.station?.stationuuid === action.payload.stationuuid) {
        if (state.status === 'PLAYING') return { ...state, status: 'PAUSED' };
        else if (state.status === 'PAUSED' || state.status === 'ERROR' || state.status === 'IDLE') return { ...state, status: 'LOADING' };
      }
      return { status: 'LOADING', station: action.payload, error: undefined };
    case 'PLAY':
       return { ...state, status: 'LOADING', station: action.payload, error: undefined };
    case 'TOGGLE_PAUSE':
      if (state.status === 'PLAYING') return { ...state, status: 'PAUSED' };
      if (state.status === 'PAUSED' && state.station) return { ...state, status: 'LOADING', error: undefined };
      return state;
    case 'STREAM_STARTED':
      return { ...state, status: 'PLAYING', error: undefined };
    case 'STREAM_PAUSED':
        if(state.status === 'LOADING') return state;
        return { ...state, status: 'PAUSED' };
    case 'STREAM_ERROR':
      return { ...state, status: 'ERROR', error: action.payload };
    case 'AUTOPLAY_BLOCKED':
      // Browser blocked autoplay (user interaction needed). Switch to PAUSED without error.
      return { ...state, status: 'PAUSED', error: undefined };
    default:
      return state;
  }
}

function safeJsonParse(jsonString, defaultValue) {
    if (jsonString === null) return defaultValue;
    try {
        const parsedValue = JSON.parse(jsonString);
        return parsedValue === null ? defaultValue : parsedValue;
    } catch (e) {
        return defaultValue;
    }
}

const defaultSettings = {
    favorites: [], customOrder: [], theme: 'dark', eqPreset: 'flat',
    customEqSettings: { bass: 0, mid: 0, treble: 0 }, volume: 1,
    isNowPlayingVisualizerEnabled: false, isPlayerBarVisualizerEnabled: false,
    visualizerStyle: 'bars', isStatusIndicatorEnabled: true, isVolumeControlVisible: true,
    showNextSong: true, gridSize: 3, isMarqueeProgramEnabled: true,
    isMarqueeCurrentTrackEnabled: true, isMarqueeNextTrackEnabled: true,
    marqueeSpeed: 6, marqueeDelay: 3, filter: StationFilter.All, 
    sortOrderAll: 'priority',
    sortOrderFavorites: 'custom',
    keyMap: {
        playPause: [' ', 'Spacebar'],
        volumeUp: ['ArrowUp'],
        volumeDown: ['ArrowDown'],
        nextStation: ['ArrowRight'],
        prevStation: ['ArrowLeft'],
        toggleFullscreen: ['f', 'F', 'כ']
    }
};

const loadSettingsFromLocalStorage = () => {
    const oldSortOrder = safeJsonParse(localStorage.getItem('radio-last-sort'), null);

    return {
        favorites: safeJsonParse(localStorage.getItem('radio-favorites'), defaultSettings.favorites),
        customOrder: safeJsonParse(localStorage.getItem('radio-station-custom-order'), defaultSettings.customOrder),
        theme: safeJsonParse(localStorage.getItem('radio-theme'), defaultSettings.theme),
        eqPreset: safeJsonParse(localStorage.getItem('radio-eq'), defaultSettings.eqPreset),
        customEqSettings: safeJsonParse(localStorage.getItem('radio-custom-eq'), defaultSettings.customEqSettings),
        volume: safeJsonParse(localStorage.getItem('radio-volume'), defaultSettings.volume),
        isNowPlayingVisualizerEnabled: safeJsonParse(localStorage.getItem('radio-nowplaying-visualizer-enabled'), defaultSettings.isNowPlayingVisualizerEnabled),
        isPlayerBarVisualizerEnabled: safeJsonParse(localStorage.getItem('radio-playerbar-visualizer-enabled'), defaultSettings.isPlayerBarVisualizerEnabled),
        visualizerStyle: safeJsonParse(localStorage.getItem('radio-visualizer-style'), defaultSettings.visualizerStyle),
        isStatusIndicatorEnabled: safeJsonParse(localStorage.getItem('radio-status-indicator-enabled'), defaultSettings.isStatusIndicatorEnabled),
        isVolumeControlVisible: safeJsonParse(localStorage.getItem('radio-volume-control-visible'), defaultSettings.isVolumeControlVisible),
        showNextSong: safeJsonParse(localStorage.getItem('radio-show-next-song'), defaultSettings.showNextSong),
        gridSize: safeJsonParse(localStorage.getItem('radio-grid-size'), defaultSettings.gridSize),
        isMarqueeProgramEnabled: safeJsonParse(localStorage.getItem('radio-marquee-program-enabled'), defaultSettings.isMarqueeProgramEnabled),
        isMarqueeCurrentTrackEnabled: safeJsonParse(localStorage.getItem('radio-marquee-current-enabled'), defaultSettings.isMarqueeCurrentTrackEnabled),
        isMarqueeNextTrackEnabled: safeJsonParse(localStorage.getItem('radio-marquee-next-enabled'), defaultSettings.isMarqueeNextTrackEnabled),
        marqueeSpeed: safeJsonParse(localStorage.getItem('radio-marquee-speed'), defaultSettings.marqueeSpeed),
        marqueeDelay: safeJsonParse(localStorage.getItem('radio-marquee-delay'), defaultSettings.marqueeDelay),
        filter: safeJsonParse(localStorage.getItem('radio-last-filter'), defaultSettings.filter),
        sortOrderAll: safeJsonParse(localStorage.getItem('radio-sort-order-all'), oldSortOrder ?? defaultSettings.sortOrderAll),
        sortOrderFavorites: safeJsonParse(localStorage.getItem('radio-sort-order-favorites'), defaultSettings.sortOrderFavorites),
        keyMap: safeJsonParse(localStorage.getItem('radio-key-map'), defaultSettings.keyMap),
    };
};

const saveSettingsToLocalStorage = (settings) => {
    localStorage.setItem('radio-favorites', JSON.stringify(settings.favorites));
    localStorage.setItem('radio-station-custom-order', JSON.stringify(settings.customOrder));
    localStorage.setItem('radio-theme', JSON.stringify(settings.theme));
    localStorage.setItem('radio-eq', JSON.stringify(settings.eqPreset));
    localStorage.setItem('radio-custom-eq', JSON.stringify(settings.customEqSettings));
    localStorage.setItem('radio-volume', JSON.stringify(settings.volume));
    localStorage.setItem('radio-nowplaying-visualizer-enabled', JSON.stringify(settings.isNowPlayingVisualizerEnabled));
    localStorage.setItem('radio-playerbar-visualizer-enabled', JSON.stringify(settings.isPlayerBarVisualizerEnabled));
    localStorage.setItem('radio-visualizer-style', JSON.stringify(settings.visualizerStyle));
    localStorage.setItem('radio-status-indicator-enabled', JSON.stringify(settings.isStatusIndicatorEnabled));
    localStorage.setItem('radio-volume-control-visible', JSON.stringify(settings.isVolumeControlVisible));
    localStorage.setItem('radio-show-next-song', JSON.stringify(settings.showNextSong));
    localStorage.setItem('radio-grid-size', JSON.stringify(settings.gridSize));
    localStorage.setItem('radio-marquee-program-enabled', JSON.stringify(settings.isMarqueeProgramEnabled));
    localStorage.setItem('radio-marquee-current-enabled', JSON.stringify(settings.isMarqueeCurrentTrackEnabled));
    localStorage.setItem('radio-marquee-next-enabled', JSON.stringify(settings.isMarqueeNextTrackEnabled));
    localStorage.setItem('radio-marquee-speed', JSON.stringify(settings.marqueeSpeed));
    localStorage.setItem('radio-marquee-delay', JSON.stringify(settings.marqueeDelay));
    localStorage.setItem('radio-last-filter', JSON.stringify(settings.filter));
    localStorage.setItem('radio-sort-order-all', JSON.stringify(settings.sortOrderAll));
    localStorage.setItem('radio-sort-order-favorites', JSON.stringify(settings.sortOrderFavorites));
    localStorage.setItem('radio-key-map', JSON.stringify(settings.keyMap));
};

const settingsHaveConflict = (local, cloud) => {
    // A simple JSON diff is good enough for this data structure.
    return JSON.stringify(local) !== JSON.stringify(cloud);
};

const normalizeSettings = (settings) => {
    // Start with a deep copy of defaults to avoid mutation
    const defaultsCopy = JSON.parse(JSON.stringify(defaultSettings));
    
    if (!settings) {
        return defaultsCopy;
    }
    
    return {
        ...defaultsCopy,
        ...settings, // Overwrite with provided settings
        customEqSettings: { // Deep merge for the nested object
            ...defaultsCopy.customEqSettings,
            ...(settings.customEqSettings || {}),
        },
        keyMap: {
            ...defaultsCopy.keyMap,
            ...(settings.keyMap || {}),
        }
    };
};

const SortButton = ({ label, order, currentOrder, setOrder }) => (
  React.createElement("button", { onClick: () => setOrder(order), className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${ currentOrder === order ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500' }` }, label)
);

const CATEGORY_SORTS = [ { order: 'category_style', label: 'סגנון' }, { order: 'category_identity', label: 'אופי' }, { order: 'category_region', label: 'אזור' }, { order: 'category_nameStructure', label: 'שם' }, ];

export default function App() {
  const [stations, setStations] = useState([]);
  const [stationsStatus, setStationsStatus] = useState('idle');
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [mergeModal, setMergeModal] = useState({ isOpen: false, onMerge: () => {}, onDiscardLocal: () => {} });

  const [allSettings, setAllSettings] = useState(() => loadSettingsFromLocalStorage());
  
  // Use a ref to track the latest settings, to be used inside the auth listener closure
  const settingsRef = useRef(allSettings);
  useEffect(() => {
    settingsRef.current = allSettings;
  }, [allSettings]);

  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isVisualizerFullscreen, setIsVisualizerFullscreen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState(null);
  const pinchDistRef = useRef(0);
  const PINCH_THRESHOLD = 40;
  const [actionMenuState, setActionMenuState] = useState({isOpen: false, songTitle: null});

  const isFavorite = useCallback((stationUuid) => allSettings.favorites.includes(stationUuid), [allSettings.favorites]);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef(null);
  const [updateStatus, setUpdateStatus] = useState('idle');
  
  // Determine if we should use proxy (if ANY visualizer is enabled)
  const shouldUseProxy = allSettings.isNowPlayingVisualizerEnabled || allSettings.isPlayerBarVisualizerEnabled;
  
  // Auth state listener - runs only once on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener(async (user) => {
      if (user) {
        setIsCloudSyncing(true);
        const hasSyncedBefore = localStorage.getItem('radio-has-synced-with-account') === 'true';
        const rawCloudSettings = await getUserSettings(user.uid);
        const cloudSettings = normalizeSettings(rawCloudSettings);

        if (hasSyncedBefore || !rawCloudSettings) {
          console.log("טוען הגדרות מהענן, מדלג על בדיקת קונפליקט.");
          setAllSettings(cloudSettings);
          if (!rawCloudSettings) {
            await saveUserSettings(user.uid, cloudSettings);
          }
          localStorage.setItem('radio-has-synced-with-account', 'true');
          setIsCloudSyncing(false);
          setUser(user);
        } else {
          const localSettings = settingsRef.current;
          
          console.log("--- השוואת הגדרות סנכרון ---");
          console.log("הגדרות מקומיות (מהמכשיר):", localSettings);
          console.log("הגדרות מהענן (לאחר נורמליזציה):", cloudSettings);
          
          if (settingsHaveConflict(localSettings, cloudSettings)) {
            console.log("זוהה קונפליקט. פותח חלון מיזוג.");
            setMergeModal({
              isOpen: true,
              onMerge: () => { 
                setAllSettings(localSettings);
                saveUserSettings(user.uid, localSettings);
                localStorage.setItem('radio-has-synced-with-account', 'true');
                setMergeModal({ isOpen: false, onMerge: () => {}, onDiscardLocal: () => {} });
                setIsCloudSyncing(false);
                setUser(user);
              },
              onDiscardLocal: () => {
                setAllSettings(cloudSettings);
                localStorage.setItem('radio-has-synced-with-account', 'true');
                setMergeModal({ isOpen: false, onMerge: () => {}, onDiscardLocal: () => {} });
                setIsCloudSyncing(false);
                setUser(user);
              },
            });
          } else {
            console.log("לא זוהו קונפליקטים. משתמש בהגדרות מהענן.");
            setAllSettings(cloudSettings);
            localStorage.setItem('radio-has-synced-with-account', 'true');
            setIsCloudSyncing(false);
            setUser(user);
          }
        }
      } else { 
        console.log("המשתמש התנתק. משחזר הגדרות מקומיות.");
        localStorage.removeItem('radio-has-synced-with-account');
        setUser(null);
        setAllSettings(loadSettingsFromLocalStorage());
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Settings persistence effect
  useEffect(() => {
    if (!user) {
      saveSettingsToLocalStorage(allSettings);
    }
    if (user && !isCloudSyncing) {
        saveUserSettings(user.uid, allSettings);
    }
  }, [allSettings, user, isCloudSyncing]);

  useEffect(() => {
    if (isAuthReady && (stationsStatus === 'loaded' || stationsStatus === 'error')) {
      const loader = document.querySelector('.app-loader');
      if (loader) loader.style.display = 'none';
    }
  }, [isAuthReady, stationsStatus]);

  useEffect(() => {
    const fetchInitialStations = async () => {
      setStationsStatus('loading');
      try {
        const fetchedStations = await fetchIsraeliStations();
        if (fetchedStations.length === 0) {
          setError('לא הצלחנו למצוא תחנות. נסה לרענן את העמוד.');
          setStationsStatus('error');
        } else {
          setStations(fetchedStations);
          setStationsStatus('loaded');
        }
      } catch (err) {
        setError('אירעה שגיאה בטעינת התחנות.');
        setStationsStatus('error');
        console.error(err);
      }
    };
    fetchInitialStations();
  }, []);

  // Service Worker Update Handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').then(registration => {
        if (registration.waiting) {
            waitingWorkerRef.current = registration.waiting;
            setIsUpdateAvailable(true);
            setUpdateStatus('found');
        }

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
    }
  }, []);
  
  useEffect(() => { document.documentElement.className = allSettings.theme; }, [allSettings.theme]);

  const currentSortOrder = useMemo(() => {
    return allSettings.filter === StationFilter.Favorites ? allSettings.sortOrderFavorites : allSettings.sortOrderAll;
  }, [allSettings.filter, allSettings.sortOrderAll, allSettings.sortOrderFavorites]);

  const displayedStations = useMemo(() => {
    let stationsToSort = [...(allSettings.filter === StationFilter.Favorites ? stations.filter(s => isFavorite(s.stationuuid)) : stations)];
    const customOrderMap = new Map(allSettings.customOrder.map((uuid, index) => [uuid, index]));
    switch (currentSortOrder) {
      case 'custom': stationsToSort.sort((a, b) => { const indexA = customOrderMap.get(a.stationuuid); const indexB = customOrderMap.get(b.stationuuid); if (typeof indexA === 'number' && typeof indexB === 'number') return indexA - indexB; if (typeof indexA === 'number') return -1; if (typeof indexB === 'number') return 1; return a.name.localeCompare(b.name, 'he'); }); break;
      case 'name_asc': stationsToSort.sort((a, b) => a.name.localeCompare(b.name, 'he')); break;
      case 'name_desc': stationsToSort.sort((a, b) => b.name.localeCompare(a.name, 'he')); break;
      case 'category_style': case 'category_identity': case 'category_region': case 'category_nameStructure':
        const categoryType = currentSortOrder.replace('category_', '');
        stationsToSort.sort((a, b) => { const categoryA = getCategory(a, categoryType); const categoryB = getCategory(b, categoryType); if (categoryA < categoryB) return -1; if (categoryA > categoryB) return 1; return a.name.localeCompare(b.name, 'he'); }); break;
      case 'priority': default:
        const getPriorityIndex = (stationName) => PRIORITY_STATIONS.findIndex(ps => ps.aliases.some(alias => stationName.toLowerCase().includes(alias.toLowerCase())));
        stationsToSort.sort((a, b) => { let aP = getPriorityIndex(a.name); let bP = getPriorityIndex(b.name); if (aP === -1) aP = Infinity; if (bP === -1) bP = Infinity; return aP !== bP ? aP - bP : a.name.localeCompare(b.name, 'he'); }); break;
    }
    return stationsToSort;
  }, [stations, allSettings.filter, isFavorite, currentSortOrder, allSettings.customOrder]);

  const setSortOrder = (order) => {
    if (allSettings.filter === StationFilter.Favorites) {
        setAllSettings(s => ({...s, sortOrderFavorites: order}));
    } else {
        setAllSettings(s => ({...s, sortOrderAll: order}));
    }
  };
  
  const handleManualUpdateCheck = useCallback(async () => { if (!('serviceWorker' in navigator) || !navigator.serviceWorker.ready) { setUpdateStatus('error'); setTimeout(() => setUpdateStatus('idle'), 3000); return; } setUpdateStatus('checking'); try { const registration = await navigator.serviceWorker.ready; await registration.update(); setTimeout(() => { setUpdateStatus(cs => cs === 'checking' ? 'not-found' : cs); if (updateStatus === 'not-found') setTimeout(() => setUpdateStatus('idle'), 3000); }, 5000); } catch (error) { setUpdateStatus('error'); setTimeout(() => setUpdateStatus('idle'), 3000); } }, [updateStatus]);
  
  const handleUpdateClick = useCallback(async () => {
    let worker = waitingWorkerRef.current;
    if (!worker) {
      const registration = await navigator.serviceWorker.getRegistration();
      worker = registration?.waiting || null;
    }
    if (!worker) {
      window.location.reload();
      return;
    }
    worker.postMessage({ type: 'SKIP_WAITING' });
    setIsUpdateAvailable(false);
    const reloadPage = () => {
        window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadPage);
    setTimeout(reloadPage, 1000);
  }, []);
  
  useEffect(() => { if (stationsStatus === 'loaded' && playerState.status === 'IDLE') { const lastStationUuid = localStorage.getItem('radio-last-station-uuid'); if (lastStationUuid) { const station = stations.find(s => s.stationuuid === lastStationUuid); if (station) dispatch({ type: 'SELECT_STATION', payload: station }); } } }, [stationsStatus, stations, playerState.status]);
  useEffect(() => { if (playerState.station) { localStorage.setItem('radio-last-station-uuid', playerState.station.stationuuid); } }, [playerState.station]);
  useEffect(() => { let intervalId; const fetchAndSetInfo = async () => { if (!playerState.station) return; const { name, stationuuid } = playerState.station; let finalInfo = null; if (hasSpecificHandler(name)) { const specificInfo = await fetchStationSpecificTrackInfo(name); finalInfo = specificInfo ? { ...specificInfo } : { program: null, current: null, next: null }; if (!finalInfo.program) finalInfo.program = getCurrentProgram(name); } else { const [songTitle, programName] = await Promise.all([ fetchLiveTrackInfo(stationuuid), getCurrentProgram(name) ]); const current = songTitle && songTitle.toLowerCase() !== name.toLowerCase() ? songTitle : null; finalInfo = { program: programName, current, next: null }; } setTrackInfo(finalInfo); }; if (playerState.station) { fetchAndSetInfo(); intervalId = window.setInterval(fetchAndSetInfo, 20000); } else { setTrackInfo(null); } return () => clearInterval(intervalId); }, [playerState.station]);
  const handleReorder = (reorderedDisplayedUuids) => { 
      const allStationUuids = stations.map(s => s.stationuuid); 
      const currentOrderUuids = allSettings.customOrder.length > 0 ? allSettings.customOrder : allStationUuids; 
      const reorderedSet = new Set(reorderedDisplayedUuids); 
      const newOrder = [...reorderedDisplayedUuids, ...currentOrderUuids.filter(uuid => !reorderedSet.has(uuid))]; 
      if (allSettings.filter === StationFilter.Favorites) {
        setAllSettings(s => ({...s, customOrder: newOrder, sortOrderFavorites: 'custom'})); 
      } else {
        setAllSettings(s => ({...s, customOrder: newOrder, sortOrderAll: 'custom'})); 
      }
  };
  
  const handleSelectStation = useCallback((station) => dispatch({ type: 'SELECT_STATION', payload: station }), []);
  const handlePlayPause = useCallback(() => { if (playerState.station) dispatch({ type: 'TOGGLE_PAUSE' }); else if (displayedStations.length > 0) dispatch({ type: 'PLAY', payload: displayedStations[0] }); }, [playerState.station, displayedStations]);
  const handlePlay = useCallback(async () => { if (playerState.status === 'PLAYING') return; if (playerState.station) dispatch({ type: 'TOGGLE_PAUSE' }); else if (displayedStations.length > 0) dispatch({ type: 'PLAY', payload: displayedStations[0] }); }, [playerState.status, playerState.station, displayedStations]);
  const handlePause = useCallback(async () => { if (playerState.status === 'PLAYING') dispatch({ type: 'TOGGLE_PAUSE' }); }, [playerState.status]);
  const handleNext = useCallback(async () => { if (displayedStations.length === 0) return; const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid) : -1; handleSelectStation(displayedStations[(currentIndex + 1) % displayedStations.length]); }, [displayedStations, playerState.station, handleSelectStation]);
  const handlePrev = useCallback(async () => { if (displayedStations.length === 0) return; const currentIndex = playerState.station ? displayedStations.findIndex(s => s.stationuuid === playerState.station.stationuuid) : -1; handleSelectStation(displayedStations[(currentIndex - 1 + displayedStations.length) % displayedStations.length]); }, [displayedStations, playerState.station, handleSelectStation]);
  const handleTouchStart = useCallback((e) => { if (e.touches.length === 2) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; pinchDistRef.current = Math.sqrt(dx * dx + dy * dy); } }, []);
  const handleTouchMove = useCallback((e) => { if (e.touches.length === 2 && pinchDistRef.current > 0) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const currentDist = Math.sqrt(dx * dx + dy * dy); const delta = currentDist - pinchDistRef.current; if (Math.abs(delta) > PINCH_THRESHOLD) { setAllSettings(s => ({...s, gridSize: (delta > 0 ? Math.min(5, s.gridSize + 1) : Math.max(1, s.gridSize - 1))})); pinchDistRef.current = currentDist; } } }, []);
  const handleTouchEnd = useCallback(() => { pinchDistRef.current = 0; }, []);
  const handleCategorySortClick = () => { const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === currentSortOrder); const nextIndex = currentCategoryIndex !== -1 ? (currentCategoryIndex + 1) % CATEGORY_SORTS.length : 0; setSortOrder(CATEGORY_SORTS[nextIndex].order); };
  const openActionMenu = useCallback((songTitle) => setActionMenuState({ isOpen: true, songTitle }), []);
  const closeActionMenu = useCallback(() => setActionMenuState({ isOpen: false, songTitle: null }), []);
  const handleCycleVisualizerStyle = useCallback(() => setAllSettings(s => ({...s, visualizerStyle: VISUALIZER_STYLES[(VISUALIZER_STYLES.indexOf(s.visualizerStyle) + 1) % VISUALIZER_STYLES.length]})), []);

  const currentCategoryIndex = CATEGORY_SORTS.findIndex(c => c.order === currentSortOrder);
  const categoryButtonLabel = currentCategoryIndex !== -1 ? CATEGORY_SORTS[currentCategoryIndex].label : "קטגוריות";

  useEffect(() => {
    const handleKeyDown = (e) => {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

        const { key } = e;
        let action;
        
        for (const [act, keys] of Object.entries(allSettings.keyMap)) {
            if (keys.includes(key)) {
                action = act;
                break;
            }
        }

        if (action) {
            e.preventDefault();
            switch (action) {
                case 'playPause': 
                    handlePlayPause(); 
                    break;
                case 'volumeUp': 
                    setAllSettings(s => ({...s, volume: Math.min(1, s.volume + 0.05)})); 
                    break;
                case 'volumeDown': 
                    setAllSettings(s => ({...s, volume: Math.max(0, s.volume - 0.05)})); 
                    break;
                case 'nextStation': 
                    handleNext(); 
                    break;
                case 'prevStation': 
                    handlePrev(); 
                    break;
                case 'toggleFullscreen':
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(console.error);
                    } else {
                        document.exitFullscreen().catch(console.error);
                    }
                    break;
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allSettings.keyMap, handlePlayPause, handleNext, handlePrev]);

  return (
    React.createElement("div", { className: "min-h-screen bg-bg-primary text-text-primary flex flex-col" },
      React.createElement(MergeDataModal, { ...mergeModal }),
      React.createElement("header", { className: "p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md" },
        React.createElement("div", { className: "max-w-7xl mx-auto flex items-center justify-between gap-4" },
            React.createElement("button", { onClick: () => setIsSettingsOpen(true), className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הגדרות" }, React.createElement(MenuIcon, { className: "w-6 h-6" })),
            React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1" },
              React.createElement("button", { onClick: () => setAllSettings(s => ({...s, filter: StationFilter.All})), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${allSettings.filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}` }, StationFilter.All),
              React.createElement("button", { onClick: () => setAllSettings(s => ({...s, filter: StationFilter.Favorites})), className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${allSettings.filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}` }, StationFilter.Favorites)
            ),
            React.createElement("h1", { className: "text-xl sm:text-2xl font-bold text-accent" }, "רדיו פרימיום")
        ),
        React.createElement("div", { className: "max-w-7xl mx-auto mt-4" },
            React.createElement("div", { className: "flex items-center justify-center gap-2" },
                React.createElement("span", { className: "text-xs text-text-secondary" }, "מיון:"),
                React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center" },
                    React.createElement(SortButton, { label: "שלי", order: "custom", currentOrder: currentSortOrder, setOrder: setSortOrder }),
                    React.createElement(SortButton, { label: "פופולריות", order: "priority", currentOrder: currentSortOrder, setOrder: setSortOrder }),
                    React.createElement("button", { onClick: () => setSortOrder(currentSortOrder === 'name_asc' ? 'name_desc' : 'name_asc'), className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${currentSortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}` }, currentSortOrder === 'name_desc' ? 'ת-א' : 'א-ת'),
                    React.createElement("button", { onClick: handleCategorySortClick, className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${currentCategoryIndex !== -1 ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}` }, categoryButtonLabel)
                )
            )
        )
      ),
      React.createElement("main", { className: "flex-grow pb-48", onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd },
        stationsStatus === 'loading' ? React.createElement(StationListSkeleton, null) : stationsStatus === 'error' ? React.createElement("p", { className: "text-center text-red-400 p-4" }, error) : displayedStations.length > 0 ? React.createElement(StationList, { stations: displayedStations, currentStation: playerState.station, onSelectStation: handleSelectStation, isFavorite: isFavorite, toggleFavorite: (uuid) => setAllSettings(s => ({...s, favorites: s.favorites.includes(uuid) ? s.favorites.filter(id => id !== uuid) : [...s.favorites, uuid]})), onReorder: handleReorder, isStreamActive: playerState.status === 'PLAYING', isStatusIndicatorEnabled: allSettings.isStatusIndicatorEnabled, gridSize: allSettings.gridSize, sortOrder: currentSortOrder }) : React.createElement("div", { className: "text-center p-8 text-text-secondary" }, React.createElement("h2", { className: "text-xl font-semibold" }, allSettings.filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'), React.createElement("p", null, allSettings.filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.'))
      ),
      React.createElement(SettingsPanel, { isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false), user: user, onLogin: signInWithGoogle, onLogout: signOutUser, currentTheme: allSettings.theme, onThemeChange: (v) => setAllSettings(s=>({...s, theme: v})), currentEqPreset: allSettings.eqPreset, onEqPresetChange: (v) => setAllSettings(s=>({...s, eqPreset: v})), isNowPlayingVisualizerEnabled: allSettings.isNowPlayingVisualizerEnabled, onNowPlayingVisualizerEnabledChange: (v) => setAllSettings(s=>({...s, isNowPlayingVisualizerEnabled: v})), isPlayerBarVisualizerEnabled: allSettings.isPlayerBarVisualizerEnabled, onPlayerBarVisualizerEnabledChange: (v) => setAllSettings(s=>({...s, isPlayerBarVisualizerEnabled: v})), isStatusIndicatorEnabled: allSettings.isStatusIndicatorEnabled, onStatusIndicatorEnabledChange: (v) => setAllSettings(s=>({...s, isStatusIndicatorEnabled: v})), isVolumeControlVisible: allSettings.isVolumeControlVisible, onVolumeControlVisibleChange: (v) => setAllSettings(s=>({...s, isVolumeControlVisible: v})), showNextSong: allSettings.showNextSong, onShowNextSongChange: (v) => setAllSettings(s=>({...s, showNextSong: v})), customEqSettings: allSettings.customEqSettings, onCustomEqChange: (v) => setAllSettings(s=>({...s, customEqSettings: v})), gridSize: allSettings.gridSize, onGridSizeChange: (v) => setAllSettings(s=>({...s, gridSize: v})), isMarqueeProgramEnabled: allSettings.isMarqueeProgramEnabled, onMarqueeProgramEnabledChange: (v) => setAllSettings(s=>({...s, isMarqueeProgramEnabled: v})), isMarqueeCurrentTrackEnabled: allSettings.isMarqueeCurrentTrackEnabled, onMarqueeCurrentTrackEnabledChange: (v) => setAllSettings(s=>({...s, isMarqueeCurrentTrackEnabled: v})), isMarqueeNextTrackEnabled: allSettings.isMarqueeNextTrackEnabled, onMarqueeNextTrackEnabledChange: (v) => setAllSettings(s=>({...s, isMarqueeNextTrackEnabled: v})), marqueeSpeed: allSettings.marqueeSpeed, onMarqueeSpeedChange: (v) => setAllSettings(s=>({...s, marqueeSpeed: v})), marqueeDelay: allSettings.marqueeDelay, onMarqueeDelayChange: (v) => setAllSettings(s=>({...s, marqueeDelay: v})), updateStatus: updateStatus, onManualUpdateCheck: handleManualUpdateCheck, keyMap: allSettings.keyMap, onKeyMapChange: (newMap) => setAllSettings(s => ({...s, keyMap: newMap})) }),
      playerState.station && React.createElement(NowPlaying, { isOpen: isNowPlayingOpen, onClose: () => !isVisualizerFullscreen && setIsNowPlayingOpen(false), station: playerState.station, isPlaying: playerState.status === 'PLAYING', onPlayPause: handlePlayPause, onNext: handleNext, onPrev: handlePrev, volume: allSettings.volume, onVolumeChange: (v) => setAllSettings(s=>({...s, volume: v})), trackInfo: trackInfo, showNextSong: allSettings.showNextSong, frequencyData: frequencyData, visualizerStyle: allSettings.visualizerStyle, isVisualizerEnabled: allSettings.isNowPlayingVisualizerEnabled, onCycleVisualizerStyle: handleCycleVisualizerStyle, isVolumeControlVisible: allSettings.isVolumeControlVisible, marqueeDelay: allSettings.marqueeDelay, isMarqueeProgramEnabled: allSettings.isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled: allSettings.isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled: allSettings.isMarqueeNextTrackEnabled, marqueeSpeed: allSettings.marqueeSpeed, onOpenActionMenu: openActionMenu, isVisualizerFullscreen: isVisualizerFullscreen, setIsVisualizerFullscreen: setIsVisualizerFullscreen }),
      React.createElement(ActionMenu, { isOpen: actionMenuState.isOpen, onClose: closeActionMenu, songTitle: actionMenuState.songTitle }),
      React.createElement(Player, { playerState: playerState, onPlay: handlePlay, onPause: handlePause, onPlayPause: handlePlayPause, onNext: handleNext, onPrev: handlePrev, onPlayerEvent: (event) => dispatch(event), eqPreset: allSettings.eqPreset, customEqSettings: allSettings.customEqSettings, volume: allSettings.volume, onVolumeChange: (v) => setAllSettings(s=>({...s, volume: v})), trackInfo: trackInfo, showNextSong: allSettings.showNextSong, onOpenNowPlaying: () => setIsNowPlayingOpen(true), setFrequencyData: setFrequencyData, frequencyData: frequencyData, isVisualizerEnabled: allSettings.isPlayerBarVisualizerEnabled, shouldUseProxy: shouldUseProxy, marqueeDelay: allSettings.marqueeDelay, isMarqueeProgramEnabled: allSettings.isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled: allSettings.isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled: allSettings.isMarqueeNextTrackEnabled, marqueeSpeed: allSettings.marqueeSpeed, onOpenActionMenu: openActionMenu }),
      isUpdateAvailable && React.createElement("div", { className: "fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 bg-accent text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-4 animate-fade-in-up" }, React.createElement("p", { className: "text-sm font-semibold" }, "עדכון חדש זמין"), React.createElement("button", { onClick: handleUpdateClick, className: "py-1 px-3 bg-white/20 hover:bg-white/40 rounded-md text-sm font-bold" }, "עדכן גירסה"))
    )
  );
}
