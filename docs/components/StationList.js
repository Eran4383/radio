import React, { useState } from 'react';
import { StarIcon } from './Icons.js';
import { getCategory } from '../services/categoryService.js';

const getGridClasses = (size) => {
  switch (size) {
    case 1: return 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8'; // Smallest
    case 2: return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7';
    case 3: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'; // Default
    case 4: return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
    case 5: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'; // Largest
    default: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
  }
};

const getCardContentClasses = (size) => {
    switch (size) {
        case 1: return { img: 'w-16 h-16', text: 'text-xs h-8', padding: 'p-2' }; // Smallest
        case 2: return { img: 'w-20 h-20', text: 'text-sm h-10', padding: 'p-3' };
        case 3: return { img: 'w-24 h-24', text: 'text-sm h-10', padding: 'p-4' }; // Default
        case 4: return { img: 'w-28 h-28', text: 'text-base h-12', padding: 'p-4' };
        case 5: return { img: 'w-36 h-36', text: 'text-lg h-12', padding: 'p-4' }; // Largest
        default: return { img: 'w-24 h-24', text: 'text-sm h-10', padding: 'p-4' };
    }
};

const StationList = ({ 
    stations, sortOrder, currentStation, onSelectStation, isFavorite, toggleFavorite, onReorder,
    isStreamActive, isStatusIndicatorEnabled, gridSize
}) => {
  const [draggedUuid, setDraggedUuid] = useState(null);
  const [previewList, setPreviewList] = useState(null);
  
  const isDraggable = sortOrder === 'custom';
  const isGroupedView = sortOrder.startsWith('category_');

  const handleDragStart = (e, station) => {
    if (!isDraggable) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', station.stationuuid);
    setDraggedUuid(station.stationuuid);
  };

  const handleDragOver = (e, targetStation) => {
    if (!isDraggable) return;
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

  const handleDrop = (e) => {
    if (!isDraggable) return;
    e.preventDefault();
    if (previewList) {
      const newOrderUuids = previewList.map(s => s.stationuuid);
      onReorder(newOrderUuids);
    }
    setDraggedUuid(null);
    setPreviewList(null);
  };
  
  const handleDragEnd = () => {
    if (!isDraggable) return;
    setDraggedUuid(null);
    setPreviewList(null);
  };

  const cardContentClasses = getCardContentClasses(gridSize);
  
  const renderStationCard = (station) => {
    const isBeingDragged = draggedUuid === station.stationuuid;
    const isCurrentlyPlaying = currentStation?.stationuuid === station.stationuuid;

    const baseClasses = `relative rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transform transition-all duration-300 ease-in-out`;
    const stateClasses = isCurrentlyPlaying
        ? 'bg-accent/30 ring-2 ring-accent scale-105' 
        : 'bg-bg-secondary hover:bg-accent/10 hover:scale-105';
    const dragClasses = isBeingDragged ? 'dragging' : '';

    return (
      React.createElement("div", { 
        key: station.stationuuid,
        draggable: isDraggable,
        onDragStart: (e) => handleDragStart(e, station),
        onDragOver: (e) => handleDragOver(e, station),
        className: `${baseClasses} ${stateClasses} ${dragClasses} ${cardContentClasses.padding}`,
        onClick: () => onSelectStation(station)
      },
        isStatusIndicatorEnabled && isCurrentlyPlaying && (
            React.createElement("div", { 
                className: `absolute top-2 left-2 w-2.5 h-2.5 rounded-full ring-2 ring-bg-secondary transition-colors ${
                    isStreamActive ? 'bg-accent animate-pulse' : 'bg-text-secondary'
                }`,
                title: isStreamActive ? "התחנה משדרת" : "מתחבר..."
            })
        ),
        React.createElement("img", { 
          src: station.favicon, 
          alt: station.name, 
          className: `${cardContentClasses.img} rounded-md mb-2 bg-gray-700 object-contain pointer-events-none transition-all duration-300`,
          onError: (e) => { e.currentTarget.src = 'https://picsum.photos/96'; }
        }),
        React.createElement("h4", { className: `font-semibold pointer-events-none text-text-primary transition-all duration-300 flex items-center ${cardContentClasses.text}` }, station.name),
        React.createElement("button", {
          onClick: (e) => {
            e.stopPropagation();
            toggleFavorite(station.stationuuid);
          },
          className: "absolute top-2 right-2 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors",
          "aria-label": isFavorite(station.stationuuid) ? "הסר ממועדפים" : "הוסף למועדפים"
        },
          React.createElement(StarIcon, { className: `w-5 h-5 ${isFavorite(station.stationuuid) ? 'text-yellow-400' : 'text-text-secondary'}` })
        )
      )
    );
  };

  const gridClasses = getGridClasses(gridSize);

  if (isGroupedView) {
      const categoryType = sortOrder.replace('category_', '');
      const groups = [];
      if (stations.length > 0) {
          let currentCategory = getCategory(stations[0], categoryType);
          let currentStations = [];
          for (const station of stations) {
              const stationCategory = getCategory(station, categoryType);
              if (stationCategory === currentCategory) {
                  currentStations.push(station);
              } else {
                  if (currentStations.length > 0) {
                      groups.push({ categoryTitle: currentCategory, stations: currentStations });
                  }
                  currentCategory = stationCategory;
                  currentStations = [station];
              }
          }
          if (currentStations.length > 0) {
              groups.push({ categoryTitle: currentCategory, stations: currentStations });
          }
      }
      
      return (
          React.createElement("div", { className: "p-4 space-y-8" },
              groups.map((group, index) => (
                  React.createElement("div", { key: `${group.categoryTitle}-${index}` },
                      React.createElement("h2", { className: "text-xl font-bold text-accent mb-4 px-2" },
                          group.categoryTitle
                      ),
                      React.createElement("div", { className: `grid ${gridClasses} gap-4` },
                          group.stations.map(renderStationCard)
                      )
                  )
              ))
          )
      );
  }

  // Default: Flat grid view
  const listToRender = previewList || stations;
  return (
    React.createElement("div", { 
      className: `grid ${gridClasses} gap-4 p-4`,
      onDragOver: (e) => isDraggable && e.preventDefault(),
      onDrop: handleDrop,
      onDragEnd: handleDragEnd
    },
      listToRender.map(renderStationCard)
    )
  );
};

export default StationList;