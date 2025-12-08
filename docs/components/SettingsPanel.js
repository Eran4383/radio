




import React, { useState, useEffect } from 'react';
import { THEMES, EQ_PRESET_KEYS, EQ_PRESET_LABELS, KEY_ACTION_LABELS } from '../types.js';
import Auth from './Auth.js';
import { ChevronDownIcon } from './Icons.js';

const releaseNotes = [
  {
    version: '1.0',
    date: '06.12.2025',
    features: [
        "אתחול גרסה רשמי.",
        "שיפור מנגנון זיהוי עדכונים באפליקציה מותקנת.",
        "תיקון באג ניגון אוטומטי (Autoplay) בדפדפנים.",
        "הוספת תמיכה בקיצורי מקלדת לדסקטופ."
    ],
  },
];

const currentVersionInfo = releaseNotes[0];

const DEFAULT_KEY_MAP = {
    playPause: [' ', 'Spacebar'],
    volumeUp: ['ArrowUp'],
    volumeDown: ['ArrowDown'],
    toggleMute: ['m', 'M', 'צ'],
    nextStation: ['ArrowRight'],
    prevStation: ['ArrowLeft'],
    toggleFullscreen: ['f', 'F', 'כ'],
    eqFlat: ['0'],
    eqBassBoost: ['1'],
    eqVocalBoost: ['2'],
    eqRock: ['3'],
    eqMovie: ['4'],
    eqCustom: ['5']
};


const SettingsButton = ({ label, isActive, onClick }) => (
    React.createElement("button", {
        onClick: onClick,
        className: `px-2 py-2 text-xs font-medium rounded-md transition-colors w-full min-h-[2.5rem] flex items-center justify-center text-center whitespace-normal leading-tight ${
            isActive ? 'bg-accent text-white' : 'bg-bg-primary hover:bg-accent/20'
        }`
    },
        label
    )
);

const ToggleSwitch = ({ label, enabled, onChange, disabled = false }) => (
     React.createElement("label", { className: `w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/10'} bg-bg-primary` },
        React.createElement("span", { className: "font-medium text-text-primary text-sm whitespace-normal leading-tight max-w-[70%]" }, label),
        React.createElement("div", { className: "relative inline-flex items-center cursor-pointer flex-shrink-0" },
            React.createElement("input", { 
                type: "checkbox", 
                checked: enabled, 
                onChange: (e) => !disabled && onChange(e.target.checked), 
                disabled: disabled,
                className: "sr-only peer",
                "aria-label": label
            }),
            React.createElement("div", { className: "w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent-focus peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" })
        )
    )
);

const EqSlider = ({ label, value, onChange }) => (
    React.createElement("div", { className: "flex flex-col gap-1" },
        React.createElement("div", { className: "flex justify-between text-xs text-text-secondary" },
            React.createElement("span", null, label),
            React.createElement("span", null, `${value > 0 ? '+' : ''}${value} dB`)
        ),
        React.createElement("input", {
            type: "range",
            min: "-10",
            max: "10",
            step: "1",
            value: value,
            onChange: (e) => onChange(parseInt(e.target.value, 10)),
            className: "w-full accent-teal-500 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer"
        })
    )
);

const SettingsSection = ({ title, children, isOpen, onToggle }) => {
    return (
        React.createElement("div", { className: "mb-4 bg-bg-secondary/50 rounded-lg border border-gray-700/50" },
            React.createElement("button", {
                onClick: onToggle,
                className: `w-full flex justify-between items-center p-3 bg-gray-800/50 hover:bg-gray-700/50 transition-colors ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`
            },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary" }, title),
                React.createElement(ChevronDownIcon, { className: `w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}` })
            ),
            isOpen && (
                React.createElement("div", { className: "p-3 space-y-3 border-t border-gray-700/30" },
                    children
                )
            )
        )
    );
};


const SettingsPanel = ({ 
    isOpen, onClose, user, isAdmin, onOpenAdminPanel, onLogin, onLogout, currentTheme, onThemeChange, currentEqPreset, onEqPresetChange,
    isNowPlayingVisualizerEnabled, onNowPlayingVisualizerEnabledChange,
    isPlayerBarVisualizerEnabled, onPlayerBarVisualizerEnabledChange,
    isStatusIndicatorEnabled, onStatusIndicatorEnabledChange, isVolumeControlVisible, onVolumeControlVisibleChange,
    showNextSong, onShowNextSongChange,
    customEqSettings, onCustomEqChange,
    gridSize, onGridSizeChange,
    isMarqueeProgramEnabled, onMarqueeProgramEnabledChange,
    isMarqueeCurrentTrackEnabled, onMarqueeCurrentTrackEnabledChange,
    isMarqueeNextTrackEnabled, onMarqueeNextTrackEnabledChange,
    marqueeSpeed, onMarqueeSpeedChange,
    marqueeDelay, onMarqueeDelayChange,
    updateStatus, onManualUpdateCheck,
    keyMap, onKeyMapChange,
    setIsRebinding
 }) => {
  const [isVersionHistoryVisible, setIsVersionHistoryVisible] = useState(false);
  const [listeningFor, setListeningFor] = useState(null);
  
  const [openSections, setOpenSections] = useState({
      theme: true,
      eq: true,
      interface: true,
      shortcuts: false
  });

  const toggleSection = (key) => {
      setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!listeningFor) return;

    const handleRebind = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        if (e.key === 'Escape') {
            setListeningFor(null);
            setIsRebinding(false);
            return;
        }

        const newKey = e.key;
        onKeyMapChange({ ...keyMap, [listeningFor]: [newKey] });
        setListeningFor(null);
        setIsRebinding(false);
    };

    window.addEventListener('keydown', handleRebind, { capture: true });
    return () => window.removeEventListener('keydown', handleRebind, { capture: true });
  }, [listeningFor, keyMap, onKeyMapChange, setIsRebinding]);

  const handleStartRebind = (action) => {
      setListeningFor(action);
      setIsRebinding(true);
  };

  const handleCancelRebind = (e) => {
      e.stopPropagation();
      setListeningFor(null);
      setIsRebinding(false);
  };

  const getUpdateStatusContent = () => {
      switch (updateStatus) {
        case 'checking':
          return 'בודק עדכונים...';
        case 'downloading':
          return 'מוריד עדכון...';
        case 'found':
          return 'העדכון מוכן להתקנה!';
        case 'not-found':
          return 'הגרסה עדכנית';
        case 'error':
          return 'שגיאה בבדיקה';
        case 'idle':
        default:
          return React.createElement("span", { className: "opacity-70" }, "לחץ לבדיקת עדכונים");
      }
    };

  return (
    React.createElement(React.Fragment, null,
      /* Overlay */
      React.createElement("div", { 
        className: `fixed inset-0 bg-black/60 z-30 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`,
        onClick: () => {
            if (listeningFor) {
                setListeningFor(null);
                setIsRebinding(false);
            }
            onClose();
        }
      }),
      
      /* Panel */
      React.createElement("div", { className: `fixed top-0 right-0 h-full w-72 bg-bg-secondary shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}` },
        React.createElement("div", { className: "p-4 flex flex-col h-full overflow-y-auto" },
            React.createElement("div", { className: "flex justify-between items-center mb-6 flex-shrink-0" },
                React.createElement("h2", { className: "text-xl font-bold text-text-primary" }, "הגדרות"),
                React.createElement(Auth, { user: user, onLogin: onLogin, onLogout: onLogout })
            ),

            isAdmin && (
                React.createElement("div", { className: "mb-6 animate-fade-in-up" },
                    React.createElement("button", {
                        onClick: () => { onClose(); onOpenAdminPanel(); },
                        className: "w-full bg-accent/20 hover:bg-accent/40 text-accent border border-accent/50 font-bold py-3 px-4 rounded-lg transition-all"
                    },
                        "🛠️ פאנל ניהול"
                    )
                )
            ),

            React.createElement(SettingsSection, { title: "ערכת נושא", isOpen: openSections.theme, onToggle: () => toggleSection('theme') },
                React.createElement("div", { className: "grid grid-cols-4 gap-2" },
                    THEMES.map(theme => (
                         React.createElement(SettingsButton, { 
                            key: theme,
                            label: theme,
                            isActive: currentTheme === theme, 
                            onClick: () => onThemeChange(theme) 
                        })
                    ))
                )
            ),

             React.createElement(SettingsSection, { title: "אקולייזר (EQ)", isOpen: openSections.eq, onToggle: () => toggleSection('eq') },
                React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-3" },
                    EQ_PRESET_KEYS.map(preset => (
                        React.createElement(SettingsButton, { 
                            key: preset,
                            label: EQ_PRESET_LABELS[preset],
                            isActive: currentEqPreset === preset, 
                            onClick: () => onEqPresetChange(preset) 
                        })
                    ))
                ),
                 currentEqPreset === 'custom' && (
                    React.createElement("div", { className: "p-3 rounded-lg bg-bg-primary space-y-3" },
                        React.createElement(EqSlider, { 
                            label: "בס (Bass)",
                            value: customEqSettings.bass,
                            onChange: (val) => onCustomEqChange({ ...customEqSettings, bass: val })
                        }),
                        React.createElement(EqSlider, { 
                            label: "אמצע (Mid)",
                            value: customEqSettings.mid,
                            onChange: (val) => onCustomEqChange({ ...customEqSettings, mid: val })
                        }),
                         React.createElement(EqSlider, { 
                            label: "גבוהים (Treble)",
                            value: customEqSettings.treble,
                            onChange: (val) => onCustomEqChange({ ...customEqSettings, treble: val })
                        })
                    )
                )
            ),

            React.createElement(SettingsSection, { title: "ממשק", isOpen: openSections.interface, onToggle: () => toggleSection('interface') },
                React.createElement("div", { className: "space-y-2" },
                    React.createElement("div", { className: "p-3 rounded-lg bg-bg-primary space-y-3" },
                       React.createElement("div", { className: "flex flex-col gap-1" },
                          React.createElement("div", { className: "flex justify-between text-sm font-medium text-text-primary" },
                              React.createElement("span", null, "גודל תצוגה")
                          ),
                          React.createElement("div", { className: "flex justify-between text-xs text-text-secondary px-1" },
                            React.createElement("span", null, "קטן"),
                            React.createElement("span", null, "גדול")
                          ),
                          React.createElement("input", {
                              type: "range",
                              min: "1",
                              max: "5",
                              step: "1",
                              value: gridSize,
                              onChange: (e) => onGridSizeChange(parseInt(e.target.value, 10)),
                              className: "w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          })
                      )
                    ),
                    
                    React.createElement("h4", { className: "text-xs font-semibold text-text-secondary pt-2 px-3" }, "טקסט נע"),
                    React.createElement(ToggleSwitch, { 
                        label: "שם תחנה / תוכנית",
                        enabled: isMarqueeProgramEnabled,
                        onChange: onMarqueeProgramEnabledChange
                    }),
                     React.createElement(ToggleSwitch, { 
                        label: "שם שיר נוכחי",
                        enabled: isMarqueeCurrentTrackEnabled,
                        onChange: onMarqueeCurrentTrackEnabledChange
                    }),
                     React.createElement(ToggleSwitch, { 
                        label: "שיר הבא",
                        enabled: isMarqueeNextTrackEnabled,
                        onChange: onMarqueeNextTrackEnabledChange
                    }),
                    React.createElement("div", { className: "p-3 rounded-lg bg-bg-primary space-y-3" },
                        React.createElement("div", { className: "flex flex-col gap-1" },
                          React.createElement("div", { className: "flex justify-between text-sm font-medium text-text-primary" },
                              React.createElement("span", null, "מהירות גלילה")
                          ),
                           React.createElement("div", { className: "flex justify-between text-xs text-text-secondary px-1" },
                            React.createElement("span", null, "איטי"),
                            React.createElement("span", null, "מהיר")
                          ),
                          React.createElement("input", {
                              type: "range",
                              min: "1",
                              max: "10",
                              step: "1",
                              value: marqueeSpeed,
                              onChange: (e) => onMarqueeSpeedChange(parseInt(e.target.value, 10)),
                              className: "w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          })
                        ),
                        React.createElement("div", { className: "flex flex-col gap-1" },
                          React.createElement("div", { className: "flex justify-between text-sm font-medium text-text-primary" },
                              React.createElement("span", null, "השהיה בין גלילות"),
                              React.createElement("span", null, `${marqueeDelay} ש'`)
                          ),
                          React.createElement("input", {
                              type: "range",
                              min: "1",
                              max: "10",
                              step: "1",
                              value: marqueeDelay,
                              onChange: (e) => onMarqueeDelayChange(parseInt(e.target.value, 10)),
                              className: "w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          })
                        )
                    ),

                    React.createElement("h4", { className: "text-xs font-semibold text-text-secondary pt-2 px-3" }, "כללי"),
                    React.createElement(ToggleSwitch, { 
                        label: "תצוגה גרפית (מסך מלא)", 
                        enabled: isNowPlayingVisualizerEnabled, 
                        onChange: onNowPlayingVisualizerEnabledChange 
                    }),
                    React.createElement(ToggleSwitch, { 
                        label: "תצוגה גרפית (נגן תחתון)", 
                        enabled: isPlayerBarVisualizerEnabled, 
                        onChange: onPlayerBarVisualizerEnabledChange 
                    }),
                    React.createElement(ToggleSwitch, { 
                        label: "הצג חיווי מצב",
                        enabled: isStatusIndicatorEnabled,
                        onChange: onStatusIndicatorEnabledChange
                    }),
                    React.createElement(ToggleSwitch, { 
                        label: "הצג בקרת עוצמה",
                        enabled: isVolumeControlVisible,
                        onChange: onVolumeControlVisibleChange
                    }),
                    React.createElement(ToggleSwitch, { 
                        label: "הצג שיר הבא",
                        enabled: showNextSong,
                        onChange: onShowNextSongChange
                    })
                )
            ),

            React.createElement(SettingsSection, { title: "קיצורי מקלדת", isOpen: openSections.shortcuts, onToggle: () => toggleSection('shortcuts') },
                React.createElement("div", { className: "space-y-2" },
                    /* General Shortcuts */
                    React.createElement("h4", { className: "text-xs font-semibold text-text-secondary pt-1 px-1" }, "כללי"),
                    ['playPause', 'volumeUp', 'volumeDown', 'toggleMute', 'nextStation', 'prevStation', 'toggleFullscreen'].map(action => (
                        React.createElement("div", { key: action, className: "flex justify-between items-center p-2 bg-bg-primary rounded-lg" },
                            React.createElement("span", { className: "text-sm" }, KEY_ACTION_LABELS[action]),
                            React.createElement("div", { className: "flex items-center gap-2" },
                                listeningFor === action && (
                                    React.createElement("button", { 
                                        onClick: handleCancelRebind, 
                                        className: "text-red-400 hover:text-red-300 font-bold px-2",
                                        title: "ביטול"
                                    }, "✕")
                                ),
                                React.createElement("button", { 
                                    onClick: () => handleStartRebind(action),
                                    className: `px-3 py-1 text-xs rounded border transition-all ${
                                        listeningFor === action 
                                        ? 'bg-accent text-white border-accent animate-pulse' 
                                        : 'bg-bg-secondary border-gray-600 text-text-secondary hover:border-text-primary'
                                    }`
                                },
                                    listeningFor === action ? 'לחץ על מקש...' : keyMap[action][0].toUpperCase().replace(' ', 'Space')
                                )
                            )
                        )
                    )),

                    /* EQ Shortcuts */
                    React.createElement("h4", { className: "text-xs font-semibold text-text-secondary pt-3 px-1" }, "אקולייזר"),
                    ['eqFlat', 'eqBassBoost', 'eqVocalBoost', 'eqRock', 'eqMovie', 'eqCustom'].map(action => (
                        React.createElement("div", { key: action, className: "flex justify-between items-center p-2 bg-bg-primary rounded-lg" },
                            React.createElement("span", { className: "text-sm" }, KEY_ACTION_LABELS[action]),
                            React.createElement("div", { className: "flex items-center gap-2" },
                                listeningFor === action && (
                                    React.createElement("button", { 
                                        onClick: handleCancelRebind, 
                                        className: "text-red-400 hover:text-red-300 font-bold px-2",
                                        title: "ביטול"
                                    }, "✕")
                                ),
                                React.createElement("button", { 
                                    onClick: () => handleStartRebind(action),
                                    className: `px-3 py-1 text-xs rounded border transition-all ${
                                        listeningFor === action 
                                        ? 'bg-accent text-white border-accent animate-pulse' 
                                        : 'bg-bg-secondary border-gray-600 text-text-secondary hover:border-text-primary'
                                    }`
                                },
                                    listeningFor === action ? 'לחץ על מקש...' : keyMap[action][0].toUpperCase().replace(' ', 'Space')
                                )
                            )
                        )
                    )),

                    React.createElement("button", { 
                        onClick: () => onKeyMapChange(DEFAULT_KEY_MAP),
                        className: "w-full mt-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded border border-red-400/30 transition-colors"
                    }, "שחזר ברירת מחדל")
                )
            ),

            React.createElement("div", { className: "mt-auto flex-shrink-0 pt-4" },
                user && (
                    React.createElement("div", { className: "mb-4 p-2 bg-gray-900/50 rounded text-[10px] font-mono text-gray-400 text-center break-all select-all" },
                        `User: ${user.email || user.uid}`,
                        React.createElement("br"),
                        `Role: ${isAdmin ? 'Admin' : 'User'}`
                    )
                ),
                isVersionHistoryVisible && (
                    React.createElement("div", { className: "mb-4 text-xs text-text-secondary" },
                        React.createElement("h4", { className: "font-bold text-sm text-text-primary mb-2" }, "היסטוריית גרסאות"),
                        React.createElement("div", { className: "space-y-3 max-h-48 overflow-y-auto pr-2" },
                            releaseNotes.map(release => (
                                React.createElement("div", { key: release.version },
                                    React.createElement("p", { className: "font-semibold text-text-primary" }, `גרסה ${release.version} (${release.date})`),
                                    React.createElement("ul", { className: "list-disc list-inside space-y-1 mt-1" },
                                        release.features.map((feature, index) => (
                                            React.createElement("li", { key: index }, feature)
                                        ))
                                    )
                                )
                            ))
                        )
                    )
                ),
                 React.createElement("div", { className: "text-center text-xs text-text-secondary space-y-2" },
                    React.createElement("div", {
                        className: `p-2 rounded-lg ${updateStatus === 'idle' ? 'cursor-pointer hover:bg-bg-primary' : 'cursor-default'}`,
                        onClick: updateStatus === 'idle' ? onManualUpdateCheck : undefined,
                        role: "button",
                        tabIndex: updateStatus === 'idle' ? 0 : -1,
                        "aria-live": "polite"
                    },
                        React.createElement("p", null, `רדיו פרימיום v${currentVersionInfo.version} (${currentVersionInfo.date})`),
                        React.createElement("div", { className: "h-4 mt-1 flex items-center justify-center" },
                            getUpdateStatusContent()
                        )
                    ),
                    React.createElement("button", {
                        className: "text-text-secondary hover:text-text-primary opacity-80",
                        onClick: () => setIsVersionHistoryVisible(prev => !prev)
                    },
                        isVersionHistoryVisible ? 'הסתר היסטוריית גרסאות' : 'הצג היסטוריית גרסאות'
                    )
                )
            )
        )
      )
    )
  );
};

export default SettingsPanel;