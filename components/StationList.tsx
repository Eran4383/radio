import React, { useState } from 'react';
import { Station } from '../types';
import { StarIcon } from './Icons';

interface StationListProps {
  stations: Station[];
  currentStation: Station | null;
  onSelectStation: (station: Station) => void;
  isFavorite: (stationUuid: string) => boolean;
  toggleFavorite: (stationUuid: string) => void;
  onReorder: (newOrder: string[]) => void;
}

const StationList: React.FC<StationListProps> = ({ stations, currentStation, onSelectStation, isFavorite, toggleFavorite, onReorder }) => {
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

  return (
    <div 
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {listToRender.map(station => {
        const isBeingDragged = draggedUuid === station.stationuuid;

        const baseClasses = `relative rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transform transition-transform duration-500 ease-in-out`;
        const stateClasses = currentStation?.stationuuid === station.stationuuid 
            ? 'bg-accent/30 ring-2 ring-accent scale-105' 
            : 'bg-bg-secondary hover:bg-accent/10 hover:scale-105';
        const dragClasses = isBeingDragged ? 'dragging' : '';

        return (
          <div 
            key={station.stationuuid}
            draggable
            onDragStart={(e) => handleDragStart(e, station)}
            onDragOver={(e) => handleDragOver(e, station)}
            className={`${baseClasses} ${stateClasses} ${dragClasses}`}
            onClick={() => onSelectStation(station)}
          >
            <img 
              src={station.favicon} 
              alt={station.name} 
              className="w-24 h-24 rounded-md mb-3 bg-gray-700 object-contain pointer-events-none" // prevent img drag
              onError={(e) => { e.currentTarget.src = 'https://picsum.photos/96'; }}
            />
            <h4 className="font-semibold text-sm h-10 flex items-center pointer-events-none text-text-primary">{station.name}</h4>
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