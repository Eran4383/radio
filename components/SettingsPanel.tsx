import React from 'react';
import { Theme, EqPreset, THEMES, EQ_PRESET_KEYS, EQ_PRESET_LABELS, CustomEqSettings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
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
}

const SettingsButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-xs font-medium rounded-md transition-colors w-full capitalize ${
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
        <span className="font-medium text-text-primary">{label}</span>
        <div className="relative inline-flex items-center cursor-pointer">
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


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, onClose, currentTheme, onThemeChange, currentEqPreset, onEqPresetChange,
    isNowPlayingVisualizerEnabled, onNowPlayingVisualizerEnabledChange,
    isPlayerBarVisualizerEnabled, onPlayerBarVisualizerEnabledChange,
    isStatusIndicatorEnabled, onStatusIndicatorEnabledChange, isVolumeControlVisible, onVolumeControlVisibleChange,
    showNextSong, onShowNextSongChange,
    customEqSettings, onCustomEqChange
 }) => {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      
      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-bg-secondary shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-text-primary">הגדרות</h2>
                <div className="text-center opacity-60 cursor-not-allowed">
                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center ring-2 ring-gray-600">
                        <span className="text-xl font-bold text-gray-300">G</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">התחברות</p>
                </div>
            </div>

            {/* Theme Switcher */}
            <div className="mb-6 flex-shrink-0">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">ערכת נושא</h3>
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
            </div>

             {/* Equalizer */}
            <div className="mb-6 flex-shrink-0">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">אקולייזר (EQ)</h3>
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
            </div>

            {/* Display Settings */}
            <div className="mb-6 flex-shrink-0">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">ממשק</h3>
                <div className="space-y-2">
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
            </div>

            <div className="mt-auto text-center text-xs text-text-secondary flex-shrink-0">
                <p>רדיו פרימיום v1.3</p>
            </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;