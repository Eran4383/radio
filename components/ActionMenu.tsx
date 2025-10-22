import React, { useState } from 'react';
import { CopyIcon, YouTubeMusicIcon, SpotifyIcon, LyricsIcon } from './Icons';

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  songTitle: string | null;
}

// Re-creating the ActionButton component locally for easier styling
const ActionButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    className: string;
}> = ({ onClick, icon, label, className }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl text-white font-bold text-center transition-transform transform hover:scale-105 active:scale-95 ${className}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);


const ActionMenu: React.FC<ActionMenuProps> = ({ isOpen, onClose, songTitle }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  if (!isOpen || !songTitle) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(songTitle).then(() => {
        setCopyStatus('copied');
        setTimeout(() => {
            setCopyStatus('idle');
            onClose();
        }, 1000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      onClose();
    });
  };

  const handleSearchYouTubeMusic = () => {
    const query = encodeURIComponent(songTitle);
    // This deep link attempts to open the app. Fallback might be needed for browsers.
    window.open(`youtubemusic://search?q=${query}`);
    onClose();
  };

  const handleSearchSpotify = () => {
    const query = encodeURIComponent(songTitle);
    // Spotify's search deep link
    window.open(`spotify:search:${query}`);
    onClose();
  };
  
  const handleSearchLyrics = () => {
      const query = encodeURIComponent(`${songTitle} lyrics`);
      window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
      onClose();
  };


  return (
    <>
      <div
        className={`action-menu-overlay fixed inset-0 bg-black/70 z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`action-menu-container fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary p-4 rounded-t-2xl shadow-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-menu-title"
      >
        <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4"></div>
        <h2 id="action-menu-title" className="text-lg font-bold text-center text-text-primary mb-6 truncate px-4">
          {songTitle}
        </h2>
        <div className="grid grid-cols-2 gap-4">
            <ActionButton 
                onClick={handleCopy}
                icon={<CopyIcon className="w-8 h-8"/>}
                label={copyStatus === 'idle' ? 'העתק שם' : 'הועתק!'}
                className="action-btn-copy"
            />
             <ActionButton 
                onClick={handleSearchYouTubeMusic}
                icon={<YouTubeMusicIcon className="w-8 h-8"/>}
                label="YouTube Music"
                className="action-btn-ytmusic"
            />
             <ActionButton 
                onClick={handleSearchSpotify}
                icon={<SpotifyIcon className="w-8 h-8"/>}
                label="Spotify"
                className="action-btn-spotify"
            />
             <ActionButton 
                onClick={handleSearchLyrics}
                icon={<LyricsIcon className="w-8 h-8"/>}
                label="חיפוש מילים"
                className="action-btn-lyrics"
            />
        </div>
      </div>
    </>
  );
};

export default ActionMenu;