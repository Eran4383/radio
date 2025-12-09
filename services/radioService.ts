
import { Station, SmartPlaylistItem } from '../types';
import { PRIORITY_STATIONS } from '../constants';
import { CORS_PROXY_URL } from '../constants';
import { fetchCustomStations } from './firebase';

// Function to shuffle an array for load distribution
const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// A larger, hardcoded list of reliable API servers.
const API_SERVERS = [
    'https://de1.api.radio-browser.info/json',
    'https://nl1.api.radio-browser.info/json',
    'https://fr1.api.radio-browser.info/json',
    'https://at1.api.radio-browser.info/json',
    'https://radio.cloud-api.online/json',
    'https://de2.api.radio-browser.info/json',
];

const fetchRadioBrowserStations = async (): Promise<Station[]> => {
  const servers = shuffleArray([...API_SERVERS]);

  for (const serverUrl of servers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

      const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/bycountrycodeexact/IL?limit=300&hidebroken=true`;
      const response = await fetch(proxiedUrl, {
          signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to fetch from Radio-Browser server ${serverUrl} (status: ${response.status}), trying next.`);
        continue; // Try next server
      }
      const data: Station[] = await response.json();
      if (data && data.length > 0) {
        console.log(`Successfully fetched ${data.length} raw stations from ${serverUrl}`);
        return data;
      }
      
      console.warn(`Radio-Browser server ${serverUrl} returned empty or invalid station data, trying next.`);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Request to Radio-Browser server ${serverUrl} timed out, trying next.`);
      } else {
        console.warn(`Error connecting to Radio-Browser server ${serverUrl}:`, error);
      }
    }
  }

  console.error('Error fetching stations from Radio-Browser: All API servers failed.');
  return [];
};


const fetch100fmStations = async (): Promise<Station[]> => {
  const url = 'https://digital.100fm.co.il/app/';
  try {
    const proxiedUrl = `${CORS_PROXY_URL}${url}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(proxiedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Failed to fetch from 100fm API (status: ${response.status})`);
      return [];
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.stations)) {
      console.warn('100fm API returned invalid data format');
      return [];
    }

    const newStations: Station[] = data.stations.map((s: any) => ({
      stationuuid: `100fm-${s.slug}`,
      name: s.name,
      url_resolved: s.audioA || s.audio,
      favicon: s.cover || s.logo,
      tags: s.description?.split('\n')[0] || s.name,
      countrycode: 'IL',
      codec: 'AAC', // Assume AAC for HLS streams
      bitrate: 128, // Default bitrate
    }));

    console.log(`Successfully fetched ${newStations.length} stations from 100fm API`);
    return newStations.filter(s => s.url_resolved); // Ensure stations have a stream URL

  } catch (error) {
    console.error('Error fetching stations from 100fm API:', error);
    return [];
  }
};


// Renamed to fetchDefaultIsraeliStations to indicate this is the fallback logic
export const fetchDefaultIsraeliStations = async (): Promise<Station[]> => {
  const [radioBrowserResult, fm100Result] = await Promise.allSettled([
    fetchRadioBrowserStations(),
    fetch100fmStations(),
  ]);

  let allStations: Station[] = [];

  if (radioBrowserResult.status === 'fulfilled') {
    allStations = allStations.concat(radioBrowserResult.value);
  } else {
    console.error('Radio-Browser fetch failed:', radioBrowserResult.reason);
  }

  if (fm100Result.status === 'fulfilled') {
    allStations = allStations.concat(fm100Result.value);
  } else {
    console.error('100fm fetch failed:', fm100Result.reason);
  }

  if (allStations.length === 0) {
    console.error('Failed to fetch stations from any source.');
    return [];
  }

  // Clean up station names for specific providers like "JOINT RADIO"
  allStations.forEach(station => {
    if (station.name.toUpperCase().includes('JOINT RADIO')) {
        station.name = station.name
            .replace(/joint radio/i, '')
            .replace(/#/g, '')
            .trim();
    }
  });

  // --- Enhanced De-duplication Logic ---
  const uniqueStations = new Map<string, Station>();

  const getCanonicalName = (name: string): string | null => {
      const lowerCaseName = name.toLowerCase();
      for (const priorityStation of PRIORITY_STATIONS) {
          if (priorityStation.aliases.some(alias => lowerCaseName.includes(alias.toLowerCase()))) {
              return priorityStation.name;
          }
      }
      return null;
  };

  allStations.forEach(station => {
      if (station.url_resolved && station.favicon && station.name) {
          const canonicalName = getCanonicalName(station.name);
          
          const key = canonicalName || station.name.toLowerCase().trim().replace(/\s*fm\s*$/, '').replace(/[^a-z0-9\u0590-\u05FF]/g, '');
          
          const existingStation = uniqueStations.get(key);
          
          let shouldReplace = false;
          if (!existingStation) {
              shouldReplace = true;
          } else {
              // Prefer higher bitrate
              if (station.bitrate > existingStation.bitrate) {
                  shouldReplace = true;
              } 
              // If bitrates are equal, prefer 100fm source over radio-browser as it's curated
              else if (station.bitrate === existingStation.bitrate && station.stationuuid.startsWith('100fm-') && !existingStation.stationuuid.startsWith('100fm-')) {
                  shouldReplace = true;
              }
          }

          if (shouldReplace) {
              if (canonicalName) {
                  station.name = canonicalName;
              }
              uniqueStations.set(key, station);
          }
      }
  });
  
  const finalStations = Array.from(uniqueStations.values());
  console.log(`Successfully combined and de-duplicated ${finalStations.length} stations from all sources.`);
  return finalStations;
};

// Main function to get stations - prioritizes Cloud Firestore
export const fetchStations = async (): Promise<Station[]> => {
    // 1. Try to fetch from Firestore (Custom Admin List)
    try {
        const customStations = await fetchCustomStations();
        if (customStations && Array.isArray(customStations)) { // Empty array is valid (means admin deleted all)
            console.log(`Loaded ${customStations.length} stations from Cloud Storage.`);
            return customStations;
        }
    } catch (e) {
        console.warn("Failed to load custom stations, falling back to default API.", e);
    }

    // 2. Fallback to default API logic
    console.log("Loading default stations from external APIs...");
    return fetchDefaultIsraeliStations();
};

export const fetchLiveTrackInfo = async (stationuuid: string): Promise<string | null> => {
    if (!stationuuid) return null;

    const servers = shuffleArray([...API_SERVERS]);

    for (const serverUrl of servers) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

            // FIX: Added &t=${Date.now()} to bust proxy cache
            const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/check?uuids=${stationuuid}&t=${Date.now()}`;
            const response = await fetch(proxiedUrl, {
                signal: controller.signal,
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                continue; 
            }

            const data = await response.json();
            if (data && data.length > 0) {
                const nowPlaying = data[0].now_playing;
                const title = nowPlaying?.song?.title || data[0].title;
                if (title) {
                    return title;
                }
            }
        } catch (error) {
            // Silent on errors, just try the next server
        }
    }

    console.warn(`Could not fetch live track info for ${stationuuid} from any server.`);
    return null;
};

// --- New Function for 100fm Smart Player ---
export const fetch100fmPlaylist = async (stationIdOrSlug: string): Promise<SmartPlaylistItem[]> => {
    // Extract slug from ID if present (e.g., '100fm-retro' -> 'retro')
    const slug = stationIdOrSlug.replace('100fm-', '');
    
    // Default URL for last 12 tracks
    const url = `https://digital.100fm.co.il/api/nowplaying/${slug}/12`;
    const proxiedUrl = `${CORS_PROXY_URL}${url}`;

    try {
        const response = await fetch(proxiedUrl, { 
            cache: 'no-cache',
            headers: { 'Accept': 'application/xml, text/xml, */*' }
        });
        
        if (!response.ok) {
            console.warn(`Failed to fetch 100fm playlist for ${slug}: ${response.status}`);
            return [];
        }

        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        // Parse <track> elements. Note: The API might return a root element containing tracks or just a list of tracks.
        // XML parser handles the root structure automatically.
        const trackElements = xmlDoc.getElementsByTagName('track');
        const playlist: SmartPlaylistItem[] = [];

        for (let i = 0; i < trackElements.length; i++) {
            const track = trackElements[i];
            const artist = track.getElementsByTagName('artist')[0]?.textContent || '';
            const name = track.getElementsByTagName('name')[0]?.textContent || '';
            const timestamp = parseInt(track.getElementsByTagName('timestamp')[0]?.textContent || '0', 10);
            const before = parseInt(track.getElementsByTagName('before')[0]?.textContent || '0', 10);

            if (timestamp > 0) {
                playlist.push({ artist, name, timestamp, before });
            }
        }

        return playlist.sort((a, b) => a.timestamp - b.timestamp); // Sort by time (oldest first)

    } catch (error) {
        console.error(`Error parsing 100fm playlist for ${slug}:`, error);
        return [];
    }
};
