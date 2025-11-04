import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService.js';
import { THEMES, EQ_PRESET_KEYS, VISUALIZER_STYLES } from './types.js';
import Player from './components/Player.js';
import StationList from './components/StationList.js';
import SettingsPanel from './components/SettingsPanel.js';
import NowPlaying from './components/NowPlaying.js';
import { useFavorites } from './hooks/useFavorites.js';
import { useAuth } from './hooks/useAuth.js';
import { firestore } from './services/firebaseService.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

// LocalStorage Keys
const FAVORITES_KEY_LOCAL = 'radio-favorites-anonymous';
const CUSTOM_ORDER_KEY_LOCAL = 'radio-station-custom-order-anonymous';
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

const SETTINGS_LOCAL_STORAGE_MAP = {
  theme: THEME_KEY,
  filter: LAST_FILTER_KEY,
  sortOrder: LAST_SORT_KEY,
  eqPreset: EQ_KEY,
  customEqSettings: CUSTOM_EQ_KEY,
  volume: VOLUME_KEY,
  isNowPlayingVisualizerEnabled: NOW_PLAYING_VISUALIZER_ENABLED_KEY,
  isPlayerBarVisualizerEnabled: PLAYER_BAR_VISUALIZER_ENABLED_KEY,
  visualizerStyle: VISUALIZER_STYLE_KEY,
  isStatusIndicatorEnabled: STATUS_INDICATOR_ENABLED_KEY,
  isVolumeControlVisible: VOLUME_CONTROL_VISIBLE_KEY,
  showNextSong: SHOW_NEXT_SONG_KEY,
  gridSize: GRID_SIZE_KEY,
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  filter: StationFilter.All,
  sortOrder: 'priority',
  eqPreset: 'flat',
  customEqSettings: { bass: 0, mid: 0, treble: 0 },
  volume: 1,
  isNowPlayingVisualizerEnabled: true,
  isPlayerBarVisualizerEnabled: true,
  visualizerStyle: 'bars',
  isStatusIndicatorEnabled: true,
  isVolumeControlVisible: true,
  showNextSong: true,
  gridSize: 3,
};

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
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
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
  
  // State for guest snapshot on logout
  const guestStateSnapshotRef = useRef(null);

  // Custom Order State
  const [customOrder, setCustomOrder] = useState([]);
  const [isUserDataSynced, setIsUserDataSynced] = useState(false);
  
  // State loaded from LocalStorage (will be overridden by Firestore if logged in)
  const [filter, setFilter] = useState(() => localStorage.getItem(LAST_FILTER_KEY) || DEFAULT_SETTINGS.filter);
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem(LAST_SORT_KEY) || DEFAULT_SETTINGS.sortOrder);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || DEFAULT_SETTINGS.theme);
  const [eqPreset, setEqPreset] = useState(() => localStorage.getItem(EQ_KEY) || DEFAULT_SETTINGS.eqPreset);
  const [customEqSettings, setCustomEqSettings] = useState(() => JSON.parse(localStorage.getItem(CUSTOM_EQ_KEY) || JSON.stringify(DEFAULT_SETTINGS.customEqSettings)));
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem(VOLUME_KEY) || '1'));
  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState(() => JSON.parse(localStorage.getItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY) || 'true'));
  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState(() => JSON.parse(localStorage.getItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY) || 'true'));
  const [visualizerStyle, setVisualizerStyle] = useState(() => localStorage.getItem(VISUALIZER_STYLE_KEY) || DEFAULT_SETTINGS.visualizerStyle);
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState(() => JSON.parse(localStorage.getItem(STATUS_INDICATOR_ENABLED_KEY) || 'true'));
  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState(() => JSON.parse(localStorage.getItem(VOLUME_CONTROL_VISIBLE_KEY) || 'true'));
  const [showNextSong, setShowNextSong] = useState(() => JSON.parse(localStorage.getItem(SHOW_NEXT_SONG_KEY) || 'true'));
  const [gridSize, setGridSize] = useState(() => JSON.parse(localStorage.getItem(GRID_SIZE_KEY) || '3'));


  const { favorites, toggleFavorite, isFavorite, isFavoritesLoaded } = useFavorites(user);
  
  const currentStation = useMemo(() => {
     if (currentStationIndex !== null && stations[currentStationIndex]) {
        return stations[currentStationIndex];
     }
     return null;
  }, [stations, currentStationIndex]);

    // This large effect handles syncing all user data (custom order and settings) on login.
    useEffect(() => {
        if (authLoading) return; // Wait for authentication to resolve

        const syncUserData = async () => {
            try {
                if (user) {
                     // --- TAKE SNAPSHOT OF GUEST STATE BEFORE LOGIN ---
                    guestStateSnapshotRef.current = {
                        theme, filter, sortOrder, eqPreset, customEqSettings, volume,
                        isNowPlayingVisualizerEnabled, isPlayerBarVisualizerEnabled,
                        visualizerStyle, isStatusIndicatorEnabled, isVolumeControlVisible,
                        showNextSong, gridSize, customOrder, favorites
                    };

                    const docRef = doc(firestore, 'user_data', user.uid);
                    const docSnap = await getDoc(docRef);
                    const remoteData = docSnap.data() || {};
                    
                    // --- MERGE CUSTOM ORDER ---
                    const localCustomOrder = JSON.parse(localStorage.getItem(CUSTOM_ORDER_KEY_LOCAL) || '[]');
                    let finalCustomOrder = remoteData.customOrder || [];
                    if (localCustomOrder.length > 0) {
                        const merged = new Set([...finalCustomOrder, ...localCustomOrder]);
                        finalCustomOrder = Array.from(merged);
                    }
                    setCustomOrder(finalCustomOrder);

                    // --- MERGE SETTINGS ---
                    const localSettings = {};
                    Object.entries(SETTINGS_LOCAL_STORAGE_MAP).forEach(([key, storageKey]) => {
                        const item = localStorage.getItem(storageKey);
                        if (item !== null) {
                            try {
                                localSettings[key] = JSON.parse(item);
                            } catch {
                                localSettings[key] = item; // For non-JSON values like theme
                            }
                        }
                    });

                    const mergedSettings = { ...DEFAULT_SETTINGS, ...localSettings, ...remoteData.settings };

                    // --- UPDATE REACT STATE ---
                    setTheme(mergedSettings.theme);
                    setFilter(mergedSettings.filter);
                    setSortOrder(mergedSettings.sortOrder);
                    setEqPreset(mergedSettings.eqPreset);
                    setCustomEqSettings(mergedSettings.customEqSettings);
                    setVolume(mergedSettings.volume);
                    setIsNowPlayingVisualizerEnabled(mergedSettings.isNowPlayingVisualizerEnabled);
                    setIsPlayerBarVisualizerEnabled(mergedSettings.isPlayerBarVisualizerEnabled);
                    setVisualizerStyle(mergedSettings.visualizerStyle);
                    setIsStatusIndicatorEnabled(mergedSettings.isStatusIndicatorEnabled);
                    setIsVolumeControlVisible(mergedSettings.isVolumeControlVisible);
                    setShowNextSong(mergedSettings.showNextSong);
                    setGridSize(mergedSettings.gridSize);

                    // --- SAVE MERGED DATA TO FIRESTORE & CLEANUP LOCAL ---
                    await setDoc(docRef, { customOrder: finalCustomOrder, settings: mergedSettings }, { merge: true });
                    localStorage.removeItem(CUSTOM_ORDER_KEY_LOCAL);
                    Object.values(SETTINGS_LOCAL_STORAGE_MAP).forEach(key => localStorage.removeItem(key));
                
                } else {
                     // ANONYMOUS: This block now handles initial load AND restoring state after logout.
                    if (guestStateSnapshotRef.current) {
                        // --- RESTORE GUEST STATE AFTER LOGOUT ---
                        const restoredState = guestStateSnapshotRef.current;

                        // Restore state setters. Existing useEffects will handle saving to localStorage.
                        setTheme(restoredState.theme);
                        setFilter(restoredState.filter);
                        setSortOrder(restoredState.sortOrder);
                        setEqPreset(restoredState.eqPreset);
                        setCustomEqSettings(restoredState.customEqSettings);
                        setVolume(restoredState.volume);
                        setIsNowPlayingVisualizerEnabled(restoredState.isNowPlayingVisualizerEnabled);
                        setIsPlayerBarVisualizerEnabled(restoredState.isPlayerBarVisualizerEnabled);
                        setVisualizerStyle(restoredState.visualizerStyle);
                        setIsStatusIndicatorEnabled(restoredState.isStatusIndicatorEnabled);
                        setIsVolumeControlVisible(restoredState.isVolumeControlVisible);
                        setShowNextSong(restoredState.showNextSong);
                        setGridSize(restoredState.gridSize);

                        // Restore custom order (this also saves to localStorage)
                        saveCustomOrder(restoredState.customOrder);

                        // Restore favorites by writing to localStorage; the hook will pick it up.
                        localStorage.setItem(FAVORITES_KEY_LOCAL, JSON.stringify(restoredState.favorites));
                        
                        guestStateSnapshotRef.current = null; // Clear snapshot
                    } else {
                        // --- STANDARD ANONYMOUS LOAD ---
                        const localOrder = JSON.parse(localStorage.getItem(CUSTOM_ORDER_KEY_LOCAL) || '[]');
                        setCustomOrder(localOrder);
                    }
                }
            } catch (error) {
                console.error("Error during user data sync:", error);
                // Fallback for anonymous users if something went wrong
                if (!user) {
                    const localOrder = JSON.parse(localStorage.getItem(CUSTOM_ORDER_KEY_LOCAL) || '[]');
                    setCustomOrder(localOrder);
                }
            } finally {
                setIsUserDataSynced(true);
            }
        };

        syncUserData();
    }, [user, authLoading]);


  const saveUserData = useCallback(async (data) => {
    if (user) {
        try {
            const userDocRef = doc(firestore, 'user_data', user.uid);
            await setDoc(userDocRef, data, { merge: true });
        } catch (error) {
            console.error("Failed to save user data to Firestore:", error);
        }
    }
  }, [user]);

  const saveCustomOrder = useCallback(async (newOrder) => {
      setCustomOrder(newOrder);
      if (user) {
        saveUserData({ customOrder: newOrder });
      } else {
        localStorage.setItem(CUSTOM_ORDER_KEY_LOCAL, JSON.stringify(newOrder));
      }
  }, [user, saveUserData]);

  const saveSetting = useCallback((key, value) => {
    if (user) {
      saveUserData({ settings: { [key]: value } });
    } else {
      const storageKey = SETTINGS_LOCAL_STORAGE_MAP[key];
      if (storageKey) {
          const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
          localStorage.setItem(storageKey, valueToStore);
      }
    }
  }, [user, saveUserData]);


  // Fetch stations on initial load
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

  // Restore last played station once station list is loaded
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
  
  // Fetch station metadata (current song/program)
  useEffect(() => {
    let intervalId;

    const fetchAndSetInfo = async () => {
      if (!currentStation) return;
      
      let finalInfo = null;
      const stationName = currentStation.name;

      if (hasSpecificHandler(stationName)) {
        const specificInfo = await fetchStationSpecificTrackInfo(stationName);
        if (specificInfo) {
          finalInfo = specificInfo;
        } else {
          const scheduledProgram = getCurrentProgram(stationName);
          if (scheduledProgram) {
            finalInfo = { program: scheduledProgram, current: null, next: null };
          }
        }
      } else {
        const songTitle = await fetchLiveTrackInfo(currentStation.stationuuid);
        if (songTitle && songTitle.toLowerCase() !== stationName.toLowerCase()) {
          finalInfo = { program: null, current: songTitle, next: null };
        } else {
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

  // Effects to save state changes
  useEffect(() => {
    document.documentElement.className = theme;
    saveSetting('theme', theme);
  }, [theme, saveSetting]);

  useEffect(() => {
    saveSetting('filter', filter);
  }, [filter, saveSetting]);

  useEffect(() => {
    saveSetting('sortOrder', sortOrder);
  }, [sortOrder, saveSetting]);
  
  const handleSetVolume = (newVolume) => {
    setVolume(newVolume);
    saveSetting('volume', newVolume);
  };

  const handleSetEqPreset = (preset) => {
    setEqPreset(preset);
    saveSetting('eqPreset', preset);
  };

  const handleSetCustomEqSettings = (settings) => {
    setCustomEqSettings(settings);
    saveSetting('customEqSettings', settings);
  };
  
  const handleSetIsNowPlayingVisualizerEnabled = (enabled) => {
    setIsNowPlayingVisualizerEnabled(enabled);
    saveSetting('isNowPlayingVisualizerEnabled', enabled);
  };

  const handleSetIsPlayerBarVisualizerEnabled = (enabled) => {
    setIsPlayerBarVisualizerEnabled(enabled);
    saveSetting('isPlayerBarVisualizerEnabled', enabled);
  };
  
  const handleSetStatusIndicatorEnabled = (enabled) => {
    setIsStatusIndicatorEnabled(enabled);
    saveSetting('isStatusIndicatorEnabled', enabled);
  };

  const handleSetIsVolumeControlVisible = (visible) => {
    setIsVolumeControlVisible(visible);
    saveSetting('isVolumeControlVisible', visible);
  };
  
  const handleSetShowNextSong = (enabled) => {
    setShowNextSong(enabled);
    saveSetting('showNextSong', enabled);
  };
    
  const handleSetGridSize = useCallback((size) => {
    setGridSize(size);
    saveSetting('gridSize', size);
  }, [saveSetting]);

  const handleCycleVisualizerStyle = useCallback(() => {
    const currentIndex = VISUALIZER_STYLES.indexOf(visualizerStyle);
    const nextIndex = (currentIndex + 1) % VISUALIZER_STYLES.length;
    const newStyle = VISUALIZER_STYLES[nextIndex];
    setVisualizerStyle(newStyle);
    saveSetting('visualizerStyle', newStyle);
  }, [visualizerStyle, saveSetting]);

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
      if (!isFavoritesLoaded) return []; // Don't show anything until favorites are loaded
      return stations.filter(s => favorites.includes(s.stationuuid));
    }
    return stations;
  }, [stations, filter, favorites, isFavoritesLoaded]);
  
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

  const playStationAtIndex = useCallback((index) => {
    if (index >= 0 && index < stations.length) {
        localStorage.setItem(LAST_STATION_KEY, stations[index].stationuuid);
        setCurrentStationIndex(index);
        setIsPlaying(true); // Always play when selecting a new station
    }
  }, [stations]);

  const handleSelectStation = useCallback((station) => {
    const stationIndexInMainList = stations.findIndex(s => s.stationuuid === station.stationuuid);
    if (stationIndexInMainList !== -1) {
        if (currentStationIndex === stationIndexInMainList) {
          setIsPlaying(prev => !prev); // Toggle if it's the same station
        } else {
          playStationAtIndex(stationIndexInMainList); // Play if it's a new station
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

  // Render a skeleton loader until all stations and user data are loaded and synced
  if (isLoading || authLoading || !isUserDataSynced || !isFavoritesLoaded) {
    return (
        React.createElement("div", { className: "min-h-screen bg-bg-primary text-text-primary" },
            React.createElement(StationListSkeleton, null)
        )
    );
  }


  return (
    React.createElement("div", { className: "min-h-screen bg-bg-primary text-text-primary flex flex-col" },
      React.createElement("header", { className: "p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md" },
        React.createElement("div", { className: "max-w-7xl mx-auto flex items-center justify-between gap-4" },
            React.createElement("button", { onClick: () => setIsSettingsOpen(true), className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "הגדרות" },
              React.createElement(MenuIcon, { className: "w-6 h-6" })
            ),
            
            React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1" },
              React.createElement("button", { 
                onClick: () => setFilter(StationFilter.All),
                className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}`
              },
                StationFilter.All
              ),
              React.createElement("button", { 
                onClick: () => setFilter(StationFilter.Favorites),
                className: `px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}`
              },
                StationFilter.Favorites
              )
            ),
            
            React.createElement("h1", { className: "text-xl sm:text-2xl font-bold text-accent" }, "רדיו פרימיום")
        ),
        React.createElement("div", { className: "max-w-7xl mx-auto mt-4" },
            React.createElement("div", { className: "flex items-center justify-center gap-2" },
                React.createElement("span", { className: "text-xs text-text-secondary" }, "מיון:"),
                React.createElement("div", { className: "flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center" },
                    React.createElement(SortButton, { label: "אישי", order: "custom", currentOrder: sortOrder, setOrder: setSortOrder }),
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
                    },
                      sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'
                    ),
                    React.createElement("button", {
                      onClick: handleCategorySortClick,
                      className: `px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        isCategorySortActive ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`
                    },
                      categoryButtonLabel
                    )
                )
            )
        )
      ),

      React.createElement("main", { 
        className: "flex-grow pb-48",
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd
      },
        error ? (
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
                    gridSize: gridSize,
                    sortOrder: sortOrder
                })
            ) : (
                React.createElement("div", { className: "text-center p-8 text-text-secondary" },
                    React.createElement("h2", { className: "text-xl font-semibold" }, 
                      filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'
                    ),
                    React.createElement("p", null, 
                      filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.'
                    )
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
        user: user,
        authLoading: authLoading,
        signIn: signInWithGoogle,
        signOut: signOut
      }),

      currentStation && (
         React.createElement(NowPlaying, {
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
          isVolumeControlVisible: isVolumeControlVisible
        })
      ),
     
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