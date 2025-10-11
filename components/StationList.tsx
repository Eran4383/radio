import React, { useState } from 'react';
import { Station, GridSize } from '../types';
import { StarIcon } from './Icons';

interface StationListProps {
  stations: Station[];
  currentStation: Station | null;
  onSelectStation: (station: Station) => void;
  isFavorite: (stationUuid: string) => boolean;
  toggleFavorite: (stationUuid: string) => void;
  onReorder: (newOrder: string[]) => void;
  isStreamActive: boolean;
  isStatusIndicatorEnabled: boolean;
  gridSize: GridSize;
}

const getGridClasses = (size: GridSize) => {
  switch (size) {
    case 1: return 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8'; // Smallest
    case 2: return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7';
    case 3: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'; // Default
    case 4: return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
    case 5: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'; // Largest
    default: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
  }
};

const getCardContentClasses = (size: GridSize) => {
    switch (size) {
        case 1: return { img: 'w-16 h-16', text: 'text-xs h-8', padding: 'p-2' }; // Smallest
        case 2: return { img: 'w-20 h-20', text: 'text-sm h-10', padding: 'p-3' };
        case 3: return { img: 'w-24 h-24', text: 'text-sm h-10', padding: 'p-4' }; // Default
        case 4: return { img: 'w-28 h-28', text: 'text-base h-12', padding: 'p-4' };
        case 5: return { img: 'w-36 h-36', text: 'text-lg h-12', padding: 'p-4' }; // Largest
        default: return { img: 'w-24 h-24', text: 'text-sm h-10', padding: 'p-4' };
    }
};

const StationList: React.FC<StationListProps> = ({ 
    stations, currentStation, onSelectStation, isFavorite, toggleFavorite, onReorder,
    isStreamActive, isStatusIndicatorEnabled, gridSize
}) => {
  const [draggedUuid, setDraggedUuid] = useState<string | null>(null);
  const [previewList, setPreviewList] = useState<Station[] | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, station: Station) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', station.stationuuid);
    setDraggedUuid(station.stationuuid);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetStation: Station) => {
    e.preventDefault();
    if (!draggedUuid || draggedUuid === targetStation.stationuuid) return;

    const currentList = previewList || stations;
    const draggedIndex = currentList.findIndex(s => s.stationuuid === draggedUuid);
    const targetIndex = currentList.findIndex(s => s.stationuuid === targetStation.stationuuid);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

    const reorderedStations = [...currentList];
    const [draggedItem] = reorderedStations.splice(draggedIndex, 1);
    reorderedStations.splice(targetIndex, 0, draggedItem);

    setPreviewList(reorderedStations);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (previewList) {
      const newOrderUuids = previewList.map(s => s.stationuuid);
      onReorder(newOrderUuids);
    }
    setDraggedUuid(null);
    setPreviewList(null);
  };
  
  const handleDragEnd = () => {
    setDraggedUuid(null);
    setPreviewList(null);
  };

  const listToRender = previewList || stations;
  const gridClasses = getGridClasses(gridSize);
  const cardContentClasses = getCardContentClasses(gridSize);

  return (
    <div 
      className={`grid ${gridClasses} gap-4 p-4`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {listToRender.map(station => {
        const isBeingDragged = draggedUuid === station.stationuuid;
        const isCurrentlyPlaying = currentStation?.stationuuid === station.stationuuid;

        const baseClasses = `relative rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transform transition-all duration-300 ease-in-out`;
        const stateClasses = isCurrentlyPlaying
            ? 'bg-accent/30 ring-2 ring-accent scale-105' 
            : 'bg-bg-secondary hover:bg-accent/10 hover:scale-105';
        const dragClasses = isBeingDragged ? 'dragging' : '';

        return (
          <div 
            key={station.stationuuid}
            draggable
            onDragStart={(e) => handleDragStart(e, station)}
            onDragOver={(e) => handleDragOver(e, station)}
            className={`${baseClasses} ${stateClasses} ${dragClasses} ${cardContentClasses.padding}`}
            onClick={() => onSelectStation(station)}
          >
            {isStatusIndicatorEnabled && isCurrentlyPlaying && (
                <div 
                    className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ring-2 ring-bg-secondary transition-colors ${
                        isStreamActive ? 'bg-accent animate-pulse' : 'bg-text-secondary'
                    }`}
                    title={isStreamActive ? "התחנה משדרת" : "מתחבר..."}
                />
            )}
            <img 
              src={station.favicon} 
              alt={station.name} 
              className={`${cardContentClasses.img} rounded-md mb-2 bg-gray-700 object-contain pointer-events-none transition-all duration-300`}
              onError={(e) => { e.currentTarget.src = 'https://picsum.photos/96'; }}
            />
            <h4 className={`font-semibold pointer-events-none text-text-primary transition-all duration-300 flex items-center ${cardContentClasses.text}`}>{station.name}</h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(station.stationuuid);
              }}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
              aria-label={isFavorite(station.stationuuid) ? "הסר ממועדפים" : "הוסף למועדפים"}
            >
              <StarIcon className={`w-5 h-5 ${isFavorite(station.stationuuid) ? 'text-yellow-400' : 'text-text-secondary'}`} />
            </button>
          </div>
        )
      })}
    </div>
  );
};

export default StationList;
