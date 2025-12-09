
// docs/services/stationSpecificService.js

import { CORS_PROXY_URL } from '../constants.js';
import { fetch100fmPlaylist } from './radioService.js';

// This maps the station names we use to the specific IDs Kan's API uses.
const KAN_STATION_IDS = {
    'כאן ב': '954',
    'כאן גימל': '955',
    'כאן 88': '956',
    'כאן תרבות': '957',
    'כאן קול המוזיקה': '958',
    'כאן מורשת': '959',
};

// Maps station names to the URL slug for both XML and JSON data feeds.
const GLZ_SLUGS = {
    'גלגלצ': 'glglz',
    'גלי צה"ל': 'glz',
};


/**
 * Checks if a station has a dedicated, high-accuracy API handler.
 * @param stationName The name of the station.
 * @param stationUuid The UUID of the station (optional).
 * @returns True if a specific handler exists, false otherwise.
 */
export const hasSpecificHandler = (stationName, stationUuid) => {
    const lowerCaseName = stationName.toLowerCase();
    
    if (stationUuid && stationUuid.startsWith('100fm-')) {
        return true;
    }

    if (Object.keys(GLZ_SLUGS).some(glzName => stationName.includes(glzName))) {
        return true;
    }
    if (Object.keys(KAN_STATION_IDS).some(kanName => stationName.includes(kanName))) {
        return true;
    }
    if (lowerCaseName.includes('eco99fm')) {
        return true;
    }
    
    return false;
};

/**
 * Fetches "now playing" info specifically for Kan stations from their direct API.
 * @param stationName The name of the station.
 * @returns A structured object with track/program info or null.
 */
const fetchKanTrackInfo = async (stationName) => {
    let kanStationId;

    for (const kanName in KAN_STATION_IDS) {
        if (stationName.includes(kanName)) {
            kanStationId = KAN_STATION_IDS[kanName];
            break;
        }
    }

    if (!kanStationId) {
        return null; // Not a known Kan station
    }

    try {
        // FIX: Added &t=${Date.now()} to bust proxy cache
        const url = `https://www.kan.org.il/radio/live-info-v2.aspx?stationId=${kanStationId}&t=${Date.now()}`;
        const proxiedUrl = `${CORS_PROXY_URL}${url}`;
        
        const response = await fetch(proxiedUrl, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-cache'
        });

        if (!response.ok) {
            console.warn(`Kan API failed for ${stationName} with status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        
        if (data && data.title) {
            return {
                program: data.title,
                current: data.description && data.description !== data.title ? data.description : null,
                next: null,
            };
        }
        
        return null;

    } catch (error) {
        console.error(`Error fetching from Kan API for ${stationName}:`, error);
        return null;
    }
};

const GLZ_SCHEDULE_ROOT_ID = '1051';

const fetchGaleiTzahalScheduleInfo = async () => {
    // FIX: Added &t=${Date.now()} to bust proxy cache
    const url = `${CORS_PROXY_URL}https://glz.co.il/umbraco/api/header/GetCommonData?rootId=${GLZ_SCHEDULE_ROOT_ID}&t=${Date.now()}`;
    try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) return { program: null, presenters: null };
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { program: null, presenters: null };
        }

        // The API returns schedule for multiple days. Find today.
        const todaySchedule = data?.timeTable?.glzTimeTable?.find((day) => day.isToday);
        
        if (!todaySchedule || !todaySchedule.programmes) {
            return { program: null, presenters: null };
        }
        
        const now = new Date();
        const currentProgramme = todaySchedule.programmes.find((p) => {
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
const fetchGaleiTzahalCombinedInfo = async (stationName) => {
    let slug;

    for (const key in GLZ_SLUGS) {
        if (stationName.includes(key)) {
            slug = GLZ_SLUGS[key];
            break;
        }
    }

    if (!slug) {
        return null;
    }

    // FIX: Added ?t=${Date.now()} to bust proxy cache
    const xmlUrl = `${CORS_PROXY_URL}https://glzxml.blob.core.windows.net/dalet/${slug}-onair/onair.xml?t=${Date.now()}`;
    
    const fetchSongsFromXml = async () => {
        try {
            const response = await fetch(xmlUrl, { cache: 'no-cache' });
            if (!response.ok) return { current: null, next: null };
            const xmlText = await response.text();
            
            if (xmlText.trim().startsWith('<!DOCTYPE html') || xmlText.trim().startsWith('<html')) {
                return { current: null, next: null };
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const extractSongInfo = (selectorPrefix) => {
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

    const fetchProgramFromJson = async () => {
        // FIX: Added &t=${Date.now()} to bust proxy cache
        const jsonUrl = `${CORS_PROXY_URL}https://glz.co.il/umbraco/api/player/UpdatePlayer?stationid=${slug}&t=${Date.now()}`;
        try {
            const response = await fetch(jsonUrl, { cache: 'no-cache' });
            if (!response.ok) return null;
            
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                return data?.program?.trim() || null;
            } catch (e) {
                return null;
            }
        } catch (error) {
            console.warn(`Error fetching GLZ JSON for ${slug}:`, error);
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

    let programString = null;
    if (slug === 'glz' && typeof programData === 'object' && programData !== null) {
        const { program, presenters } = programData;
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
const fetchEco99fmTrackInfo = async () => {
    // FIX: Added ?t=${Date.now()} to bust proxy cache
    const url = `https://firestore.googleapis.com/v1/projects/eco-99-production/databases/(default)/documents/streamed_content/program?t=${Date.now()}`;
    const proxiedUrl = `${CORS_PROXY_URL}${url}`;

    try {
        const response = await fetch(proxiedUrl, { cache: 'no-cache' });
        if (!response.ok) {
            console.warn(`eco99fm API failed with status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const fields = data?.fields;
        if (!fields) return null;

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
export const fetchStationSpecificTrackInfo = async (stationName, stationUuid) => {
    const lowerCaseName = stationName.toLowerCase();
    
    // Check for 100FM stations (new handler)
    if (stationUuid && stationUuid.startsWith('100fm-')) {
        const playlist = await fetch100fmPlaylist(stationUuid);
        if (playlist && playlist.length > 0) {
            const lastTrack = playlist[playlist.length - 1];
            return {
                program: '100FM', // Generic program name, as 100FM streams are usually non-stop music
                current: `${lastTrack.name} - ${lastTrack.artist}`,
                next: null
            };
        }
    }

    // Check for Galei Tzahal stations (גלגלצ, גלי צה"ל)
    if (Object.keys(GLZ_SLUGS).some(glzName => stationName.includes(glzName))) {
        return fetchGaleiTzahalCombinedInfo(stationName);
    }
    
    // Check for Kan stations
    if (Object.keys(KAN_STATION_IDS).some(kanName => stationName.includes(kanName))) {
        return fetchKanTrackInfo(stationName);
    }
    
    // Check for eco99fm
    if (lowerCaseName.includes('eco99fm')) {
        return fetchEco99fmTrackInfo();
    }

    return null; // No specific handler for this station
};
