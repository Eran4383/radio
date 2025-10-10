import React from 'react';
import { Theme, EqPreset, THEMES, EQ_PRESET_KEYS, EQ_PRESET_LABELS, CustomEqSettings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  currentEqPreset: EqPreset;
  onEqPresetChange: (preset: EqPreset) => void;
  isVisualizerEnabled: boolean;
  onVisualizerEnabledChange: (enabled: boolean) => void;
  isVisualizerLocked: boolean;
  onVisualizerLockedChange: (locked: boolean) => void;
  isStatusIndicatorEnabled: boolean;
  onStatusIndicatorEnabledChange: (enabled: boolean) => void;
  isVolumeControlVisible: boolean;
  onVolumeControlVisibleChange: (enabled: boolean) => void;
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
    <div className={`flex items-center justify-between p-3 rounded-lg bg-bg-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <span className="font-medium text-text-primary">{label}</span>
        <button
            onClick={() => !disabled && onChange(!enabled)}
            disabled={disabled}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent ${
                enabled ? 'bg-accent' : 'bg-gray-600'
            }`}
        >
            <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
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
    isVisualizerEnabled, onVisualizerEnabledChange, isVisualizerLocked, onVisualizerLockedChange,
    isStatusIndicatorEnabled, onStatusIndicatorEnabledChange, isVolumeControlVisible, onVolumeControlVisibleChange,
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
            <h2 className="text-xl font-bold mb-6 text-text-primary flex-shrink-0">הגדרות</h2>

            {/* Account Section */}
            <div className="mb-6 flex-shrink-0">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-primary opacity-60 cursor-not-allowed">
                    <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                    </div>
                    <div>
                        <p className="font-semibold text-text-primary">התחבר עם גוגל</p>
                        <p className="text-xs text-text-secondary">(בקרוב)</p>
                    </div>
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
                        label="הצג תצוגה גרפית" 
                        enabled={isVisualizerEnabled} 
                        onChange={onVisualizerEnabledChange} 
                    />
                    <ToggleSwitch 
                        label="נעל סגנון תצוגה" 
                        enabled={isVisualizerLocked} 
                        onChange={onVisualizerLockedChange}
                        disabled={!isVisualizerEnabled}
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