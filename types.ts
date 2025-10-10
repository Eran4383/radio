export interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  countrycode: string;
  codec: string;
  bitrate: number;
}

export const THEMES = ['dark', 'light', 'blue'] as const;
export type Theme = typeof THEMES[number];

export const EQ_PRESET_KEYS = ['flat', 'bassBoost', 'vocalBoost', 'rock'] as const;
export type EqPreset = typeof EQ_PRESET_KEYS[number];

export const EQ_PRESETS: Record<EqPreset, { bass: number; mid: number; treble: number }> = {
  flat: { bass: 0, mid: 0, treble: 0 },
  bassBoost: { bass: 6, mid: -2, treble: -2 },
  vocalBoost: { bass: -2, mid: 4, treble: 2 },
  rock: { bass: 4, mid: -3, treble: 4 },
};

export const EQ_PRESET_LABELS: Record<EqPreset, string> = {
  flat: 'רגיל',
  bassBoost: 'הגברת בס',
  vocalBoost: 'הגברת קולות',
  rock: 'רוק',
};

export const VISUALIZER_STYLES = ['bars', 'wave', 'pulse', 'barsMirrored', 'waveSymmetric'] as const;
export type VisualizerStyle = typeof VISUALIZER_STYLES[number];

export const VISUALIZER_STYLE_LABELS: Record<VisualizerStyle, string> = {
    bars: 'עמודות',
    wave: 'גל קול',
    pulse: 'פעימה',
    barsMirrored: 'עמודות (מראה)',
    waveSymmetric: 'גל סימטרי'
};