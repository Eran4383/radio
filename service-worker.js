const CACHE_NAME = 'radio-premium-cache-v16'; // Root cause fix for manifest updates
const urlsToCache = [
  './',
  './index.html',
  './manifest.json', // Caching the un-versioned file.
  './icon-192-v2.png',
  './icon-512-v2.png',
  './index.js',
  './App.js',
  './types.js',
  './constants.js',
  './hooks/useFavorites.js',
  './services/radioService.js',
  './services/scheduleService.js',
  './services/stationSpecificService.js',
  './services/categoryService.js',
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
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching assets for v16.');
        const cachePromises = urlsToCache.map(urlToCache => {
          // Always fetch a fresh manifest during installation.
          if (urlToCache.endsWith('manifest.json')) {
            return cache.add(new Request(urlToCache, { cache: 'reload' }));
          }
          return cache.add(urlToCache);
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Ignore non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Use a "Network first, falling back to cache" strategy for the manifest.
  // This is the core fix to ensure the app is always installable with the latest icons.
  if (requestUrl.pathname.endsWith('manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // On success, update the cache with the fresh manifest
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If the network fails, serve the manifest from the cache.
          return caches.match(event.request);
        })
    );
    return;
  }

  // Use a "Cache first, falling back to network" strategy for all other assets.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return from cache if found
        if (response) {
          return response;
        }

        // Fetch from network if not in cache
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});