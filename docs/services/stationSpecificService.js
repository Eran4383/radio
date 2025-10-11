// docs/services/stationSpecificService.js

import { CORS_PROXY_URL } from '../constants.js';

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
        const url = `https://www.kan.org.il/radio/live-info-v2.aspx?stationId=${kanStationId}`;
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

/**
 * Fetches "now playing" info for Galei Tzahal stations from two sources:
 * 1. An XML feed for the current and next playing song.
 * 2. A JSON API for the current program name.
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

    const xmlUrl = `${CORS_PROXY_URL}https://glzxml.blob.core.windows.net/dalet/${slug}-onair/onair.xml`;
    const jsonUrl = `${CORS_PROXY_URL}https://glz.co.il/umbraco/api/player/UpdatePlayer?stationid=${slug}`;

    const fetchSongsFromXml = async () => {
        try {
            const response = await fetch(xmlUrl, { cache: 'no-cache' });
            if (!response.ok) return { current: null, next: null };
            const xmlText = await response.text();
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

                if (artist) {
                    return `${title} - ${artist}`;
                }

                // If it's the current song and has no artist, it might be program info with junk. Clean it.
                if (selectorPrefix === 'Current') {
                    return title.replace(/\s+[a-z]{4}\s+[\d.]+$/, '').trim();
                }
                
                return title;
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
        try {
            const response = await fetch(jsonUrl, { cache: 'no-cache' });
            if (!response.ok) return null;
            const data = await response.json();
            return data?.program?.trim() || null;
        } catch (error) {
            console.warn(`Error fetching or parsing GLZ JSON for ${slug}:`, error);
            return null;
        }
    };

    // Run fetches in parallel for speed
    const [songData, programInfo] = await Promise.all([
        fetchSongsFromXml(),
        fetchProgramFromJson()
    ]);

    let finalCurrentSong = songData.current;

    // De-duplication: If the "song" from XML is just the program name, or the program name
    // followed by more text (like hosts), it's not a real song. Nullify it to avoid redundancy.
    if (programInfo && finalCurrentSong) {
        const trimmedProgram = programInfo.trim();
        const trimmedSong = finalCurrentSong.trim();
        if (trimmedSong.startsWith(trimmedProgram)) {
            finalCurrentSong = null;
        }
    }
    
    // If all info fields are empty, don't return an empty object
    if (!programInfo && !finalCurrentSong && !songData.next) {
        return null; 
    }

    return {
        program: programInfo,
        current: finalCurrentSong,
        next: songData.next
    };
};


/**
 * Main router function to fetch track info from a station-specific source.
 * It will try to find a specific handler and route the request accordingly.
 * 
 * @param stationName The name of the station.
 * @returns A structured object with the current track/program name, or null if no specific handler is available.
 */
export const fetchStationSpecificTrackInfo = async (stationName) => {
    
    // Check for Galei Tzahal stations (גלגלצ, גלי צה"ל) - uses the new combined method
    if (Object.keys(GLZ_SLUGS).some(glzName => stationName.includes(glzName))) {
        return fetchGaleiTzahalCombinedInfo(stationName);
    }
    
    // Check for Kan stations
    if (Object.keys(KAN_STATION_IDS).some(kanName => stationName.includes(kanName))) {
        return fetchKanTrackInfo(stationName);
    }
    
    // Example for future expansion:
    // if (stationName.toLowerCase().includes('103fm')) {
    //     return fetch103fmTrackInfo();
    // }

    return null; // No specific handler for this station
};