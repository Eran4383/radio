import React, { useRef } from 'react';
import { Station, VisualizerStyle, StationTrackInfo } from '../types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, VolumeUpIcon, ChevronDownIcon } from './Icons';
import Visualizer from './Visualizer';

interface NowPlayingProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  trackInfo: StationTrackInfo | null;
  showNextSong: boolean;
  frequencyData: Uint8Array;
  visualizerStyle: VisualizerStyle;
  isVisualizerEnabled: boolean;
  onCycleVisualizerStyle: () => void;
  isVolumeControlVisible: boolean;
}

const NowPlaying: React.FC<NowPlayingProps> = ({
  isOpen, onClose, station, isPlaying, onPlayPause, onNext, onPrev, 
  volume, onVolumeChange, trackInfo, showNextSong, frequencyData,
  visualizerStyle, isVisualizerEnabled, onCycleVisualizerStyle,
  isVolumeControlVisible
}) => {
    const touchStartY = useRef(0);
    const touchStartX = useRef(0);
    const dragRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaY = e.targetTouches[0].clientY - touchStartY.current;
        if (deltaY > 0 && dragRef.current) { // only for swipe down
             dragRef.current.style.transform = `translateY(${deltaY}px)`;
             dragRef.current.style.transition = 'none';
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
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
    const primaryInfo = [trackInfo?.program, trackInfo?.current].filter(Boolean).join(' | ');

    return (
      <div 
        ref={dragRef}
        className={`fixed inset-0 bg-bg-primary z-50 flex flex-col h-full transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex-shrink-0 text-center pt-4 px-4">
            <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary" aria-label="סגור">
                <ChevronDownIcon className="w-8 h-8 mx-auto" />
            </button>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-grow flex flex-col items-center justify-center gap-4 text-center overflow-y-auto py-4 px-4">
            <img 
              src={station?.favicon || 'https://picsum.photos/256'} 
              alt={station?.name || 'תחנה'} 
              className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl bg-gray-700 object-cover shadow-2xl flex-shrink-0"
              onError={(e) => { e.currentTarget.src = 'https://picsum.photos/256'; }}
            />
            <div className="flex-shrink-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">{station?.name || 'טוען...'}</h2>
                <div className="mt-2">
                    <p className="text-lg text-text-primary">{primaryInfo || defaultInfo}</p>
                    {showNextSong && trackInfo?.next && (
                        <p className="text-base text-text-secondary mt-1 opacity-90">
                            <span className="font-semibold">הבא:</span> {trackInfo.next}
                        </p>
                    )}
                </div>
            </div>
            
            <div className="w-full max-w-sm px-4 flex-shrink-0">
                {isVisualizerEnabled && (
                    <Visualizer 
                        frequencyData={frequencyData}
                        style={visualizerStyle}
                        onClick={onCycleVisualizerStyle}
                    />
                )}
            </div>
        </div>
        
        {/* Controls */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4 sm:gap-6 pb-4 sm:pb-8 px-4">
            <div className="flex items-center justify-center gap-4">
              <button onClick={onPrev} className="p-4 text-text-secondary hover:text-text-primary transition-colors duration-200" aria-label="הקודם">
                <SkipNextIcon className="w-12 h-12" />
              </button>
              <button 
                onClick={onPlayPause} 
                className="p-5 bg-accent text-white rounded-full shadow-lg hover:bg-accent-hover transition-transform transform hover:scale-105"
                aria-label={isPlaying ? "השהה" : "נגן"}
              >
                {isPlaying ? <PauseIcon className="w-14 h-14" /> : <PlayIcon className="w-14 h-14" />}
              </button>
              <button onClick={onNext} className="p-4 text-text-secondary hover:text-text-primary transition-colors duration-200" aria-label="הבא">
                <SkipPreviousIcon className="w-12 h-12" />
              </button>
            </div>

            {isVolumeControlVisible && (
              <div className="w-full max-w-xs flex items-center gap-3">
                <VolumeUpIcon className="w-6 h-6 text-text-secondary flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-teal-500"
                  aria-label="עוצמת שמע"
                />
              </div>
            )}
        </div>
      </div>
    );
};

export default NowPlaying;