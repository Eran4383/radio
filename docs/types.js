
export const THEMES = ['dark', 'light', 'blue', 'sunset', 'forest', 'ocean', 'rose', 'matrix'];

export const EQ_PRESET_KEYS = ['flat', 'bassBoost', 'vocalBoost', 'rock', 'movie', 'custom'];

export const EQ_PRESETS = {
  flat: { bass: 0, mid: 0, treble: 0 },
  bassBoost: { bass: 6, mid: -2, treble: -2 },
  vocalBoost: { bass: -2, mid: 4, treble: 2 },
  rock: { bass: 4, mid: -3, treble: 4 },
  movie: { bass: 3, mid: 2, treble: 1 },
};

export const EQ_PRESET_LABELS = {
  flat: 'רגיל',
  bassBoost: 'הגברת בס',
  vocalBoost: 'הגברת קולות',
  rock: 'רוק',
  movie: 'סרט',
  custom: 'מותאם אישית',
};

export const VISUALIZER_STYLES = ['bars', 'wave', 'pulse', 'spectrum', 'aurora', 'rings', 'static', 'vortex', 'speaker', 'galaxy', 'equalizer'];

export const VISUALIZER_STYLE_LABELS = {
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

export const GRID_SIZES = [1, 2, 3, 4, 5];

export const StationFilter = {
  All: 'הכל',
  Favorites: 'מועדפים',
};

export const KEY_ACTION_LABELS = {
    playPause: 'נגן / השהה',
    volumeUp: 'הגבר עוצמה',
    volumeDown: 'הנמך עוצמה',
    nextStation: 'תחנה הבאה',
    prevStation: 'תחנה קודמת',
    toggleFullscreen: 'מסך מלא'
};
