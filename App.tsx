import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchIsraeliStations } from './services/radioService';
import { Station, Theme, EqPreset, THEMES, EQ_PRESET_KEYS, VisualizerStyle, VISUALIZER_STYLES } from './types';
import Player from './components/Player';
import StationList from './components/StationList';
import SettingsPanel from './components/SettingsPanel';
import NowPlaying from './components/NowPlaying';
import { useFavorites } from './hooks/useFavorites';
import { PRIORITY_STATIONS } from './constants';
import { MenuIcon } from './components/Icons';
import { getCurrentProgram } from './services/scheduleService';


enum StationFilter {
  All = 'הכל',
  Favorites = 'מועדפים',
}

type SortOrder = 'priority' | 'name' | 'tags' | 'custom';

// LocalStorage Keys
const CUSTOM_ORDER_KEY = 'radio-station-custom-order';
const THEME_KEY = 'radio-theme';
const EQ_KEY = 'radio-eq';
const LAST_STATION_KEY = 'radio-last-station-uuid';
const LAST_FILTER_KEY = 'radio-last-filter';
const LAST_SORT_KEY = 'radio-last-sort';
const VOLUME_KEY = 'radio-volume';
const VISUALIZER_ENABLED_KEY = 'radio-visualizer-enabled';
const VISUALIZER_LOCKED_KEY = 'radio-visualizer-locked';
const VISUALIZER_STYLE_KEY = 'radio-visualizer-style';


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

export default function App() {
  const [stations, setStations] = useState<Station[]>([]);
  const [currentStationIndex, setCurrentStationIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(64));
  const [displayInfo, setDisplayInfo] = useState<string | null>(null);
  
  // State loaded from LocalStorage
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_ORDER_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filter, setFilter] = useState<StationFilter>(() => {
    const saved = localStorage.getItem(LAST_FILTER_KEY) as StationFilter;
    return (saved && Object.values(StationFilter).includes(saved)) ? saved : StationFilter.All;
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const savedSort = localStorage.getItem(LAST_SORT_KEY) as SortOrder;
    const customOrderExists = !!localStorage.getItem(CUSTOM_ORDER_KEY);

    if (savedSort) {
      if (savedSort === 'custom' && !customOrderExists) {
        // Fallback if 'custom' is saved but no custom order exists
      } else {
        return savedSort;
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

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem(VOLUME_KEY);
    return saved ? parseFloat(saved) : 1;
  });

  const [isVisualizerEnabled, setIsVisualizerEnabled] = useState<boolean>(() => {
      const saved = localStorage.getItem(VISUALIZER_ENABLED_KEY);
      return saved ? JSON.parse(saved) : true;
  });

  const [isVisualizerLocked, setIsVisualizerLocked] = useState<boolean>(() => {
      const saved = localStorage.getItem(VISUALIZER_LOCKED_KEY);
      return saved ? JSON.parse(saved) : false;
  });

  const [visualizerStyle, setVisualizerStyle] = useState<VisualizerStyle>(() => {
      const saved = localStorage.getItem(VISUALIZER_STYLE_KEY) as VisualizerStyle;
      return (saved && VISUALIZER_STYLES.includes(saved)) ? saved : 'bars';
  });

  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
  const currentStation = useMemo(() => {
     if (currentStationIndex !== null && stations[currentStationIndex]) {
        return stations[currentStationIndex];
     }
     return null;
  }, [stations, currentStationIndex]);

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

    const fetchAndSetDisplayInfo = async () => {
      if (!currentStation) return;
      
      let info: string | null = null;
      let isLiveInfoUseful = false;

      try {
        const response = await fetch(`https://de1.api.radio-browser.info/json/stations/check?uuids=${currentStation.stationuuid}`);
        if (response.ok) {
          const data = await response.json();
          const songTitle = data?.[0]?.now_playing?.song?.title || data?.[0]?.title;
          
          if (songTitle && songTitle.toLowerCase() !== currentStation.name.toLowerCase()) {
            info = songTitle;
            isLiveInfoUseful = true;
          }
        }
      } catch (error) {
        console.warn("Could not fetch live track info:", error);
      }

      if (!isLiveInfoUseful) {
        const scheduledProgram = getCurrentProgram(currentStation.name);
        if (scheduledProgram) {
            info = scheduledProgram;
        }
      }
      
      setDisplayInfo(info);
    };

    if (isPlaying && currentStation) {
      fetchAndSetDisplayInfo(); 
      intervalId = window.setInterval(fetchAndSetDisplayInfo, 20000);
    } else {
      setDisplayInfo(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPlaying, currentStation]);

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
  
  const handleSetVisualizerEnabled = (enabled: boolean) => {
    setIsVisualizerEnabled(enabled);
    localStorage.setItem(VISUALIZER_ENABLED_KEY, JSON.stringify(enabled));
  };

  const handleSetVisualizerLocked = (locked: boolean) => {
    setIsVisualizerLocked(locked);
    localStorage.setItem(VISUALIZER_LOCKED_KEY, JSON.stringify(locked));
  };
  
  const handleCycleVisualizerStyle = useCallback(() => {
    if (isVisualizerLocked) return;
    const currentIndex = VISUALIZER_STYLES.indexOf(visualizerStyle);
    const nextIndex = (currentIndex + 1) % VISUALIZER_STYLES.length;
    const newStyle = VISUALIZER_STYLES[nextIndex];
    setVisualizerStyle(newStyle);
    localStorage.setItem(VISUALIZER_STYLE_KEY, newStyle);
  }, [visualizerStyle, isVisualizerLocked]);

  const saveCustomOrder = (newOrder: string[]) => {
      setCustomOrder(newOrder);
      localStorage.setItem(CUSTOM_ORDER_KEY, JSON.stringify(newOrder));
  }

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
        setIsPlaying(true);
    }
  }, [stations]);

  const handleSelectStation = useCallback((station: Station) => {
    const stationIndexInMainList = stations.findIndex(s => s.stationuuid === station.stationuuid);
    if (stationIndexInMainList !== -1) {
        localStorage.setItem(LAST_STATION_KEY, station.stationuuid);
        if (currentStationIndex === stationIndexInMainList) {
          setIsPlaying(prev => !prev);
        } else {
          setCurrentStationIndex(stationIndexInMainList);
          setIsPlaying(true);
        }
    }
  }, [stations, currentStationIndex]);

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
            
            <h1 className="text-xl sm:text-2xl font-bold text-accent">רדיו דרכים</h1>
        </div>
        <div className="max-w-7xl mx-auto mt-4">
            <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-text-secondary">מיון:</span>
                <div className="flex items-center bg-gray-700 rounded-full p-1 gap-1 flex-wrap justify-center">
                    <SortButton label="אישי" order="custom" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <SortButton label="פופולריות" order="priority" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <SortButton label="שם" order="name" currentOrder={sortOrder} setOrder={setSortOrder} />
                    <SortButton label="ז'אנר" order="tags" currentOrder={sortOrder} setOrder={setSortOrder} />
                </div>
            </div>
        </div>
      </header>

      <main className="flex-grow pb-48"> {/* Padding bottom to clear player */}
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-accent"></div>
          </div>
        )}
        {error && <p className="text-center text-red-400 p-4">{error}</p>}
        {!isLoading && !error && (
            displayedStations.length > 0 ? (
                <StationList
                    stations={displayedStations}
                    currentStation={currentStation}
                    onSelectStation={handleSelectStation}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    onReorder={handleReorder}
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
        isVisualizerEnabled={isVisualizerEnabled}
        onVisualizerEnabledChange={handleSetVisualizerEnabled}
        isVisualizerLocked={isVisualizerLocked}
        onVisualizerLockedChange={handleSetVisualizerLocked}
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
          displayInfo={displayInfo}
          frequencyData={frequencyData}
          visualizerStyle={visualizerStyle}
          isVisualizerEnabled={isVisualizerEnabled}
          isVisualizerLocked={isVisualizerLocked}
          onCycleVisualizerStyle={handleCycleVisualizerStyle}
        />
      )}
     
      <Player
        station={currentStation}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        eqPreset={eqPreset}
        volume={volume}
        onVolumeChange={handleSetVolume}
        displayInfo={displayInfo}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        setFrequencyData={setFrequencyData}
      />
    </div>
  );
}