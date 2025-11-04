import React, { useRef, useEffect } from 'react';

const MarqueeText = ({ 
    children, className, loopDelay, duration, startAnimation, isOverflowing, contentRef, onClick 
}) => {
    const marqueeDivRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const element = marqueeDivRef.current;
        // Effect should only run when the marquee is active (overflowing and has an element).
        if (!isOverflowing || !element) {
            return;
        }

        const handleIteration = () => {
            // Use the ref to ensure we're acting on the current DOM element.
            if (marqueeDivRef.current) {
                marqueeDivRef.current.style.animationPlayState = 'paused';
            }
            
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = window.setTimeout(() => {
                if (marqueeDivRef.current) {
                    marqueeDivRef.current.style.animationPlayState = 'running';
                }
            }, loopDelay * 1000);
        };

        element.addEventListener('animationiteration', handleIteration);
        
        // Set the initial play state. This will also apply when startAnimation changes.
        element.style.animationPlayState = startAnimation ? 'running' : 'paused';

        // Cleanup function for when the effect re-runs or the component unmounts.
        return () => {
            element.removeEventListener('animationiteration', handleIteration);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [startAnimation, loopDelay, isOverflowing, duration]); // Added isOverflowing and duration to dependencies

    const wrapperClasses = `w-full ${className || ''}`;

    if (!isOverflowing) {
        return (
            React.createElement("div", { className: `truncate ${wrapperClasses}`, onClick: onClick },
                React.createElement("span", { ref: contentRef, className: "inline-block" },
                    children
                )
            )
        );
    }
    
    // FIX: Use `any` type for the style object to allow for CSS custom properties which are not in the default React.CSSProperties type.
    const marqueeStyle = {
        '--marquee-duration': `${duration}s`,
    };

    return (
        React.createElement("div", { className: `marquee-wrapper ${wrapperClasses}`, onClick: onClick },
            React.createElement("div", { ref: marqueeDivRef, className: "animate-marquee inline-flex", style: marqueeStyle },
                React.createElement("span", { className: "pr-4 flex-shrink-0", ref: contentRef },
                    children
                ),
                React.createElement("span", { className: "pr-4 flex-shrink-0", "aria-hidden": "true" },
                    children
                )
            )
        )
    );
};

export default MarqueeText;