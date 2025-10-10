import React from 'react';
import { EQ_PRESET_KEYS, EQ_PRESET_LABELS } from '../types.js';

const SettingsButton = ({ label, isActive, onClick }) => (
    React.createElement("button", {
        onClick: onClick,
        className: `px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${
            isActive ? 'bg-accent text-white' : 'bg-bg-primary hover:bg-accent/20'
        }`
    },
        label
    )
);

const ToggleSwitch = ({ label, enabled, onChange, disabled = false }) => (
    React.createElement("div", { className: `flex items-center justify-between p-3 rounded-lg bg-bg-primary ${disabled ? 'opacity-50 cursor-not-allowed' : ''}` },
        React.createElement("span", { className: "font-medium text-text-primary" }, label),
        React.createElement("button", {
            onClick: () => !disabled && onChange(!enabled),
            disabled: disabled,
            className: `relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent ${
                enabled ? 'bg-accent' : 'bg-gray-600'
            }`
        },
            React.createElement("span", {
                className: `inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                }`
            })
        )
    )
);


const SettingsPanel = ({ 
    isOpen, onClose, currentTheme, onThemeChange, currentEqPreset, onEqPresetChange,
    isVisualizerEnabled, onVisualizerEnabledChange, isVisualizerLocked, onVisualizerLockedChange,
    isStatusIndicatorEnabled, onStatusIndicatorEnabledChange
 }) => {
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
            React.createElement("h2", { className: "text-xl font-bold mb-6 text-text-primary flex-shrink-0" }, "הגדרות"),

            /* Account Section */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("div", { className: "flex items-center gap-3 p-3 rounded-lg bg-bg-primary opacity-60 cursor-not-allowed" },
                    React.createElement("div", { className: "w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center" },
                        React.createElement("svg", { className: "w-6 h-6 text-gray-300", viewBox: "0 0 24 24", fill: "currentColor" }, React.createElement("path", { d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" }))
                    ),
                    React.createElement("div", null,
                        React.createElement("p", { className: "font-semibold text-text-primary" }, "התחבר עם גוגל"),
                        React.createElement("p", { className: "text-xs text-text-secondary" }, "(בקרוב)")
                    )
                )
            ),

            /* Theme Switcher */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "ערכת נושא"),
                React.createElement("div", { className: "grid grid-cols-3 gap-2" },
                    React.createElement(SettingsButton, { label: "כהה", isActive: currentTheme === 'dark', onClick: () => onThemeChange('dark') }),
                    React.createElement(SettingsButton, { label: "בהיר", isActive: currentTheme === 'light', onClick: () => onThemeChange('light') }),
                    React.createElement(SettingsButton, { label: "כחול", isActive: currentTheme === 'blue', onClick: () => onThemeChange('blue') })
                )
            ),

             /* Equalizer */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "אקולייזר (EQ)"),
                React.createElement("div", { className: "grid grid-cols-2 gap-2" },
                    EQ_PRESET_KEYS.map(preset => (
                        React.createElement(SettingsButton, { 
                            key: preset,
                            label: EQ_PRESET_LABELS[preset],
                            isActive: currentEqPreset === preset, 
                            onClick: () => onEqPresetChange(preset) 
                        })
                    ))
                )
            ),

            /* Display Settings */
            React.createElement("div", { className: "mb-6 flex-shrink-0" },
                React.createElement("h3", { className: "text-sm font-semibold text-text-secondary mb-2" }, "ממשק"),
                React.createElement("div", { className: "space-y-2" },
                    React.createElement(ToggleSwitch, { 
                        label: "הצג תצוגה גרפית", 
                        enabled: isVisualizerEnabled, 
                        onChange: onVisualizerEnabledChange 
                    }),
                    React.createElement(ToggleSwitch, { 
                        label: "נעל סגנון תצוגה", 
                        enabled: isVisualizerLocked, 
                        onChange: onVisualizerLockedChange,
                        disabled: !isVisualizerEnabled
                    }),
                    React.createElement(ToggleSwitch, {
                        label: "הצג חיווי מצב",
                        enabled: isStatusIndicatorEnabled,
                        onChange: onStatusIndicatorEnabledChange
                    })
                )
            ),

            React.createElement("div", { className: "mt-auto text-center text-xs text-text-secondary flex-shrink-0" },
                React.createElement("p", null, "רדיו פרימיום v1.3")
            )
        )
      )
    )
  );
};

export default SettingsPanel;
