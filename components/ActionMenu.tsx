import React, { useState } from 'react';
import { CopyIcon, YouTubeMusicIcon, SpotifyIcon, LyricsIcon } from './Icons';

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  songTitle: string | null;
}

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
        <h2 id="action-menu-title" className="text-lg font-bold text-center text-text-primary mb-4 truncate px-4">
          {songTitle}
        </h2>
        <div className="space-y-2">
            <button onClick={handleCopy} className="w-full flex items-center gap-4 p-4 rounded-lg bg-bg-primary hover:bg-accent/10 transition-colors">
                <CopyIcon className="w-6 h-6 text-accent"/>
                <span className="font-semibold">{copyStatus === 'idle' ? 'העתק שם השיר' : 'הועתק!'}</span>
            </button>
             <button onClick={handleSearchYouTubeMusic} className="w-full flex items-center gap-4 p-4 rounded-lg bg-bg-primary hover:bg-accent/10 transition-colors">
                <YouTubeMusicIcon className="w-6 h-6 text-accent"/>
                <span className="font-semibold">חפש ב-YouTube Music</span>
            </button>
             <button onClick={handleSearchSpotify} className="w-full flex items-center gap-4 p-4 rounded-lg bg-bg-primary hover:bg-accent/10 transition-colors">
                <SpotifyIcon className="w-6 h-6 text-accent"/>
                <span className="font-semibold">חפש ב-Spotify</span>
            </button>
             <button onClick={handleSearchLyrics} className="w-full flex items-center gap-4 p-4 rounded-lg bg-bg-primary hover:bg-accent/10 transition-colors">
                <LyricsIcon className="w-6 h-6 text-accent"/>
                <span className="font-semibold">חפש מילים בגוגל</span>
            </button>
        </div>
      </div>
    </>
  );
};

export default ActionMenu;