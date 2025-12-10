
import { PRIORITY_STATIONS } from '../constants.js';
import { CORS_PROXY_URL } from '../constants.js';
import { fetchCustomStations } from './firebase.js';

let networkConfig = null;

export const setGlobalNetworkConfig = (config) => {
    networkConfig = config;
};

// Function to shuffle an array for load distribution
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const API_SERVERS = [
    'https://de1.api.radio-browser.info/json',
    'https://nl1.api.radio-browser.info/json',
    'https://fr1.api.radio-browser.info/json',
    'https://at1.api.radio-browser.info/json',
    'https://radio.cloud-api.online/json',
    'https://de2.api.radio-browser.info/json',
];

const fetchRadioBrowserStations = async () => {
  const servers = shuffleArray([...API_SERVERS]);

  for (const serverUrl of servers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // FIX: Direct connection without proxy for mobile compatibility
      const url = `${serverUrl}/stations/bycountrycodeexact/IL?limit=300&hidebroken=true`;
      const response = await fetch(url, {
          signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        continue; 
      }
      const data = await response.json();
      if (data && data.length > 0) {
        console.log(`Successfully fetched ${data.length} raw stations from ${serverUrl}`);
        return data;
      }
    } catch (error) {
      // silent fail try next
    }
  }
  return [];
};


const fetch100fmStations = async () => {
  const url = 'https://digital.100fm.co.il/app/';
  try {
    let useProxy = false;
    if (networkConfig?.forceProxyMetadata.includes('100fm-stations')) {
        useProxy = true;
    }

    const fetchUrl = useProxy ? `${CORS_PROXY_URL}${url}` : url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.stations)) {
      return [];
    }

    const newStations = data.stations.map((s) => ({
      stationuuid: `100fm-${s.slug}`,
      name: s.name,
      url_resolved: s.audioA || s.audio,
      favicon: s.cover || s.logo,
      tags: s.description?.split('\n')[0] || s.name,
      countrycode: 'IL',
      codec: 'AAC',
      bitrate: 128, 
    }));

    return newStations.filter(s => s.url_resolved); 

  } catch (error) {
    return [];
  }
};


export const fetchDefaultIsraeliStations = async () => {
  const [radioBrowserResult, fm100Result] = await Promise.allSettled([
    fetchRadioBrowserStations(),
    fetch100fmStations(),
  ]);

  let allStations = [];

  if (radioBrowserResult.status === 'fulfilled') {
    allStations = allStations.concat(radioBrowserResult.value);
  }

  if (fm100Result.status === 'fulfilled') {
    allStations = allStations.concat(fm100Result.value);
  }

  if (allStations.length === 0) {
    console.error('Failed to fetch stations from any source.');
    return [];
  }

  allStations.forEach(station => {
    if (station.name.toUpperCase().includes('JOINT RADIO')) {
        station.name = station.name
            .replace(/joint radio/i, '')
            .replace(/#/g, '')
            .trim();
    }
  });

  const uniqueStations = new Map();

  const getCanonicalName = (name) => {
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
              if (station.bitrate > existingStation.bitrate) {
                  shouldReplace = true;
              } 
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
  
  return Array.from(uniqueStations.values());
};

export const fetchStations = async () => {
    try {
        const customStations = await fetchCustomStations();
        if (customStations && Array.isArray(customStations)) {
            console.log(`Loaded ${customStations.length} stations from Cloud Storage.`);
            return customStations;
        }
    } catch (e) {
        console.warn("Failed to load custom stations, falling back to default API.", e);
    }

    console.log("Loading default stations from external APIs...");
    return fetchDefaultIsraeliStations();
};

export const fetchLiveTrackInfo = async (stationuuid) => {
    if (!stationuuid) return null;

    const servers = shuffleArray([...API_SERVERS]);

    for (const serverUrl of servers) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); 

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
            // Silent on errors
        }
    }
    return null;
};

export const fetch100fmPlaylist = async (stationIdOrSlug) => {
    const slug = stationIdOrSlug.replace('100fm-', '');
    const url = `https://digital.100fm.co.il/api/nowplaying/${slug}/12`;
    
    let useProxy = false;
    if (networkConfig?.forceProxyMetadata.includes('100fm-metadata')) {
        useProxy = true;
    }

    const fetchUrl = useProxy ? `${CORS_PROXY_URL}${url}` : url;

    try {
        const response = await fetch(fetchUrl, { 
            cache: 'no-cache',
            headers: { 'Accept': 'application/xml, text/xml, */*' }
        });
        
        if (!response.ok) {
            return [];
        }

        const text = await response.text();
        const playlist = [];
        const trackRegex = /<track>([\s\S]*?)<\/track>/g;
        const nameRegex = /<name>(.*?)<\/name>/;
        const artistRegex = /<artist>(.*?)<\/artist>/;
        const timestampRegex = /<timestamp>(\d+)<\/timestamp>/;
        const beforeRegex = /<before>(\d+)<\/before>/;

        let match;
        while ((match = trackRegex.exec(text)) !== null) {
            const trackContent = match[1];
            const nameMatch = nameRegex.exec(trackContent);
            const artistMatch = artistRegex.exec(trackContent);
            const timestampMatch = timestampRegex.exec(trackContent);
            const beforeMatch = beforeRegex.exec(trackContent);

            if (nameMatch && timestampMatch) {
                const name = nameMatch[1].trim();
                if (name.length < 2 || name.toLowerCase() === 'p') continue;

                playlist.push({
                    name: name,
                    artist: artistMatch ? artistMatch[1].trim() : '',
                    timestamp: parseInt(timestampMatch[1], 10),
                    before: beforeMatch ? parseInt(beforeMatch[1], 10) : 0
                });
            }
        }

        return playlist.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
        console.error(`Error parsing 100fm playlist for ${slug}:`, error);
        return [];
    }
};
