import React, { useState, useRef, useCallback } from 'react';

interface InteractiveTextProps {
  text: string;
  className?: string;
}

const InteractiveText: React.FC<InteractiveTextProps> = ({ text, className }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const handleSearch = useCallback(() => {
    const query = encodeURIComponent(text);
    window.open(`https://music.youtube.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  }, [text]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }, [text]);

  const handlePressStart = useCallback(() => {
    isLongPress.current = false;
    timerRef.current = window.setTimeout(() => {
      isLongPress.current = true;
      handleCopy();
    }, 500);
  }, [handleCopy]);

  const handlePressEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPress.current) {
      handleSearch();
    }
  }, [handleSearch]);

  const combinedClassName = `font-semibold cursor-pointer transition-colors hover:text-accent ${className || ''}`;

  return (
    <span
      className={combinedClassName}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Search for ${text} on YouTube Music, long press to copy`}
    >
      {copied ? 'הועתק!' : text}
    </span>
  );
};

export default InteractiveText;
