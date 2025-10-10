export const THEMES = ['dark', 'light', 'blue'];

export const EQ_PRESET_KEYS = ['flat', 'bassBoost', 'vocalBoost', 'rock'];

export const EQ_PRESETS = {
  flat: { bass: 0, mid: 0, treble: 0 },
  bassBoost: { bass: 6, mid: -2, treble: -2 },
  vocalBoost: { bass: -2, mid: 4, treble: 2 },
  rock: { bass: 4, mid: -3, treble: 4 },
};

export const EQ_PRESET_LABELS = {
  flat: 'רגיל',
  bassBoost: 'הגברת בס',
  vocalBoost: 'הגברת קולות',
  rock: 'רוק',
};

export const VISUALIZER_STYLES = ['bars', 'wave', 'pulse'];

export const VISUALIZER_STYLE_LABELS = {
    bars: 'עמודות',
    wave: 'גל קול',
    pulse: 'פעימה'
};