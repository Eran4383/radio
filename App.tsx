import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchIsraeliStations, fetchLiveTrackInfo } from './services/radioService';
import { Station, Theme, EqPreset, THEMES, EQ_PRESET_KEYS, VisualizerStyle, VISUALIZER_STYLES, CustomEqSettings, StationTrackInfo, GridSize, SortOrder } from './types';
import Player from './components/Player';
import StationList from './components/StationList';
import SettingsPanel from './components/SettingsPanel';
import NowPlaying from './components/NowPlaying';
import { useFavorites } from './hooks/useFavorites';
import { useAuth } from './hooks/useAuth';
import { firestore } from './services/firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

// LocalStorage Keys
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


const SortButton: React.FC<{
  label: string;
  order: SortOrder;
  currentOrder: SortOrder;
  setOrder: (order: SortOrder) => void;
}> = ({ label, order, currentOrder, setOrder }) => (
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
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [currentStationIndex, setCurrentStationIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [trackInfo, setTrackInfo] = useState<StationTrackInfo | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const pinchDistRef = useRef<number>(0);
  const PINCH_THRESHOLD = 40; // pixels
  
  // Custom Order State
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  
  // State loaded from LocalStorage (will be overridden by Firestore if logged in)
  const [filter, setFilter] = useState<StationFilter>(() => {
    const saved = localStorage.getItem(LAST_FILTER_KEY) as StationFilter;
    return (saved && Object.values(StationFilter).includes(saved)) ? saved : StationFilter.All;
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem(LAST_SORT_KEY) as SortOrder;
    return saved || 'priority';
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
    try {
      const saved = localStorage.getItem(CUSTOM_EQ_KEY);
      return saved ? JSON.parse(saved) : { bass: 0, mid: 0, treble: 0 };
    } catch {
      return { bass: 0, mid: 0, treble: 0 };
    }
  });

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved ? parseFloat(saved) : 1;
  });

  const [isNowPlayingVisualizerEnabled, setIsNowPlayingVisualizerEnabled] = useState<boolean>(() => {
      const saved = localStorage.getItem(NOW_PLAYING_VISUALIZER_ENABLED_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [isPlayerBarVisualizerEnabled, setIsPlayerBarVisualizerEnabled] = useState<boolean>(() => {
      const saved = localStorage.getItem(PLAYER_BAR_VISUALIZER_ENABLED_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>(() => {
      const saved = localStorage.getItem(VISUALIZER_STYLE_KEY) as VisualizerStyle;
      return (saved && VISUALIZER_STYLES.includes(saved)) ? saved : 'bars';
  });
  
  const [isStatusIndicatorEnabled, setIsStatusIndicatorEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATUS_INDICATOR_ENABLED_KEY);
    return saved ? JSON.parse(saved) : true;
  });

  const [isVolumeControlVisible, setIsVolumeControlVisible] = useState<boolean>(() => {
      const saved = localStorage.getItem(VOLUME_CONTROL_VISIBLE_KEY);
      return saved ? JSON.parse(saved) : true;
  });
  
  const [showNextSong, setShowNextSong] = useState<boolean>(() => {
      const saved = localStorage.getItem(SHOW_NEXT_SONG_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [gridSize, setGridSize] = useState<GridSize>(() => {
    const saved = localStorage.getItem(GRID_SIZE_KEY);
    // 1 is smallest, 5 is largest. Let's default to 3.
    return saved ? (JSON.parse(saved) as GridSize) : 3;
  });


  const { favorites, toggleFavorite, isFavorite, isFavoritesLoaded } = useFavorites(user);
  
  const currentStation = useMemo(() => {
     if (currentStationIndex !== null && stations[currentStationIndex]) {
        return stations[currentStationIndex];
     }
     return null;
  }, [stations, currentStationIndex]);

  // Sync custom order with Firestore
  useEffect(() => {
    const syncCustomOrder = async () => {
      if (user) {
        try {
          const docRef = doc(firestore, 'user_data', user.uid);
          const docSnap = await getDoc(docRef);
          const remoteData = docSnap.data();

          const localOrderStr = localStorage.getItem(CUSTOM_ORDER_KEY_LOCAL);
          const localOrder: string[] = localOrderStr ? JSON.parse(localOrderStr) : [];
          
          let finalOrder: string[] = [];
          if (docSnap.exists() && remoteData?.customOrder) {
            finalOrder = remoteData.customOrder;
          } else if (localOrder.length > 0) {
            finalOrder = localOrder;
            await setDoc(docRef, { customOrder: finalOrder }, { merge: true });
            localStorage.removeItem(CUSTOM_ORDER_KEY_LOCAL);
          }
          setCustomOrder(finalOrder);
        } catch (error) {
          console.error("Failed to sync custom order:", error);
        }
      } else {
        const localOrderStr = localStorage.getItem(CUSTOM_ORDER_KEY_LOCAL);
        setCustomOrder(localOrderStr ? JSON.parse(localOrderStr) : []);
      }
    };
    syncCustomOrder();
  }, [user]);

  const saveCustomOrder = useCallback(async (newOrder: string[]) => {
      setCustomOrder(newOrder);
      if (user) {
        try {
            const userDocRef = doc(firestore, 'user_data', user.uid);
            await setDoc(userDocRef, { customOrder: newOrder }, { merge: true });
        } catch (error) {
            console.error("Failed to save custom order to Firestore:", error);
        }
      } else {
        localStorage.setItem(CUSTOM_ORDER_KEY_LOCAL, JSON.stringify(newOrder));
      }
  }, [user]);

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
    let intervalId: number | undefined;

    const fetchAndSetInfo = async () => {
      if (!currentStation) return;
      
      let finalInfo: StationTrackInfo | null = null;
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

  // Effects to save state changes to localStorage
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

  const handleCycleVisualizerStyle = useCallback(() => {
    const currentIndex = VISUALIZER_STYLES.indexOf(visualizerStyle);
    const nextIndex = (currentIndex + 1) % VISUALIZER_STYLES.length;
    const newStyle = VISUALIZER_STYLES[nextIndex];
    setVisualizerStyle(newStyle);
    localStorage.setItem(VISUALIZER_STYLE_KEY, newStyle);
  }, [visualizerStyle]);

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
        const getPriorityIndex = (stationName: string): number => {
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

  const playStationAtIndex = useCallback((index: number) => {
    if (index >= 0 && index < stations.length) {
        localStorage.setItem(LAST_STATION_KEY, stations[index].stationuuid);
        setCurrentStationIndex(index);
        setIsPlaying(true); // Always play when selecting a new station
    }
  }, [stations]);

  const handleSelectStation = useCallback((station: Station) => {
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
              if (delta > 0) { // Pinch out -> bigger items
                  const newSize = Math.min(5, gridSize + 1) as GridSize;
                  handleSetGridSize(newSize);
              } else { // Pinch in -> smaller items
                  const newSize = Math.max(1, gridSize - 1) as GridSize;
                  handleSetGridSize(newSize);
              }
              pinchDistRef.current = currentDist;
          }
      }
  }, [gridSize, handleSetGridSize]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
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
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      <header className="p-4 bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-text-secondary hover:text-text-primary" aria-label="הגדרות">
              <MenuIcon className="w-6 h-6" />
            </button>
            
            <div className="flex items-center bg-gray-700 rounded-full p-1">
              <button 
                onClick={() => setFilter(StationFilter.All)}
                className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.All ? 'bg-accent text-white' : 'text-gray-300'}`}
              >
                {StationFilter.All}
              </button>
              <button 
                onClick={() => setFilter(StationFilter.Favorites)}
                className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${filter === StationFilter.Favorites ? 'bg-accent text-white' : 'text-gray-300'}`}
              >
                {StationFilter.Favorites}
              </button>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-bold text-accent">רדיו פרימיום</h1>
        </div>
        <div className="max-w-7xl mx-auto mt-4">
            <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-text-secondary">מיון:</span>
                <div className="flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center">
                    <SortButton label="אישי" order="custom" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <SortButton label="פופולריות" order="priority" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <button
                      onClick={() => {
                        if (sortOrder === 'name_asc') {
                          setSortOrder('name_desc');
                        } else {
                          setSortOrder('name_asc');
                        }
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        sortOrder.startsWith('name_') ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {sortOrder === 'name_desc' ? 'ת-א' : 'א-ת'}
                    </button>
                    <button
                      onClick={handleCategorySortClick}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        isCategorySortActive ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {categoryButtonLabel}
                    </button>
                </div>
            </div>
        </div>
      </header>

      <main 
        className="flex-grow pb-48"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading ? (
          <StationListSkeleton />
        ) : error ? (
          <p className="text-center text-red-400 p-4">{error}</p>
        ) : (
            displayedStations.length > 0 ? (
                <StationList
                    stations={displayedStations}
                    currentStation={currentStation}
                    onSelectStation={handleSelectStation}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    onReorder={handleReorder}
                    isStreamActive={isStreamActive}
                    isStatusIndicatorEnabled={isStatusIndicatorEnabled}
                    gridSize={gridSize}
                    sortOrder={sortOrder}
                />
            ) : (
                <div className="text-center p-8 text-text-secondary">
                    <h2 className="text-xl font-semibold">
                      {filter === StationFilter.Favorites ? 'אין תחנות במועדפים' : 'לא נמצאו תחנות'}
                    </h2>
                    <p>
                      {filter === StationFilter.Favorites ? 'אפשר להוסיף תחנות על ידי לחיצה על כפתור הכוכב.' : 'נסה לרענן את העמוד.'}
                    </p>
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
        user={user}
        authLoading={authLoading}
        signIn={signInWithGoogle}
        signOut={signOut}
      />

      {currentStation && (
         <NowPlaying
          isOpen={isNowPlayingOpen}
          onClose={() => setIsNowPlayingOpen(false)}
          station={currentStation}
          isPlaying={isPlaying}
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
        />
      )}
     
      <Player
        station={currentStation}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        eqPreset={eqPreset}
        customEqSettings={customEqSettings}
        volume={volume}
        onVolumeChange={handleSetVolume}
        trackInfo={trackInfo}
        showNextSong={showNextSong}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        setFrequencyData={setFrequencyData}
        onStreamStatusChange={setIsStreamActive}
        frequencyData={frequencyData}
        isVisualizerEnabled={isPlayerBarVisualizerEnabled}
      />
    </div>
  );
}