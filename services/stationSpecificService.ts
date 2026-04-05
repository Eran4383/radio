
// services/stationSpecificService.ts

import { CORS_PROXY_URL } from '../constants';
import { StationTrackInfo } from '../types';
import { fetchWithFallbackProxy } from './radioService';

// This maps the station names we use to the specific IDs Kan's API uses.
const KAN_STATION_IDS: { [key: string]: string } = {
    'כאן ב': '954',
    'כאן גימל': '955',
    'כאן 88': '956',
    'כאן תרבות': '957',
    'כאן קול המוזיקה': '958',
    'כאן מורשת': '959',
};

// Maps station names to the URL slug for both XML and JSON data feeds.
const GLZ_SLUGS: { [key: string]: string } = {
    'גלגלצ': 'glglz',
    'גלי צה"ל': 'glz',
};

/**
 * Checks if a station has a dedicated, high-accuracy API handler.
 * @param stationName The name of the station.
 * @returns True if a specific handler exists, false otherwise.
 */
export const hasSpecificHandler = (stationName: string): boolean => {
    const lowerCaseName = stationName.toLowerCase();
    if (Object.keys(GLZ_SLUGS).some(glzName => lowerCaseName.includes(glzName.toLowerCase()))) {
        return true;
    }
    if (Object.keys(KAN_STATION_IDS).some(kanName => lowerCaseName.includes(kanName.toLowerCase()))) {
        return true;
    }
    if (lowerCaseName.includes('eco99fm') || lowerCaseName.includes('99fm') || (lowerCaseName.includes('eco') && lowerCaseName.includes('99')) || lowerCaseName.includes('99 fm')) {
        return true;
    }
    
    return false;
};


/**
 * Fetches "now playing" info specifically for Kan stations from their direct API.
 * @param stationName The name of the station.
 * @returns A structured object with track/program info or null.
 */
const fetchKanTrackInfo = async (stationName: string): Promise<StationTrackInfo | null> => {
    let kanStationId: string | undefined;
    const lowerCaseName = stationName.toLowerCase();

    for (const kanName in KAN_STATION_IDS) {
        if (lowerCaseName.includes(kanName.toLowerCase())) {
            kanStationId = KAN_STATION_IDS[kanName];
            break;
        }
    }

    if (!kanStationId) {
        return null; // Not a known Kan station
    }

    try {
        const url = `https://www.kan.org.il/radio/live-info-v2.aspx?stationId=${kanStationId}`;
        // Disable cache-bust for Kan as it might cause issues with their ASPX backend
        const response = await fetchWithFallbackProxy(url, { disableCacheBust: true });

        if (!response.ok) {
            console.warn(`Kan API failed for ${stationName} with status: ${response.status}`);
            return null;
        }

        const text = await response.text();
        const trimmedText = text.trim();
        
        // Check if the response is actually HTML (starts with <html, <!DOCTYPE, or even just <)
        if (trimmedText.startsWith('<html') || 
            trimmedText.toLowerCase().startsWith('<!doctype') || 
            (trimmedText.startsWith('<') && trimmedText.includes('<body'))) {
            console.warn(`Kan API for ${stationName} returned HTML instead of JSON. Likely an error page.`);
            return null;
        }

        try {
            const data = JSON.parse(trimmedText);
            if (data && data.title) {
                return {
                    program: data.title,
                    current: data.description && data.description !== data.title ? data.description : null,
                    next: null,
                };
            }
        } catch (e) {
            console.warn(`Kan API for ${stationName} returned non-JSON content (even if header said so):`, text.substring(0, 100));
            return null;
        }
        
        return null;

    } catch (error) {
        console.error(`Error fetching from Kan API for ${stationName}:`, error);
        return null;
    }
};

const GLZ_SCHEDULE_ROOT_ID = '1051';

const fetchGaleiTzahalScheduleInfo = async (): Promise<{ program: string | null; presenters: string | null }> => {
    const url = `https://glz.co.il/umbraco/api/header/GetCommonData?rootId=${GLZ_SCHEDULE_ROOT_ID}`;
    try {
        const response = await fetchWithFallbackProxy(url);
        if (!response.ok) return { program: null, presenters: null };
        
        const text = await response.text();
        if (text.trim().toLowerCase().startsWith('<html') || text.trim().toLowerCase().startsWith('<!doctype')) {
            console.warn(`GLZ Schedule API returned HTML instead of JSON. Likely an error page.`);
            return { program: null, presenters: null };
        }

        const data = JSON.parse(text);
        // The API returns schedule for multiple days. Find today.
        const todaySchedule = data?.timeTable?.glzTimeTable?.find((day: any) => day.isToday);
        
        if (!todaySchedule || !todaySchedule.programmes) {
            return { program: null, presenters: null };
        }
        
        const now = new Date();
        const currentProgramme = todaySchedule.programmes.find((p: any) => {
            const start = new Date(p.start);
            const end = new Date(p.end);
            return now >= start && now < end;
        });

        if (currentProgramme) {
            return {
                program: currentProgramme.topText?.trim() || null,
                presenters: currentProgramme.bottomText?.trim() || null,
            };
        }
        
        return { program: null, presenters: null };

    } catch (error) {
        console.warn(`Error fetching or parsing GLZ Schedule for rootId ${GLZ_SCHEDULE_ROOT_ID}:`, error);
        return { program: null, presenters: null };
    }
};

/**
 * Fetches "now playing" info for Galei Tzahal stations from two sources:
 * 1. An XML feed for the current and next playing song.
 * 2. A JSON API for the current program name.
 * For גלי צה"ל, it uses a more detailed schedule API.
 * It then combines them into a structured object.
 * @param stationName The name of the station.
 * @returns A structured object with program and track info, or null if not found.
 */
const fetchGaleiTzahalCombinedInfo = async (stationName: string): Promise<StationTrackInfo | null> => {
    let slug: string | undefined;
    const lowerCaseName = stationName.toLowerCase();

    for (const key in GLZ_SLUGS) {
        if (lowerCaseName.includes(key.toLowerCase())) {
            slug = GLZ_SLUGS[key];
            break;
        }
    }

    if (!slug) {
        return null;
    }

    const xmlUrl = `https://glzxml.blob.core.windows.net/dalet/${slug}-onair/onair.xml`;
    
    const fetchSongsFromXml = async (): Promise<{ current: string | null; next: string | null }> => {
        try {
            const response = await fetchWithFallbackProxy(xmlUrl);
            if (!response.ok) return { current: null, next: null };
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const extractSongInfo = (selectorPrefix: 'Current' | 'Next'): string | null => {
                const titleElem = xmlDoc.querySelector(`BroadcastMonitor > ${selectorPrefix} > titleName`);
                const artistElem = xmlDoc.querySelector(`BroadcastMonitor > ${selectorPrefix} > artistName`);
                
                const title = titleElem?.textContent?.trim() || null;
                const artist = artistElem?.textContent?.trim() || null;
                
                if (!title) {
                    return null;
                }

                const lowerCaseTitle = title.toLowerCase();

                // Blocklist for commercials, jingles, and other non-song items
                const commercialKeywords = [
                    'פרסומת', 
                    'אוטודיפו', // from user feedback
                    'תדרים',     // from user feedback
                    'מבצע',
                    'חסות',
                    'תשדיר',
                ];

                if (commercialKeywords.some(keyword => lowerCaseTitle.includes(keyword))) {
                    return null;
                }

                // Filter out titles that look like system messages or are very short
                if (lowerCaseTitle.includes('start -') || title.length < 3) {
                    return null;
                }

                let result = title;

                if (artist) {
                    result = `${title} - ${artist}`;
                } else {
                    // If there's no artist, it might be a program name with junk.
                    // Clean junk suffixes like ' anou febr 25.2' or other date-like suffixes.
                    result = result.replace(/\s+[a-z]{2,}\s+[\d\s\.]+$/i, '').trim();
                }
                
                return result;
            };
    
            return {
                current: extractSongInfo('Current'),
                next: extractSongInfo('Next'),
            };

        } catch (error) {
            console.warn(`Error fetching or parsing GLZ XML for ${slug}:`, error);
            return { current: null, next: null };
        }
    };

    const fetchProgramFromJson = async (): Promise<string | null> => {
        const jsonUrl = `https://glz.co.il/umbraco/api/player/UpdatePlayer?stationid=${slug}`;
        try {
            const response = await fetchWithFallbackProxy(jsonUrl);
            if (!response.ok) return null;
            const text = await response.text();
            if (text.trim().toLowerCase().startsWith('<html') || text.trim().toLowerCase().startsWith('<!doctype')) {
                console.warn(`GLZ JSON API for ${slug} returned HTML instead of JSON.`);
                return null;
            }
            const data = JSON.parse(text);
            return data?.program?.trim() || null;
        } catch (error) {
            console.warn(`Error fetching or parsing GLZ JSON for ${slug}:`, error);
            return null;
        }
    };

    const programPromise = slug === 'glz' 
        ? fetchGaleiTzahalScheduleInfo()
        : fetchProgramFromJson();

    // Run fetches in parallel for speed
    const [songData, programData] = await Promise.all([
        fetchSongsFromXml(),
        programPromise
    ]);

    let programString: string | null = null;
    if (slug === 'glz' && typeof programData === 'object' && programData !== null) {
        const { program, presenters } = programData as { program: string | null, presenters: string | null };
        if (program && presenters && program.toLowerCase() !== presenters.toLowerCase()) {
            programString = `${program} | ${presenters}`;
        } else {
            programString = program || presenters;
        }
    } else if (typeof programData === 'string') {
        programString = programData;
    }

    let finalCurrentSong = songData.current;

    // De-duplication: If the "song" from XML is just the program name, or the program name
    // followed by more text (like hosts), it's not a real song. Nullify it to avoid redundancy.
    if (programString && finalCurrentSong) {
        const programNameOnly = programString.split('|')[0].trim();
        if (finalCurrentSong.trim().startsWith(programNameOnly)) {
            finalCurrentSong = null;
        }
    }
    
    // If all info fields are empty, don't return an empty object
    if (!programString && !finalCurrentSong && !songData.next) {
        return null; 
    }

    return {
        program: programString,
        current: finalCurrentSong,
        next: songData.next
    };
};

/**
 * Fetches "now playing" info for eco99fm from their Firestore API.
 * @returns A structured object with track/program info or null.
 */
const fetchEco99fmTrackInfo = async (): Promise<StationTrackInfo | null> => {
    // Firestore REST API might not like the ?t= parameter.
    // Also, firestore.googleapis.com supports CORS, so we can try direct fetch first.
    const url = `https://firestore.googleapis.com/v1/projects/eco-99-production/databases/(default)/documents/streamed_content/program`;
    
    try {
        console.log('Fetching eco99fm track info...');
        // Try direct fetch first (better for performance and avoids proxy issues)
        let response = await fetch(url, { cache: 'no-cache' }).catch(() => null);
        
        // If direct fetch fails (e.g. CORS after all, though unlikely for Firestore), fallback to proxy
        if (!response || !response.ok) {
            console.log('Direct fetch failed or blocked, trying via fallback proxy...');
            // Firestore REST API doesn't like arbitrary query parameters like ?t=
            response = await fetchWithFallbackProxy(url, { disableCacheBust: true });
        }

        if (!response.ok) {
            console.warn(`eco99fm API failed with status: ${response.status}`);
            return null;
        }

        const text = await response.text();
        if (text.trim().toLowerCase().startsWith('<html') || text.trim().toLowerCase().startsWith('<!doctype')) {
            console.warn(`eco99fm API returned HTML instead of JSON.`);
            return null;
        }

        const data = JSON.parse(text);
        console.log('eco99fm raw data:', JSON.stringify(data, null, 2));
        const fields = data?.fields;
        if (!fields) {
            console.warn('eco99fm data missing fields:', data);
            return null;
        }

        const programName = fields.program_name?.stringValue || null;
        const broadcasterName = fields.broadcaster_name?.stringValue || null;
        const songName = fields.song_name?.stringValue || null;
        const artistName = fields.artist_name?.stringValue || null;
        
        let program = programName;
        // Combine program and broadcaster if both exist and are different
        if (programName && broadcasterName && programName.toLowerCase() !== broadcasterName.toLowerCase()) {
            program = `${programName} | ${broadcasterName}`;
        } else if (broadcasterName && !programName) {
            program = broadcasterName;
        }

        let current = null;
        if (songName && artistName) {
            current = `${songName} - ${artistName}`;
        } else if (songName) {
            current = songName;
        }
        
        // Don't show program name as current song
        if (current && program && current.toLowerCase().includes(program.toLowerCase().split('|')[0].trim())) {
            current = null;
        }
        
        if (!program && !current) return null;
        
        return {
            program,
            current,
            next: null,
        };

    } catch (error) {
        console.error('Error fetching from eco99fm API:', error);
        return null;
    }
};


/**
 * Main router function to fetch track info from a station-specific source.
 * It will try to find a specific handler and route the request accordingly.
 * 
 * @param stationName The name of the station.
 * @returns A structured object with the current track/program name, or null if no specific handler is available.
 */
export const fetchStationSpecificTrackInfo = async (stationName: string): Promise<StationTrackInfo | null> => {
    const lowerCaseName = stationName.toLowerCase();
    
    // Check for Galei Tzahal stations (גלגלצ, גלי צה"ל)
    if (Object.keys(GLZ_SLUGS).some(glzName => lowerCaseName.includes(glzName.toLowerCase()))) {
        return fetchGaleiTzahalCombinedInfo(stationName);
    }
    
    // Check for Kan stations
    if (Object.keys(KAN_STATION_IDS).some(kanName => lowerCaseName.includes(kanName.toLowerCase()))) {
        return fetchKanTrackInfo(stationName);
    }

    // Check for eco99fm
    if (lowerCaseName.includes('eco99fm') || lowerCaseName.includes('99fm') || (lowerCaseName.includes('eco') && lowerCaseName.includes('99')) || lowerCaseName.includes('99 fm')) {
        return fetchEco99fmTrackInfo();
    }
    
    return null; // No specific handler for this station
};
