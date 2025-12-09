
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, VolumeUpIcon, ChevronDownIcon, FastForwardIcon, RewindIcon } from './Icons.js';
import Visualizer from './Visualizer.js';
import InteractiveText from './InteractiveText.js';
import MarqueeText from './MarqueeText.js';

const NowPlaying = ({
  isOpen, onClose, station, isPlaying, onPlayPause, onNext, onPrev, 
  volume, onVolumeChange, trackInfo, showNextSong, frequencyData,
  visualizerStyle, isVisualizerEnabled, onCycleVisualizerStyle,
  isVolumeControlVisible, marqueeDelay,
  isMarqueeProgramEnabled, isMarqueeCurrentTrackEnabled, isMarqueeNextTrackEnabled, marqueeSpeed,
  onOpenActionMenu,
  isVisualizerFullscreen, setIsVisualizerFullscreen,
  isSmartPlayerActive, onSmartNext, onSmartPrev
}) => {
    const dragRef = useRef(null);
    const scrollRef = useRef(null);
    const [startAnimation, setStartAnimation] = useState(false);
    
    const stationNameRef = useRef(null);
    const programNameRef = useRef(null);
    const currentTrackRef = useRef(null);
    const nextTrackRef = useRef(null);
    const [marqueeConfig, setMarqueeConfig] = useState({ duration: 0, isOverflowing: [false, false, false, false] });
    
    // Refs for gesture detection
    const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
    const longPressTimerRef = useRef(null);
    const hasMoved = useRef(false);
    const isDraggingModal = useRef(false);

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
    }, [station, trackInfo, showNextSong, marqueeSpeed, isOpen, isVisualizerFullscreen]);

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const handleTouchStart = (e) => {
        clearLongPressTimer();
        const target = e.target;
        const isVisualizerArea = target.closest('.visualizer-interaction-area');
        isDraggingModal.current = false;

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
            hasMoved.current = false;

            if (isVisualizerArea) {
                longPressTimerRef.current = window.setTimeout(() => {
                    setIsVisualizerFullscreen(!isVisualizerFullscreen);
                    longPressTimerRef.current = null; // Mark as fired
                }, 500); // 500ms for long press
            }
        } else {
             clearLongPressTimer();
        }
    };
    
    const handleTouchMove = (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
            const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

            if (deltaX > 10 || deltaY > 10) {
                hasMoved.current = true;
                clearLongPressTimer();
            }

            if (!isVisualizerFullscreen) {
                 const dragDownY = touch.clientY - touchStartRef.current.y;
                 
                 let shouldDragModal = false;
                 // Only drag modal if pulling down
                 if (dragDownY > 0) {
                     // If we are in the scrollable content area, only drag modal if we are at the top
                     if (scrollRef.current && scrollRef.current.contains(e.target)) {
                         if (scrollRef.current.scrollTop <= 0) {
                             shouldDragModal = true;
                         }
                     } else {
                         // Touched outside scroll area (header/footer), always allow drag
                         shouldDragModal = true;
                     }
                 }

                 if (shouldDragModal && dragRef.current) {
                     isDraggingModal.current = true;
                     dragRef.current.style.transform = `translateY(${dragDownY}px)`;
                     dragRef.current.style.transition = 'none';
                 }
            }
        } else {
            clearLongPressTimer();
        }
    };

    const handleTouchEnd = (e) => {
        const target = e.target;
        const isVisualizerArea = target.closest('.visualizer-interaction-area');

        if (longPressTimerRef.current) {
            clearLongPressTimer();
            if (isVisualizerArea && !hasMoved.current) {
                 onCycleVisualizerStyle();
            }
        }
        
        if (!isVisualizerFullscreen) {
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;

            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) onPrev();
                else onNext();
            } else if (isDraggingModal.current && deltaY > 120) {
                onClose();
            }
        }
        
        if (dragRef.current) {
            dragRef.current.style.transform = '';
            dragRef.current.style.transition = '';
        }
        isDraggingModal.current = false;
    };

    return (
      React.createElement("div", { 
        ref: dragRef,
        className: `fixed bg-bg-primary z-50 flex flex-col h-full transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'} ${isVisualizerFullscreen ? 'inset-0' : 'inset-x-0 bottom-0'}`,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd
      },
        React.createElement("div", { className: isVisualizerFullscreen ? 'hidden' : 'flex-shrink-0 text-center pt-4 px-4' },
            React.createElement("button", { onClick: onClose, className: "p-2 text-text-secondary hover:text-text-primary", "aria-label": "סגור" },
                React.createElement(ChevronDownIcon, { className: "w-8 h-8 mx-auto" })
            )
        ),
        React.createElement("div", { 
            ref: scrollRef,
            className: `flex-grow flex flex-col items-center justify-center gap-4 text-center overflow-y-auto py-4 px-4 ${isVisualizerFullscreen ? 'h-full' : ''}` 
        },
            React.createElement("img", { 
              src: station?.favicon || 'https://picsum.photos/256', 
              alt: station?.name || 'תחנה', 
              className: `rounded-2xl bg-gray-700 object-cover shadow-2xl flex-shrink-0 transition-all duration-300 ${isVisualizerFullscreen ? 'hidden' : 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64'}`,
              onError: (e) => { e.currentTarget.src = 'https://picsum.photos/256'; }
            }),
            React.createElement("div", { className: `flex-shrink-0 w-full ${isVisualizerFullscreen ? 'hidden' : ''}`, key: station?.stationuuid },
                React.createElement("div", { className: "w-full px-4" },
                    React.createElement(MarqueeText, { 
                        loopDelay: marqueeDelay,
                        duration: marqueeConfig.duration,
                        startAnimation: startAnimation,
                        isOverflowing: marqueeConfig.isOverflowing[0] && isMarqueeProgramEnabled,
                        contentRef: stationNameRef,
                        className: "text-2xl sm:text-3xl font-bold text-text-primary" },
                        React.createElement("span", null, station?.name || 'טוען...')
                    )
                ),
                React.createElement("div", { className: "mt-2 min-h-[4rem] flex flex-col justify-center items-center" },
                    React.createElement("div", { className: "w-full px-4 text-center" },
                        trackInfo?.program && !trackInfo.current && (
                            React.createElement(MarqueeText, { 
                                loopDelay: marqueeDelay,
                                duration: marqueeConfig.duration,
                                startAnimation: startAnimation,
                                isOverflowing: marqueeConfig.isOverflowing[1] && isMarqueeProgramEnabled,
                                contentRef: programNameRef,
                                className: "text-lg text-text-primary opacity-80" },
                                React.createElement("span", null, trackInfo.program)
                            )
                        ),
                        trackInfo?.current && (
                            React.createElement(React.Fragment, null,
                                trackInfo.program && (
                                    React.createElement(MarqueeText, { 
                                        loopDelay: marqueeDelay,
                                        duration: marqueeConfig.duration,
                                        startAnimation: startAnimation,
                                        isOverflowing: marqueeConfig.isOverflowing[1] && isMarqueeProgramEnabled,
                                        contentRef: programNameRef,
                                        className: "text-base text-text-primary opacity-70" },
                                        React.createElement("span", null, trackInfo.program)
                                    )
                                ),
                                React.createElement("div", { className: "mt-1" },
                                    React.createElement(MarqueeText, { 
                                        loopDelay: marqueeDelay,
                                        duration: marqueeConfig.duration,
                                        startAnimation: startAnimation,
                                        isOverflowing: marqueeConfig.isOverflowing[2] && isMarqueeCurrentTrackEnabled,
                                        contentRef: currentTrackRef
                                    },
                                        React.createElement(InteractiveText, { text: trackInfo.current, className: "font-bold text-xl", onOpenActionMenu: onOpenActionMenu })
                                    )
                                )
                            )
                        )
                    ),
                    showNextSong && trackInfo?.next && (
                        React.createElement("div", { className: "w-full px-4 mt-2 flex items-center justify-center text-base text-text-secondary opacity-90" },
                            React.createElement("span", { className: "font-semibold flex-shrink-0" }, "הבא:\u00A0"),
                            React.createElement("div", { className: "min-w-0" },
                                React.createElement(MarqueeText, { 
                                    loopDelay: marqueeDelay,
                                    duration: marqueeConfig.duration,
                                    startAnimation: startAnimation,
                                    isOverflowing: marqueeConfig.isOverflowing[3] && isMarqueeNextTrackEnabled,
                                    contentRef: nextTrackRef
                                },
                                    React.createElement("span", null, trackInfo.next)
                                )
                            )
                        )
                    )
                )
            ),
            React.createElement("div", { className: `w-full max-w-sm px-4 flex-shrink-0 visualizer-interaction-area ${isVisualizerFullscreen ? 'w-full h-full max-w-none' : 'h-20'}` },
                isVisualizerEnabled && (
                    React.createElement(Visualizer, { 
                        frequencyData: frequencyData,
                        style: visualizerStyle
                    })
                )
            )
        ),
        React.createElement("div", { className: `flex-shrink-0 flex flex-col items-center gap-4 sm:gap-6 pb-4 sm:pb-8 px-4 ${isVisualizerFullscreen ? 'hidden' : ''}` },
            React.createElement("div", { className: "flex items-center justify-center gap-2 sm:gap-4" },
              React.createElement("button", { onClick: onPrev, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "תחנה קודמת" },
                React.createElement(SkipNextIcon, { className: "w-8 h-8 sm:w-12 sm:h-12" })
              ),
              
              isSmartPlayerActive && (
                  React.createElement("button", { onClick: onSmartPrev, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "שיר קודם" },
                    React.createElement(RewindIcon, { className: "w-6 h-6 sm:w-8 sm:h-8" })
                  )
              ),

              React.createElement("button", { 
                onClick: onPlayPause, 
                className: "p-5 bg-accent text-white rounded-full shadow-lg hover:bg-accent-hover transition-transform transform hover:scale-105",
                "aria-label": isPlaying ? "השהה" : "נגן"
              },
                isPlaying ? React.createElement(PauseIcon, { className: "w-10 h-10 sm:w-14 sm:h-14" }) : React.createElement(PlayIcon, { className: "w-10 h-10 sm:w-14 sm:h-14" })
              ),

              isSmartPlayerActive && (
                  React.createElement("button", { onClick: onSmartNext, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "שיר הבא" },
                    React.createElement(FastForwardIcon, { className: "w-6 h-6 sm:w-8 sm:h-8" })
                  )
              ),

              React.createElement("button", { onClick: onNext, className: "p-4 text-text-secondary hover:text-text-primary transition-colors duration-200", "aria-label": "תחנה הבאה" },
                React.createElement(SkipPreviousIcon, { className: "w-8 h-8 sm:w-12 sm:h-12" })
              )
            ),
            isVolumeControlVisible && (
              React.createElement("div", { className: "w-full max-w-xs flex items-center gap-3" },
                React.createElement(VolumeUpIcon, { className: "w-6 h-6 text-text-secondary flex-shrink-0" }),
                React.createElement("input", {
                  type: "range",
                  min: "0",
                  max: "1",
                  step: "0.01",
                  value: volume,
                  onChange: (e) => onVolumeChange(parseFloat(e.target.value)),
                  onWheel: (e) => {
                      const direction = e.deltaY > 0 ? -1 : 1;
                      const newVolume = Math.min(1, Math.max(0, volume + (direction * 0.05)));
                      onVolumeChange(newVolume);
                  },
                  className: "w-full accent-teal-500",
                  "aria-label": "עוצמת שמע"
                })
              )
            )
        )
      )
    );
};

export default NowPlaying;
