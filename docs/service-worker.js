
const CACHE_NAME = 'my-radio-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  
  // Icons & Assets
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './shortcut-favorites.png',
  './screenshot1.png',
  './screenshot2.png',
  './icon.svg',
  
  // Scripts
  './index.js',
  './App.js',
  './types.js',
  './constants.js',

  // Hooks
  './hooks/useFavorites.js',

  // Services
  './services/radioService.js',
  './services/scheduleService.js',
  './services/stationSpecificService.js',
  './services/categoryService.js',
  
  // Components
  './components/Icons.js',
  './components/Player.js',
  './components/StationList.js',
  './components/StationListSkeleton.js',
  './components/SettingsPanel.js',
  './components/NowPlaying.js',
  './components/Visualizer.js',
  './components/InteractiveText.js',
  './components/MarqueeText.js',
  './components/ActionMenu.js',

  // External (will be cached if accessed)
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets.');
        const cachePromises = urlsToCache.map(urlToCache => {
          // Create a new Request object to ignore cache on the initial fetch
          const request = new Request(urlToCache, { cache: 'reload' });
          return fetch(request).then(response => {
            if (response.ok) {
              return cache.put(urlToCache, response);
            }
            console.warn(`Failed to fetch and cache ${urlToCache}: Status ${response.status}`);
            return Promise.resolve(); // Don't let one failed asset stop the whole process
          }).catch(err => {
            console.warn(`Failed to cache ${urlToCache}:`, err);
          });
        });
        return Promise.all(cachePromises);
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
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});


self.addEventListener('fetch', event => {
  // Only handle http/https requests, ignore others (like chrome-extension://)
  if (!event.request.url.startsWith('http')) {
      return;
  }
  
  // For navigation requests, always try network first to get the latest HTML.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  
  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Return from cache
        }

        // Not in cache, fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Don't cache opaque responses (e.g., from CORS proxies) or errors
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Cache the new response if it's a GET request
            if (event.request.method === 'GET') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                      cache.put(event.request, responseToCache);
                  });
            }

            return networkResponse;
          }
        ).catch(err => {
            console.error('Fetch failed; returning offline fallback if available.', err);
            // You could return a fallback offline image/page here if you had one cached
        });
      })
  );
});
