import React, { useRef } from 'react';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, VolumeUpIcon, ChevronDownIcon } from './Icons.js';
import Visualizer from './Visualizer.js';

const NowPlaying = ({
  isOpen, onClose, station, isPlaying, onPlayPause, onNext, onPrev, 
  volume, onVolumeChange, displayInfo, frequencyData,
  visualizerStyle, isVisualizerEnabled, isVisualizerLocked, onCycleVisualizerStyle
}) => {
    const touchStartY = useRef(0);
    const touchStartX = useRef(0);
    const dragRef = useRef(null);

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
    };
    
    const handleTouchMove = (e) => {
        const deltaY = e.targetTouches[0].clientY - touchStartY.current;
        if (deltaY > 0 && dragRef.current) { // only for swipe down
             dragRef.current.style.transform = `translateY(${deltaY}px)`;
             dragRef.current.style.transition = 'none';
        }
    };

    const handleTouchEnd = (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;

        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) { // Horizontal swipe
            if (Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    onPrev();
                } else {
                    onNext();
                }
            }
        } else { // Vertical swipe
            if (deltaY > 70) {
                onClose();
            }
        }
        
        if (dragRef.current) {
            dragRef.current.style.transform = '';
            dragRef.current.style.transition = '';
        }

        touchStartX.current = 0;
        touchStartY.current = 0;
    };

    const defaultInfo = station ? `${station.codec} @ ${station.bitrate}kbps` : '...';

    return (
      React.createElement("div", { 
        ref: dragRef,
        className: `fixed inset-0 bg-bg-primary z-50 flex flex-col h-full transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd
      },
        // Header
        React.createElement("div", { className: "flex-shrink-0 text-center pt-4 px-4" },
            React.createElement("button", { onClick: onClose, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "סגור" },
                React.createElement(ChevronDownIcon, { className: "w-8 h-8 mx-auto" })
            )
        ),
        // Main Content - Scrollable
        React.createElement("div", { className: "flex-grow flex flex-col items-center justify-center gap-4 text-center overflow-y-auto py-4 px-4" },
            React.createElement("img", { 
              src: station?.favicon || 'https://picsum.photos/256', 
              alt: station?.name || 'תחנה', 
              className: "w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl bg-gray-700 object-cover shadow-2xl flex-shrink-0",
              onError: (e) => { e.currentTarget.src = 'https://picsum.photos/256'; }
            }),
            React.createElement("div", { className: "flex-shrink-0" },
                React.createElement("h2", { className: "text-2xl sm:text-3xl font-bold text-text-primary" }, station?.name || 'טוען...'),
                React.createElement("p", { className: "text-base text-text-secondary mt-1" }, displayInfo || defaultInfo)
            ),
            React.createElement("div", { className: "w-full max-w-sm px-4 flex-shrink-0" },
                isVisualizerEnabled && (
                    React.createElement(Visualizer, { 
                        frequencyData: frequencyData,
                        style: visualizerStyle,
                        onClick: onCycleVisualizerStyle,
                        isLocked: isVisualizerLocked
                    })
                )
            )
        ),
        // Controls
        React.createElement("div", { className: "flex-shrink-0 flex flex-col items-center gap-4 sm:gap-6 pb-4 sm:pb-8 px-4" },
            React.createElement("div", { className: "flex items-center justify-center gap-4" },
              React.createElement("button", { onClick: onPrev, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "הקודם" },
                React.createElement(SkipNextIcon, { className: "w-12 h-12" })
              ),
              React.createElement("button", { 
                onClick: onPlayPause, 
                className: "p-5 bg-accent text-white rounded-full shadow-lg hover:bg-accent-hover transition-transform transform hover:scale-105",
                "aria-label": isPlaying ? "השהה" : "נגן"
              },
                isPlaying ? React.createElement(PauseIcon, { className: "w-14 h-14" }) : React.createElement(PlayIcon, { className: "w-14 h-14" })
              ),
              React.createElement("button", { onClick: onNext, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "הבא" },
                React.createElement(SkipPreviousIcon, { className: "w-12 h-12" })
              )
            ),
            React.createElement("div", { className: "w-full max-w-xs flex items-center gap-3" },
              React.createElement(VolumeUpIcon, { className: "w-6 h-6 text-text-secondary flex-shrink-0" }),
              React.createElement("input", {
                type: "range",
                min: "0",
                max: "1",
                step: "0.05",
                value: volume,
                onChange: (e) => onVolumeChange(parseFloat(e.target.value)),
                className: "w-full accent-teal-500",
                "aria-label": "עוצמת שמע"
              })
            )
        )
      )
    );
};

export default NowPlaying;