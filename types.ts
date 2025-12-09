
import type { User as FirebaseUser } from 'firebase/auth';

export type User = FirebaseUser;

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

export const VISUALIZER_STYLES = ['bars', 'wave', 'pulse', 'spectrum', 'aurora', 'rings', 'static', 'vortex', 'speaker', 'galaxy', 'equalizer'] as const;
export type VisualizerStyle = typeof VISUALIZER_STYLES[number];

export const VISUALIZER_STYLE_LABELS: Record<VisualizerStyle, string> = {
    bars: 'עמודות',
    wave: 'גל קול',
    pulse: 'פעימה',
    spectrum: 'ספקטרום',
    aurora: 'זוהר צפוני',
    rings: 'טבעות',
    static: 'חשמל סטטי',
    vortex: 'מערבולת',
    speaker: 'רמקול',
    galaxy: 'גלקסיה',
    equalizer: 'אקולייזר',
};

export const GRID_SIZES = [1, 2, 3, 4, 5] as const;
export type GridSize = typeof GRID_SIZES[number]; // 1=Smallest, 5=Largest

export type SortOrder = 'priority' | 'name_asc' | 'name_desc' | 'custom' | 'category_style' | 'category_identity' | 'category_region' | 'category_nameStructure';

export enum StationFilter {
  All = 'הכל',
  Favorites = 'מועדפים',
}

// --- Keyboard Shortcuts Types ---
export type KeyAction = 
    | 'playPause' 
    | 'volumeUp' 
    | 'volumeDown' 
    | 'toggleMute'
    | 'nextStation' 
    | 'prevStation' 
    | 'toggleFullscreen'
    | 'eqFlat'
    | 'eqBassBoost'
    | 'eqVocalBoost'
    | 'eqRock'
    | 'eqMovie'
    | 'eqCustom';

export type KeyMap = Record<KeyAction, string[]>;

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
    playPause: 'נגן / השהה',
    volumeUp: 'הגבר עוצמה',
    volumeDown: 'הנמך עוצמה',
    toggleMute: 'השתק / בטל השתקה',
    nextStation: 'תחנה הבאה',
    prevStation: 'תחנה קודמת',
    toggleFullscreen: 'מסך מלא',
    eqFlat: 'EQ: רגיל (0)',
    eqBassBoost: 'EQ: בס (1)',
    eqVocalBoost: 'EQ: קולות (2)',
    eqRock: 'EQ: רוק (3)',
    eqMovie: 'EQ: סרט (4)',
    eqCustom: 'EQ: מותאם (5)',
};

export type AllSettings = {
    favorites: string[];
    customOrder: string[];
    theme: Theme;
    eqPreset: EqPreset;
    customEqSettings: CustomEqSettings;
    volume: number;
    isNowPlayingVisualizerEnabled: boolean;
    isPlayerBarVisualizerEnabled: boolean;
    visualizerStyle: VisualizerStyle;
    isStatusIndicatorEnabled: boolean;
    isVolumeControlVisible: boolean;
    showNextSong: boolean;
    gridSize: GridSize;
    isMarqueeProgramEnabled: boolean;
    isMarqueeCurrentTrackEnabled: boolean;
    isMarqueeNextTrackEnabled: boolean;
    marqueeSpeed: number;
    marqueeDelay: number;
    filter: StationFilter;
    sortOrderAll: SortOrder;
    sortOrderFavorites: SortOrder;
    keyMap: KeyMap;
};
