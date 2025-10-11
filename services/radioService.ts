import { Station } from '../types';
import { PRIORITY_STATIONS } from '../constants';
import { CORS_PROXY_URL } from '../constants';

// Function to shuffle an array for load distribution
const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// A larger, hardcoded list of reliable API servers.
// We shuffle this list and try them one by one. This avoids a single point of failure
// from a dynamic server discovery URL and is more resilient to individual server outages.
const API_SERVERS = [
    'https://de1.api.radio-browser.info/json',
    'https://nl1.api.radio-browser.info/json',
    'https://fr1.api.radio-browser.info/json',
    'https://at1.api.radio-browser.info/json',
    'https://radio.cloud-api.online/json',
    'https://de2.api.radio-browser.info/json',
];

export const fetchIsraeliStations = async (): Promise<Station[]> => {
  const servers = shuffleArray([...API_SERVERS]);

  for (const serverUrl of servers) {
    try {
      // Use a timeout to prevent getting stuck on a non-responsive server
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

      const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/bycountrycodeexact/IL?limit=300&hidebroken=true`;
      const response = await fetch(proxiedUrl, {
          signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to fetch from server ${serverUrl} (status: ${response.status}), trying next.`);
        continue; // Try next server
      }
      const data: Station[] = await response.json();

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

      data.forEach(station => {
          if (station.url_resolved && station.favicon && station.bitrate > 32 && station.name) {
              const canonicalName = getCanonicalName(station.name);
              
              const key = canonicalName || station.name.toLowerCase().trim().replace(/\s*fm\s*$/, '').replace(/[^a-z0-9\u0590-\u05FF]/g, '');
              
              const existingStation = uniqueStations.get(key);
              
              if (!existingStation || station.bitrate > existingStation.bitrate) {
                  if (canonicalName) {
                      station.name = canonicalName;
                  }
                  uniqueStations.set(key, station);
              }
          }
      });
      
      if (uniqueStations.size > 0) {
          console.log(`Successfully fetched and de-duplicated ${uniqueStations.size} stations from ${serverUrl}`);
          return Array.from(uniqueStations.values());
      }
      console.warn(`Server ${serverUrl} returned empty or invalid station data, trying next.`);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Request to server ${serverUrl} timed out, trying next.`);
      } else {
        console.warn(`Error connecting to server ${serverUrl}:`, error);
      }
    }
  }

  console.error('Error fetching stations: All API servers failed.');
  return [];
};

export const fetchLiveTrackInfo = async (stationuuid: string): Promise<string | null> => {
    if (!stationuuid) return null;

    const servers = shuffleArray([...API_SERVERS]);

    for (const serverUrl of servers) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

            const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/check?uuids=${stationuuid}`;
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