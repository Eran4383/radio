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

export interface StationTrackInfo {
    program: string | null;
    current: string | null;
    next: string | null;
}

export const THEMES = ['dark', 'light', 'blue', 'sunset', 'forest', 'ocean', 'rose', 'matrix'] as const;
export type Theme = typeof THEMES[number];

export const EQ_PRESET_KEYS = ['flat', 'bassBoost', 'vocalBoost', 'rock', 'movie', 'custom'] as const;
export type EqPreset = typeof EQ_PRESET_KEYS[number];

export interface CustomEqSettings {
  bass: number;
  mid: number;
  treble: number;
}

export const EQ_PRESETS: Record<Exclude<EqPreset, 'custom'>, { bass: number; mid: number; treble: number }> = {
  flat: { bass: 0, mid: 0, treble: 0 },
  bassBoost: { bass: 6, mid: -2, treble: -2 },
  vocalBoost: { bass: -2, mid: 4, treble: 2 },
  rock: { bass: 4, mid: -3, treble: 4 },
  movie: { bass: 3, mid: 2, treble: 1 },
};

export const EQ_PRESET_LABELS: Record<EqPreset, string> = {
  flat: 'רגיל',
  bassBoost: 'הגברת בס',
  vocalBoost: 'הגברת קולות',
  rock: 'רוק',
  movie: 'סרט',
  custom: 'מותאם אישית',
};

export const VISUALIZER_STYLES = ['bars', 'wave', 'pulse', 'spectrum', 'aurora', 'rings'] as const;
export type VisualizerStyle = typeof VISUALIZER_STYLES[number];

export const VISUALIZER_STYLE_LABELS: Record<VisualizerStyle, string> = {
    bars: 'עמודות',
    wave: 'גל קול',
    pulse: 'פעימה',
    spectrum: 'ספקטרום',
    aurora: 'זוהר צפוני',
    rings: 'טבעות',
};

export const GRID_SIZES = [1, 2, 3, 4, 5] as const;
export type GridSize = typeof GRID_SIZES[number]; // 1=Smallest, 5=Largest
