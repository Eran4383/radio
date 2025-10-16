const CACHE_NAME = 'my-radio-cache-v4';
const urlsToCache = [
  '.',
  './index.html',
  './index.js',
  './App.js',
  './types.js',
  './constants.js',
  './icon.svg',
  './services/radioService.js',
  './services/scheduleService.js',
  './services/stationSpecificService.js',
  './services/categoryService.js',
  './hooks/useFavorites.js',
  './components/Icons.js',
  './components/Player.js',
  './components/StationList.js',
  './components/StationListSkeleton.js',
  './components/SettingsPanel.js',
  './components/NowPlaying.js',
  './components/Visualizer.js',
  './components/InteractiveText.js',
  './components/MarqueeText.js',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const cachePromises = urlsToCache.map(urlToCache => {
          return cache.add(urlToCache).catch(err => {
            console.warn(`Failed to cache ${urlToCache}:`, err);
          });
        });
        return Promise.all(cachePromises);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            if (response.type === 'opaque') {
                return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Only cache GET requests
                if(event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(err => {
            console.error('Fetch failed:', err);
            throw err;
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Ensure the new service worker takes control immediately
  );
});