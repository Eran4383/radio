import React, { useState } from 'react';
import { CopyIcon, YouTubeMusicIcon, SpotifyIcon, LyricsIcon } from './Icons.js';

const ActionButton = ({ onClick, icon, label, className }) => (
    React.createElement("button", {
        onClick: onClick,
        className: `flex flex-col items-center justify-center gap-2 p-6 rounded-2xl text-white font-bold text-center transition-transform transform hover:scale-105 active:scale-95 ${className}`
    },
        icon,
        React.createElement("span", null, label)
    )
);

const ActionMenu = ({ isOpen, onClose, songTitle }) => {
  const [copyStatus, setCopyStatus] = useState('idle');

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
    window.open(`youtubemusic://search?q=${query}`);
    onClose();
  };

  const handleSearchSpotify = () => {
    const query = encodeURIComponent(songTitle);
    window.open(`spotify:search:${query}`);
    onClose();
  };
  
  const handleSearchLyrics = () => {
      const query = encodeURIComponent(`${songTitle} lyrics`);
      window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
      onClose();
  };

  return (
    React.createElement(React.Fragment, null,
      React.createElement("div", {
        className: `action-menu-overlay fixed inset-0 bg-black/70 z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`,
        onClick: onClose,
        "aria-hidden": "true"
      }),
      React.createElement("div", {
        className: `action-menu-container fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary p-4 rounded-t-2xl shadow-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "action-menu-title"
      },
        React.createElement("div", { className: "w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-4" }),
        React.createElement("h2", { id: "action-menu-title", className: "text-lg font-bold text-center text-text-primary mb-6 truncate px-4" },
          songTitle
        ),
        React.createElement("div", { className: "grid grid-cols-2 gap-4" },
            React.createElement(ActionButton, { 
                onClick: handleCopy,
                icon: React.createElement(CopyIcon, { className: "w-8 h-8" }),
                label: copyStatus === 'idle' ? 'העתק שם' : 'הועתק!',
                className: "action-btn-copy"
            }),
            React.createElement(ActionButton, { 
                onClick: handleSearchYouTubeMusic,
                icon: React.createElement(YouTubeMusicIcon, { className: "w-8 h-8" }),
                label: "YouTube Music",
                className: "action-btn-ytmusic"
            }),
            React.createElement(ActionButton, { 
                onClick: handleSearchSpotify,
                icon: React.createElement(SpotifyIcon, { className: "w-8 h-8" }),
                label: "Spotify",
                className: "action-btn-spotify"
            }),
            React.createElement(ActionButton, { 
                onClick: handleSearchLyrics,
                icon: React.createElement(LyricsIcon, { className: "w-8 h-8" }),
                label: "חיפוש מילים",
                className: "action-btn-lyrics"
            })
        )
      )
    )
  );
};

export default ActionMenu;