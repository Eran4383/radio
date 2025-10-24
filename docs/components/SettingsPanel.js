import React, { useState } from 'react';
import { THEMES, EQ_PRESET_KEYS, EQ_PRESET_LABELS } from '../types.js';

const releaseNotes = [
  {
    version: '1.9.5',
    date: '28 באוגוסט 2024',
    features: [
        "תיקון שורשי למנגנון העדכונים של קובץ ההגדרות (manifest).",
        "האפליקציה תמיד תטען את הגרסה העדכנית ביותר של ההגדרות מהרשת.",
        "פתרון סופי לבעיות ההתקנה והצגת האייקון.",
        "העלאת גרסת המטמון ל-v16 לכפיית עדכון כללי.",
    ],
  },
  {
    version: '1.9.4',
    date: '27 באוגוסט 2024',
    features: [
        "תיקון מקיף לבעיית התקנת האפליקציה (PWA) והצגת האייקון.",
        "כפיית רענון של קובץ ה-manifest כדי להבטיח שהדפדפן תמיד טוען את הגרסה העדכנית ביותר.",
        "עדכון גרסת ה-cache ל-v15 לניקוי יסודי של קבצים ישנים מכל המכשירים.",
    ],
  },
  {
    version: '1.9.3',
    date: '26 באוגוסט 2024',
    features: [
        "תיקון סופי להצגת הלוגו המקורי של המשתמש.",
        "החלפת קבצי הלוגו הישנים בקבצים ריקים כדי למנוע טעינתם מזיכרון המטמון.",
        "כפיית עדכון גרסה אגרסיבי (v14) לכלל המשתמשים.",
    ],
  },
  {
    version: '1.9.2',
    date: '25 באוגוסט 2024',
    features: [
        "החזרת הלוגו המקורי של המשתמש (קבצי PNG).",
        "עדכון כלל האפליקציה לשימוש באייקונים החדשים.",
        "הוספת הגנה בקובץ ההוראות למניעת מחיקה עתידית של קבצי הלוגו.",
    ],
  },
  {
    version: '1.9.1',
    date: '24 באוגוסט 2024',
    features: [
        "עיצוב לוגו חדש ומקצועי לאפליקציה.",
        "הטמעת הלוגו החדש כאייקון במסך הבית (PWA).",
        "שיפור מנגנון עדכון האייקון כדי להבטיח שהשינוי יופיע אצל כל המשתמשים.",
    ],
  },
  {
    version: '1.9',
    date: '23 באוגוסט 2024',
    features: [
        "תיקון יסודי למנגנון העדכונים של האפליקציה (Service Worker).",
        "האפליקציה תזהה ותציע עדכונים חדשים באופן אמין יותר.",
        "תיקון תאריכים בהיסטוריית הגרסאות.",
    ],
  },
  {
    version: '1.8',
    date: '22 באוגוסט 2024',
    features: [
        "הסרת מסך טעינה ראשוני לטעינה מהירה יותר של האפליקציה.",
    ],
  },
  {
    version: '1.7',
    date: '20 באוגוסט 2024',
    features: [
        "תיקון אגרסיבי לעדכון אייקון האפליקציה על-ידי שינוי שמות קבצי האייקון.",
    ],
  },
  {
    version: '1.6',
    date: '18 באוגוסט 2024',
    features: [
        "כפיית עדכון אייקון האפליקציה במסך הבית לכלל המשתמשים.",
    ],
  },
  {
    version: '1.5',
    date: '15 באוגוסט 2024',
    features: [
        "החלפת אייקון האפליקציה ושיפור מנגנון העדכון.",
    ],
  },
  {
    version: '1.4',
    date: '25 ביולי 2024',
    features: [
      "הוספת היסטוריית גרסאות ומידע על פיצ'רים חדשים.",
      "שיפורי ביצועים ויציבות כלליים.",
    ],
  },
  {
    version: '1.3',
    date: 'יוני 2024',
    features: [
        'מיון תחנות לפי קטגוריות (סגנון, אופי, אזור).',
        'שינוי גודל תצוגת התחנות באמצעות מחוות צביטה (Pinch-to-Zoom).',
        'הוספת סגנונות תצוגה גרפית חדשים: "זוהר צפוני" ו"טבעות".',
        'בקרת מהירות והשהייה לטקסט נע.',
    ],
  },
];

const currentVersionInfo = releaseNotes[0];

const SettingsButton = ({ label, isActive, onClick }) => (
    React.createElement("button", {
        onClick: onClick,
        className: `px-4 py-2 text-xs font-medium rounded-md transition-colors w-full capitalize ${
            isActive ? 'bg-accent text-white' : 'bg-bg-primary hover:bg-accent/20'
        }`
    },
        label
    )
);

const ToggleSwitch = ({ label, enabled, onChange, disabled = false }) => (
     React.createElement("label", { className: `w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/10'} bg-bg-primary` },
        React.createElement("span", { className: "font-medium text-text-primary" }, label),
        React.createElement("div", { className: "relative inline-flex items-center cursor-pointer" },
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


const SettingsPanel = ({ 
    isOpen, onClose, currentTheme, onThemeChange, currentEqPreset, onEqPresetChange,
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
    updateStatus, onManualUpdateCheck
 }) => {
  const [isVersionHistoryVisible, setIsVersionHistoryVisible] = useState(false);
  
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
        onClick: onClose
      }),
      
      /* Panel */
      React.createElement("div", { className: `fixed top-0 right-0 h-full w-72 bg-bg-secondary shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}` },
        React.createElement("div", { className: "p-4 flex flex-col h-full overflow-y-auto" },
            React.createElement("div", { className: "flex justify-between items-center mb-6 flex-shrink-0" },
                React.createElement("h2", { className: "text-xl font-bold text-text-primary" }, "הגדרות"),
                React.createElement("div", { className: "text-center opacity-60 cursor-not-allowed" },
                    React.createElement("div", { className: "w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center ring-2 ring-gray-600" },
                        React.createElement("span", { className: "text-xl font-bold text-gray-300" }, "G")
                    ),
                    React.createElement("p", { className: "text-xs text-text-secondary mt-1" }, "התחברות")
                )
            ),

            /* Theme Switcher */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "ערכת נושא"),
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

             /* Equalizer */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "אקולייזר (EQ)"),
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

            /* Display Settings */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "ממשק"),
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
             React.createElement("div", { className: "mt-auto flex-shrink-0" },
                isVersionHistoryVisible && React.createElement("div", { className: "mb-4 text-xs text-text-secondary" },
                    React.createElement("h4", { className: "font-bold text-sm text-text-primary mb-2" }, "היסטוריית גרסאות"),
                    React.createElement("div", { className: "space-y-3 max-h-48 overflow-y-auto pr-2" },
                        releaseNotes.map(release => 
                            React.createElement("div", { key: release.version },
                                React.createElement("p", { className: "font-semibold text-text-primary" }, `גרסה ${release.version} (${release.date})`),
                                React.createElement("ul", { className: "list-disc list-inside space-y-1 mt-1" },
                                    release.features.map((feature, index) => 
                                        React.createElement("li", { key: index }, feature)
                                    )
                                )
                            )
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
                        React.createElement("p", null, `רדיו פרימיום v${currentVersionInfo.version}`),
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