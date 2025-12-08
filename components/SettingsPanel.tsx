
import React, { useState, useEffect } from 'react';
import { Theme, EqPreset, THEMES, EQ_PRESET_KEYS, EQ_PRESET_LABELS, CustomEqSettings, GridSize, User, KeyMap, KeyAction, KEY_ACTION_LABELS } from '../types';
import Auth from './Auth';
import { ChevronDownIcon } from './Icons';
import { BUILD_INFO } from '../buildInfo';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'found' | 'not-found' | 'error';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isAdmin: boolean;
  onOpenAdminPanel: () => void;
  onLogin: () => void;
  onLogout: () => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  currentEqPreset: EqPreset;
  onEqPresetChange: (preset: EqPreset) => void;
  isNowPlayingVisualizerEnabled: boolean;
  onNowPlayingVisualizerEnabledChange: (enabled: boolean) => void;
  isPlayerBarVisualizerEnabled: boolean;
  onPlayerBarVisualizerEnabledChange: (enabled: boolean) => void;
  isStatusIndicatorEnabled: boolean;
  onStatusIndicatorEnabledChange: (enabled: boolean) => void;
  isVolumeControlVisible: boolean;
  onVolumeControlVisibleChange: (enabled: boolean) => void;
  showNextSong: boolean;
  onShowNextSongChange: (enabled: boolean) => void;
  customEqSettings: CustomEqSettings;
  onCustomEqChange: (settings: CustomEqSettings) => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  isMarqueeProgramEnabled: boolean;
  onMarqueeProgramEnabledChange: (enabled: boolean) => void;
  isMarqueeCurrentTrackEnabled: boolean;
  onMarqueeCurrentTrackEnabledChange: (enabled: boolean) => void;
  isMarqueeNextTrackEnabled: boolean;
  onMarqueeNextTrackEnabledChange: (enabled: boolean) => void;
  marqueeSpeed: number;
  onMarqueeSpeedChange: (speed: number) => void;
  marqueeDelay: number;
  onMarqueeDelayChange: (delay: number) => void;
  updateStatus: UpdateStatus;
  onManualUpdateCheck: () => void;
  keyMap: KeyMap;
  onKeyMapChange: (keyMap: KeyMap) => void;
  setIsRebinding: (isRebinding: boolean) => void;
}

const releaseNotes = [
  {
    version: '1.1',
    date: '08.12.2025',
    features: [
        "הוספת פאנל ניהול מתקדם.",
        "מנגנון עדכון גרסה אוטומטי.",
        "אפשרויות מיון חדשות בתפריט הניהול.",
    ],
  },
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

const DEFAULT_KEY_MAP: KeyMap = {
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


const SettingsButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-2 py-2 text-xs font-medium rounded-md transition-colors w-full min-h-[2.5rem] flex items-center justify-center text-center whitespace-normal leading-tight ${
            isActive ? 'bg-accent text-white' : 'bg-bg-primary hover:bg-accent/20'
        }`}
    >
        {label}
    </button>
);

const ToggleSwitch: React.FC<{
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}> = ({ label, enabled, onChange, disabled = false }) => (
     <label className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/10'} bg-bg-primary`}>
        <span className="font-medium text-text-primary text-sm whitespace-normal leading-tight max-w-[70%]">{label}</span>
        <div className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input 
                type="checkbox" 
                checked={enabled} 
                onChange={(e) => !disabled && onChange(e.target.checked)} 
                disabled={disabled}
                className="sr-only peer"
                aria-label={label}
            />
            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent-focus peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
        </div>
    </label>
);

const EqSlider: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-text-secondary">
            <span>{label}</span>
            <span>{value > 0 ? '+' : ''}{value} dB</span>
        </div>
        <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full accent-teal-500 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer"
        />
    </div>
);

const SettingsSection: React.FC<{
    title: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}> = ({ title, children, isOpen, onToggle }) => {
    return (
        <div className="mb-4 bg-bg-secondary/50 rounded-lg border border-gray-700/50">
            <button 
                onClick={onToggle}
                className={`w-full flex justify-between items-center p-3 bg-gray-800/50 hover:bg-gray-700/50 transition-colors ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
                <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-3 space-y-3 border-t border-gray-700/30">
                    {children}
                </div>
            )}
        </div>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
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
  const [listeningFor, setListeningFor] = useState<KeyAction | null>(null);
  
  // Controlled state for sections
  const [openSections, setOpenSections] = useState({
      theme: true,
      eq: true,
      interface: true,
      shortcuts: false
  });

  const toggleSection = (key: keyof typeof openSections) => {
      setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!listeningFor) return;

    const handleRebind = (e: KeyboardEvent) => {
        // Prevent default actions and bubbling up to global listeners
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Allow escape to cancel
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

    // Use capture phase to intercept before it bubbles to app level logic (if any)
    window.addEventListener('keydown', handleRebind, { capture: true });
    return () => window.removeEventListener('keydown', handleRebind, { capture: true });
  }, [listeningFor, keyMap, onKeyMapChange, setIsRebinding]);

  const handleStartRebind = (action: KeyAction) => {
      setListeningFor(action);
      setIsRebinding(true);
  };

  const handleCancelRebind = (e: React.MouseEvent) => {
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
          return <span className="opacity-70">לחץ לבדיקת עדכונים</span>;
      }
    };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => {
            if (listeningFor) {
                setListeningFor(null);
                setIsRebinding(false);
            }
            onClose();
        }}
      ></div>
      
      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-bg-secondary shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-text-primary">הגדרות</h2>
                <Auth user={user} onLogin={onLogin} onLogout={onLogout} />
            </div>

            {isAdmin && (
                <div className="mb-6 animate-fade-in-up">
                    <button 
                        onClick={() => { onClose(); onOpenAdminPanel(); }}
                        className="w-full bg-accent/20 hover:bg-accent/40 text-accent border border-accent/50 font-bold py-3 px-4 rounded-lg transition-all"
                    >
                        🛠️ פאנל ניהול
                    </button>
                </div>
            )}

            <SettingsSection title="ערכת נושא" isOpen={openSections.theme} onToggle={() => toggleSection('theme')}>
                <div className="grid grid-cols-4 gap-2">
                    {THEMES.map(theme => (
                         <SettingsButton 
                            key={theme}
                            label={theme}
                            isActive={currentTheme === theme} 
                            onClick={() => onThemeChange(theme)} 
                        />
                    ))}
                </div>
            </SettingsSection>

            <SettingsSection title="אקולייזר (EQ)" isOpen={openSections.eq} onToggle={() => toggleSection('eq')}>
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {EQ_PRESET_KEYS.map(preset => (
                        <SettingsButton 
                            key={preset}
                            label={EQ_PRESET_LABELS[preset]}
                            isActive={currentEqPreset === preset} 
                            onClick={() => onEqPresetChange(preset)} 
                        />
                    ))}
                </div>
                 {currentEqPreset === 'custom' && (
                    <div className="p-3 rounded-lg bg-bg-primary space-y-3">
                        <EqSlider 
                            label="בס (Bass)"
                            value={customEqSettings.bass}
                            onChange={(val) => onCustomEqChange({ ...customEqSettings, bass: val })}
                        />
                        <EqSlider 
                            label="אמצע (Mid)"
                            value={customEqSettings.mid}
                            onChange={(val) => onCustomEqChange({ ...customEqSettings, mid: val })}
                        />
                         <EqSlider 
                            label="גבוהים (Treble)"
                            value={customEqSettings.treble}
                            onChange={(val) => onCustomEqChange({ ...customEqSettings, treble: val })}
                        />
                    </div>
                )}
            </SettingsSection>

            <SettingsSection title="ממשק" isOpen={openSections.interface} onToggle={() => toggleSection('interface')}>
                <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-bg-primary space-y-3">
                       <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm font-medium text-text-primary">
                              <span>גודל תצוגה</span>
                          </div>
                          <div className="flex justify-between text-xs text-text-secondary px-1">
                            <span>קטן</span>
                            <span>גדול</span>
                          </div>
                          <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={gridSize}
                              onChange={(e) => onGridSizeChange(parseInt(e.target.value, 10) as GridSize)}
                              className="w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                    </div>
                    
                    <h4 className="text-xs font-semibold text-text-secondary pt-2 px-3">טקסט נע</h4>
                    <ToggleSwitch 
                        label="שם תחנה / תוכנית"
                        enabled={isMarqueeProgramEnabled}
                        onChange={onMarqueeProgramEnabledChange}
                    />
                     <ToggleSwitch 
                        label="שם שיר נוכחי"
                        enabled={isMarqueeCurrentTrackEnabled}
                        onChange={onMarqueeCurrentTrackEnabledChange}
                    />
                     <ToggleSwitch 
                        label="שיר הבא"
                        enabled={isMarqueeNextTrackEnabled}
                        onChange={onMarqueeNextTrackEnabledChange}
                    />
                    <div className="p-3 rounded-lg bg-bg-primary space-y-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm font-medium text-text-primary">
                              <span>מהירות גלילה</span>
                          </div>
                           <div className="flex justify-between text-xs text-text-secondary px-1">
                            <span>איטי</span>
                            <span>מהיר</span>
                          </div>
                          <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={marqueeSpeed}
                              onChange={(e) => onMarqueeSpeedChange(parseInt(e.target.value, 10))}
                              className="w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm font-medium text-text-primary">
                              <span>השהיה בין גלילות</span>
                              <span>{marqueeDelay} ש'</span>
                          </div>
                          <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={marqueeDelay}
                              onChange={(e) => onMarqueeDelayChange(parseInt(e.target.value, 10))}
                              className="w-full accent-teal-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                    </div>

                    <h4 className="text-xs font-semibold text-text-secondary pt-2 px-3">כללי</h4>
                    <ToggleSwitch 
                        label="תצוגה גרפית (מסך מלא)" 
                        enabled={isNowPlayingVisualizerEnabled} 
                        onChange={onNowPlayingVisualizerEnabledChange} 
                    />
                    <ToggleSwitch 
                        label="תצוגה גרפית (נגן תחתון)" 
                        enabled={isPlayerBarVisualizerEnabled} 
                        onChange={onPlayerBarVisualizerEnabledChange} 
                    />
                    <ToggleSwitch 
                        label="הצג חיווי מצב"
                        enabled={isStatusIndicatorEnabled}
                        onChange={onStatusIndicatorEnabledChange}
                    />
                    <ToggleSwitch 
                        label="הצג בקרת עוצמה"
                        enabled={isVolumeControlVisible}
                        onChange={onVolumeControlVisibleChange}
                    />
                    <ToggleSwitch 
                        label="הצג שיר הבא"
                        enabled={showNextSong}
                        onChange={onShowNextSongChange}
                    />
                </div>
            </SettingsSection>

            <SettingsSection title="קיצורי מקלדת" isOpen={openSections.shortcuts} onToggle={() => toggleSection('shortcuts')}>
                <div className="space-y-2">
                    {/* General Shortcuts */}
                    <h4 className="text-xs font-semibold text-text-secondary pt-1 px-1">כללי</h4>
                    {(['playPause', 'volumeUp', 'volumeDown', 'toggleMute', 'nextStation', 'prevStation', 'toggleFullscreen'] as KeyAction[]).map(action => (
                        <div key={action} className="flex justify-between items-center p-2 bg-bg-primary rounded-lg">
                            <span className="text-sm">{KEY_ACTION_LABELS[action]}</span>
                            <div className="flex items-center gap-2">
                                {listeningFor === action && (
                                    <button 
                                        onClick={handleCancelRebind} 
                                        className="text-red-400 hover:text-red-300 font-bold px-2"
                                        title="ביטול"
                                    >
                                        ✕
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleStartRebind(action)}
                                    className={`px-3 py-1 text-xs rounded border transition-all ${
                                        listeningFor === action 
                                        ? 'bg-accent text-white border-accent animate-pulse' 
                                        : 'bg-bg-secondary border-gray-600 text-text-secondary hover:border-text-primary'
                                    }`}
                                >
                                    {listeningFor === action ? 'לחץ על מקש...' : keyMap[action][0].toUpperCase().replace(' ', 'Space')}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* EQ Shortcuts */}
                    <h4 className="text-xs font-semibold text-text-secondary pt-3 px-1">אקולייזר</h4>
                    {(['eqFlat', 'eqBassBoost', 'eqVocalBoost', 'eqRock', 'eqMovie', 'eqCustom'] as KeyAction[]).map(action => (
                        <div key={action} className="flex justify-between items-center p-2 bg-bg-primary rounded-lg">
                            <span className="text-sm">{KEY_ACTION_LABELS[action]}</span>
                            <div className="flex items-center gap-2">
                                {listeningFor === action && (
                                    <button 
                                        onClick={handleCancelRebind} 
                                        className="text-red-400 hover:text-red-300 font-bold px-2"
                                        title="ביטול"
                                    >
                                        ✕
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleStartRebind(action)}
                                    className={`px-3 py-1 text-xs rounded border transition-all ${
                                        listeningFor === action 
                                        ? 'bg-accent text-white border-accent animate-pulse' 
                                        : 'bg-bg-secondary border-gray-600 text-text-secondary hover:border-text-primary'
                                    }`}
                                >
                                    {listeningFor === action ? 'לחץ על מקש...' : keyMap[action][0].toUpperCase().replace(' ', 'Space')}
                                </button>
                            </div>
                        </div>
                    ))}

                    <button 
                        onClick={() => onKeyMapChange(DEFAULT_KEY_MAP)}
                        className="w-full mt-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded border border-red-400/30 transition-colors"
                    >
                        שחזר ברירת מחדל
                    </button>
                </div>
            </SettingsSection>

            <div className="mt-auto flex-shrink-0 pt-4">
                {isVersionHistoryVisible && (
                    <div className="mb-4 text-xs text-text-secondary">
                        <h4 className="font-bold text-sm text-text-primary mb-2">היסטוריית גרסאות</h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {releaseNotes.map(release => (
                            <div key={release.version}>
                                <p className="font-semibold text-text-primary">גרסה {release.version} ({release.date})</p>
                                <ul className="list-disc list-inside space-y-1 mt-1">
                                {release.features.map((feature, index) => (
                                    <li key={index}>{feature}</li>
                                ))}
                                </ul>
                            </div>
                            ))}
                        </div>
                    </div>
                )}
                 <div className="text-center text-xs text-text-secondary space-y-2">
                    <div
                        className={`p-2 rounded-lg ${updateStatus === 'idle' ? 'cursor-pointer hover:bg-bg-primary' : 'cursor-default'}`}
                        onClick={updateStatus === 'idle' ? onManualUpdateCheck : undefined}
                        role="button"
                        tabIndex={updateStatus === 'idle' ? 0 : -1}
                        aria-live="polite"
                    >
                        <p>רדיו פרימיום v{BUILD_INFO.version} ({BUILD_INFO.buildDate})</p>
                        <div className="h-4 mt-1 flex items-center justify-center">
                            {getUpdateStatusContent()}
                        </div>
                    </div>
                    <button
                        className="text-text-secondary hover:text-text-primary opacity-80"
                        onClick={() => setIsVersionHistoryVisible(prev => !prev)}
                    >
                        {isVersionHistoryVisible ? 'הסתר היסטוריית גרסאות' : 'הצג היסטוריית גרסאות'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
