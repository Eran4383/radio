const CACHE_NAME = 'radio-premium-cache-v15'; // Bumped version for update mechanism
const urlsToCache = [
  './',
  './index.html',
  './manifest.json?v=1.9.4',
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
  // We no longer call skipWaiting() here automatically.
  // We wait for the user to confirm the update via a message.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching assets.');
        // When caching, we must cache the un-versioned manifest so it can be found.
        const cachePromises = urlsToCache.map(urlToCache => {
            if (urlToCache.includes('manifest.json')) {
                return cache.add(new Request('./manifest.json', { cache: 'reload' }));
            }
            return cache.add(urlToCache);
        });
        return Promise.all(cachePromises).catch(err => {
          console.error('Failed to cache all required files during install:', err);
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
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Special handling for the manifest file to ignore the query string when matching in cache
  if (requestUrl.pathname.endsWith('/manifest.json')) {
      event.respondWith(
          caches.match('./manifest.json').then(response => {
              return response || fetch(event.request);
          })
      );
      return;
  }

  // Use a cache-first strategy for all other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response to cache
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
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