import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Station, VisualizerStyle, StationTrackInfo } from '../types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, VolumeUpIcon, ChevronDownIcon } from './Icons';
import Visualizer from './Visualizer';
import InteractiveText from './InteractiveText';
import MarqueeText from './MarqueeText';

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
  marqueeDelay: number;
  isMarqueeProgramEnabled: boolean;
  isMarqueeCurrentTrackEnabled: boolean;
  isMarqueeNextTrackEnabled: boolean;
  marqueeSpeed: number;
  onOpenActionMenu: (songTitle: string) => void;
  isVisualizerFullscreen: boolean;
  setIsVisualizerFullscreen: (isFull: boolean) => void;
}

const NowPlaying: React.FC<NowPlayingProps> = ({
  isOpen, onClose, station, isPlaying, onPlayPause, onNext, onPrev, 
  volume, onVolumeChange, trackInfo, showNextSong, frequencyData,
  visualizerStyle, isVisualizerEnabled, onCycleVisualizerStyle,
  isVolumeControlVisible, marqueeDelay,
  isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled, marqueeSpeed,
  onOpenActionMenu,
  isVisualizerFullscreen, setIsVisualizerFullscreen
}) => {
    const dragRef = useRef<HTMLDivElement>(null);
    const [startAnimation, setStartAnimation] = useState(false);
    
    const stationNameRef = useRef<HTMLSpanElement>(null);
    const programNameRef = useRef<HTMLSpanElement>(null);
    const currentTrackRef = useRef<HTMLSpanElement>(null);
    const nextTrackRef = useRef<HTMLSpanElement>(null);
    const [marqueeConfig, setMarqueeConfig] = useState<{ duration: number; isOverflowing: boolean[] }>({ duration: 0, isOverflowing: [false, false, false, false] });
    
    // Refs for gesture detection
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const longPressTimerRef = useRef<number | null>(null);
    const pinchDistRef = useRef(0);

    useEffect(() => {
      setStartAnimation(false);
      const timer = setTimeout(() => {
          setStartAnimation(true);
      }, 3000); 
  
      return () => clearTimeout(timer);
    }, [station?.stationuuid]);
    
    useEffect(() => {
        const calculateMarquee = () => {
            const refs = [stationNameRef, programNameRef, currentTrackRef, nextTrackRef];
            let maxContentWidth = 0;
            const newIsOverflowing = refs.map(ref => {
                const content = ref.current;
                if (!content) return false;
                
                const container = content.closest('.marquee-wrapper, .truncate');
                
                if (container && content.scrollWidth > container.clientWidth) {
                    maxContentWidth = Math.max(maxContentWidth, content.scrollWidth);
                    return true;
                }
                return false;
            });

            const anyOverflowing = newIsOverflowing.some(Boolean);
            const pixelsPerSecond = 3.668 * Math.pow(1.363, marqueeSpeed);
            const newDuration = anyOverflowing ? Math.max(5, maxContentWidth / pixelsPerSecond) : 0;
            
            setMarqueeConfig({ duration: newDuration, isOverflowing: newIsOverflowing });
        };

        const timeoutId = setTimeout(calculateMarquee, 50);
        return () => clearTimeout(timeoutId);
    }, [station, trackInfo, showNextSong, marqueeSpeed, isOpen]);

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        clearLongPressTimer();
        const target = e.target as HTMLElement;
        const isVisualizerArea = target.closest('.visualizer-interaction-area');

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

            if (isVisualizerArea && !isVisualizerFullscreen) {
                longPressTimerRef.current = window.setTimeout(() => {
                    setIsVisualizerFullscreen(true);
                    longPressTimerRef.current = null;
                }, 500);
            }
        } else if (e.touches.length === 2 && isVisualizerFullscreen) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        clearLongPressTimer();
        if (e.touches.length === 2 && isVisualizerFullscreen && pinchDistRef.current > 0) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDist = Math.sqrt(dx * dx + dy * dy);
            
            if (pinchDistRef.current - currentDist > 40) { // Pinch-in
                setIsVisualizerFullscreen(false);
                pinchDistRef.current = 0;
            }
        } else if (e.touches.length === 1 && !isVisualizerFullscreen) {
            const touch = e.touches[0];
            const deltaY = touch.clientY - touchStartRef.current.y;
            if (deltaY > 0 && dragRef.current) {
                 dragRef.current.style.transform = `translateY(${deltaY}px)`;
                 dragRef.current.style.transition = 'none';
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchDuration = Date.now() - touchStartRef.current.time;
        const target = e.target as HTMLElement;
        const isVisualizerArea = target.closest('.visualizer-interaction-area');

        if (longPressTimerRef.current) {
            clearLongPressTimer();
            if (isVisualizerArea && touchDuration < 500) {
                onCycleVisualizerStyle();
            }
        }

        if (!isVisualizerFullscreen) {
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;

            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 50) {
                if (deltaX > 0) onPrev();
                else onNext();
            } else if (deltaY > 70) {
                onClose();
            }
        }
        
        if (dragRef.current) {
            dragRef.current.style.transform = '';
            dragRef.current.style.transition = '';
        }
        pinchDistRef.current = 0;
    };

    return (
      <div 
        ref={dragRef}
        className={`fixed bg-bg-primary z-50 flex flex-col h-full transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'} ${isVisualizerFullscreen ? 'inset-0' : 'inset-x-0 bottom-0'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={isVisualizerFullscreen ? 'hidden' : 'flex-shrink-0 text-center pt-4 px-4'}>
            <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary" aria-label="סגור">
                <ChevronDownIcon className="w-8 h-8 mx-auto" />
            </button>
        </div>

        <div className={`flex-grow flex flex-col items-center justify-center gap-4 text-center overflow-y-auto py-4 px-4 ${isVisualizerFullscreen ? 'h-full' : ''}`}>
            <img 
              src={station?.favicon || 'https://picsum.photos/256'} 
              alt={station?.name || 'תחנה'} 
              className={`rounded-2xl bg-gray-700 object-cover shadow-2xl flex-shrink-0 transition-all duration-300 ${isVisualizerFullscreen ? 'hidden' : 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64'}`}
              onError={(e) => { e.currentTarget.src = 'https://picsum.photos/256'; }}
            />
            <div className={`flex-shrink-0 w-full ${isVisualizerFullscreen ? 'hidden' : ''}`} key={station?.stationuuid}>
                <div className="w-full px-4">
                    <MarqueeText 
                        loopDelay={marqueeDelay}
                        duration={marqueeConfig.duration}
                        startAnimation={startAnimation}
                        isOverflowing={marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled}
                        contentRef={stationNameRef}
                        className="text-2xl sm:text-3xl font-bold text-text-primary">
                        <span>{station?.name || 'טוען...'}</span>
                    </MarqueeText>
                </div>
                
                <div className="mt-2 min-h-[4rem] flex flex-col justify-center items-center">
                    <div className="w-full px-4 text-center">
                        {trackInfo?.program && !trackInfo.current && (
                            <MarqueeText 
                                loopDelay={marqueeDelay}
                                duration={marqueeConfig.duration}
                                startAnimation={startAnimation}
                                isOverflowing={marqueeConfig.isOverflowing[1] && isMarqueeProgramEnabled}
                                contentRef={programNameRef}
                                className="text-lg text-text-primary opacity-80">
                                <span>{trackInfo.program}</span>
                            </MarqueeText>
                        )}
                        {trackInfo?.current && (
                            <>
                                {trackInfo.program && (
                                    <MarqueeText 
                                        loopDelay={marqueeDelay}
                                        duration={marqueeConfig.duration}
                                        startAnimation={startAnimation}
                                        isOverflowing={marqueeConfig.isOverflowing[1] && isMarqueeProgramEnabled}
                                        contentRef={programNameRef}
                                        className="text-base text-text-primary opacity-70">
                                        <span>{trackInfo.program}</span>
                                    </MarqueeText>
                                )}
                                <div className="mt-1">
                                    <MarqueeText 
                                        loopDelay={marqueeDelay}
                                        duration={marqueeConfig.duration}
                                        startAnimation={startAnimation}
                                        isOverflowing={marqueeConfig.isOverflowing[2] && isMarqueeCurrentTrackEnabled}
                                        contentRef={currentTrackRef}
                                    >
                                        <InteractiveText text={trackInfo.current} className="font-bold text-xl" onOpenActionMenu={onOpenActionMenu}/>
                                    </MarqueeText>
                                </div>
                            </>
                        )}
                    </div>
                    {showNextSong && trackInfo?.next && (
                        <div className="w-full px-4 mt-2 flex items-center justify-center text-base text-text-secondary opacity-90">
                            <span className="font-semibold flex-shrink-0">הבא:&nbsp;</span>
                            <div className="min-w-0">
                                <MarqueeText 
                                    loopDelay={marqueeDelay}
                                    duration={marqueeConfig.duration}
                                    startAnimation={startAnimation}
                                    isOverflowing={marqueeConfig.isOverflowing[3] && isMarqueeNextTrackEnabled}
                                    contentRef={nextTrackRef}
                                >
                                    <span>{trackInfo.next}</span>
                                </MarqueeText>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className={`w-full max-w-sm px-4 flex-shrink-0 visualizer-interaction-area ${isVisualizerFullscreen ? 'w-full h-full max-w-none' : 'h-20'}`}>
                {isVisualizerEnabled && (
                    <Visualizer 
                        frequencyData={frequencyData}
                        style={visualizerStyle}
                    />
                )}
            </div>
        </div>
        
        <div className={`flex-shrink-0 flex flex-col items-center gap-4 sm:gap-6 pb-4 sm:pb-8 px-4 ${isVisualizerFullscreen ? 'hidden' : ''}`}>
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