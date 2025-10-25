import { Station } from '../types';
import { PRIORITY_STATIONS } from '../constants';
import { CORS_PROXY_URL } from '../constants';

// Helper function to fetch with retries and timeout
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout for each attempt

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        return response;
      }
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      // For server errors (5xx), we will retry
      console.warn(`Attempt ${i + 1} failed with status ${response.status}. Retrying in ${delay / 1000}s...`);

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error; // Rethrow last error
      console.warn(`Attempt ${i + 1} failed with error: ${error.message}. Retrying in ${delay / 1000}s...`);
    }

    await new Promise(res => setTimeout(res, delay * (i + 1))); // Exponential backoff
  }
  throw new Error('All fetch attempts failed.');
};


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
      const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/bycountrycodeexact/IL?limit=300&hidebroken=true`;
      const response = await fetchWithRetry(proxiedUrl, {});
      
      const data: Station[] = await response.json();
      if (data && data.length > 0) {
        console.log(`Successfully fetched ${data.length} raw stations from ${serverUrl}`);
        return data;
      }
      
      console.warn(`Radio-Browser server ${serverUrl} returned empty or invalid station data, trying next.`);

    } catch (error: any) {
        console.warn(`Error connecting to Radio-Browser server ${serverUrl}:`, error.message);
    }
  }

  console.error('Error fetching stations from Radio-Browser: All API servers failed.');
  return [];
};


const fetch100fmStations = async (): Promise<Station[]> => {
  const url = 'https://digital.100fm.co.il/app/';
  try {
    const proxiedUrl = `${CORS_PROXY_URL}${url}`;
    const response = await fetchWithRetry(proxiedUrl, {});
    
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

  } catch (error: any) {
    console.error('Error fetching stations from 100fm API:', error.message);
    return [];
  }
};


export const fetchIsraeliStations = async (): Promise<Station[]> => {
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

export const fetchLiveTrackInfo = async (stationuuid: string): Promise<string | null> => {
    if (!stationuuid) return null;

    const servers = shuffleArray([...API_SERVERS]);

    for (const serverUrl of servers) {
        try {
            const proxiedUrl = `${CORS_PROXY_URL}${serverUrl}/stations/check?uuids=${stationuuid}`;
            const response = await fetchWithRetry(proxiedUrl, { cache: 'no-cache' }, 2, 500); // Fewer retries for live info

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