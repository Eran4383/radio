import { Station } from '../types';

export type CategoryType = 'style' | 'identity' | 'region' | 'nameStructure';

// Helper function to check for keywords in station name or tags
const checkKeywords = (station: Station, keywords: string[]): boolean => {
    const name = station.name.toLowerCase();
    const tags = station.tags.toLowerCase();
    return keywords.some(kw => name.includes(kw.toLowerCase()) || tags.includes(kw.toLowerCase()));
};

// --- STYLE CATEGORIZATION ---
const getStyleCategory = (station: Station): string => {
    if (checkKeywords(station, ['Mizrahit FM Best', 'mizrahit radio', 'Mizrahit_Fm', 'Rak Musica', 'קול פליי'])) return "מוזיקה מזרחית";
    if (checkKeywords(station, ['Jewish Music Stream', 'Nachman', 'Radio Breslev Carmiel', 'Abdulbasit Abdulsamad'])) return "מוזיקה דתית / יהודית";
    if (checkKeywords(station, ['100% Rock', '#joint radio Blues Rock', 'GUITAR - J. WILLIAMS'])) return "מוזיקת רוק / בלוז";
    if (checkKeywords(station, ['#Joint Radio Reggae'])) return "מוזיקת רגאיי";
    if (checkKeywords(station, ['100% Jazz', '100% Latin', '100% World Music', 'Special Eurovision'])) return "לועזי / ז'אנר ספציפי";
    if (checkKeywords(station, ["100% Chillout", "100% Café", "100% Drivetime", "100% 70's", "100% Oldies"])) return "אווירה / נושא";
    if (checkKeywords(station, ['גלגלצ', '103fm', '101.5fm', '104.5FM', '91FM'])) return "כללי / מעורב (ישראלי)";
    return 'כללי / מעורב (ישראלי)';
};

// --- IDENTITY CATEGORIZATION ---
const getIdentityCategory = (station: Station): string => {
    if (checkKeywords(station, ['כאן 88', 'גלגלצ'])) return "ציבורי (מדינת ישראל)";
    if (checkKeywords(station, ['101.5fm רדיו דרום', '104.5FM צפון', '91FM', '103fm', 'Radio 90FM'])) return "רדיו אזורי / מסחרי";
    if (checkKeywords(station, ['Nachman', 'Radio Breslev Carmiel'])) return "רדיו דתי / קהילתי";
    if (checkKeywords(station, ['Doomnation Radio', 'Radio Qualita', 'Star 33 Radiostation'])) return "רדיו אינטרנטי / נישתי";
    return 'רדיו אינטרנטי / נישתי';
};

// --- REGION CATEGORIZATION ---
const getRegionCategory = (station: Station): string => {
    if (checkKeywords(station, ['104.5FM צפון', 'Radio Breslev Carmiel'])) return "צפון הארץ";
    if (checkKeywords(station, ['101.5fm רדיו דרום'])) return "דרום הארץ";
    if (checkKeywords(station, ['Лучшее Радио', 'Abdulbasit Abdulsamad'])) return "שפה זרה / ממוקדת";
    if (checkKeywords(station, ['גלגלצ', 'כאן 88', 'רדיו דרום', 'קול פליי', 'Rak Musica'])) return "עברית / ישראלית";
    return 'עברית / ישראלית';
};

// --- NAME STRUCTURE CATEGORIZATION ---
const getNameStructureCategory = (station: Station): string => {
    const name = station.name.toLowerCase();
    if (/\d{2,3}(\.\d)?fm/.test(name)) return 'מכיל תדר FM';
    if (name.includes('100%')) return 'מכיל אחוז (100%)';
    if (checkKeywords(station, ['#Joint Radio Reggae', 'Doomnation Radio', 'mizrahit radio', 'Radio Qualita'])) return 'מכיל את המילה "רדיו"';
    if (checkKeywords(station, ['כאן 88', 'גלגלצ'])) return 'שמות מוסדיים';
    return 'אחר';
};

export const getCategory = (station: Station, type: CategoryType): string => {
    switch (type) {
        case 'style': return getStyleCategory(station);
        case 'identity': return getIdentityCategory(station);
        case 'region': return getRegionCategory(station);
        case 'nameStructure': return getNameStructureCategory(station);
        default: return 'אחר';
    }
};
