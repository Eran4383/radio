

const CACHE_NAME = 'radio-premium-cache-1.0-06.12.2025-v5'; // Simplified update process
const urlsToCache = [
  './index.html',
  './manifest.json?v=23',
  './icon.svg',
  './index.js',
  './App.js',
  './types.js',
  './constants.js',
  './services/firebase.js',
  './services/radioService.js',
  './services/scheduleService.js',
  './services/stationSpecificService.js',
  './services/categoryService.js',
  './components/Auth.js',
  './components/MergeDataModal.js',
  './components/ConfirmRemoveModal.js',
  './components/Icons.js',
  './components/Player.js',
  './components/StationList.js',
  './components/StationListSkeleton.js',
  './components/SettingsPanel.js',
  './components/NowPlaying.js',
  './components/Visualizer.js',
  './components/InteractiveText.js',
  './components/MarqueeText.js',
  './components/ActionMenu.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching assets for v23.');
        const cachePromises = urlsToCache.map(url => {
          return fetch(new Request(url, { cache: 'reload' }))
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
              console.warn(`Failed to cache ${url}: status ${response.status}`);
              return Promise.resolve(); 
            })
            .catch(err => {
              console.error(`Failed to fetch and cache ${url}`, err);
              return Promise.resolve();
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Ignore non-GET requests (like POST to Firebase)
  if (event.request.method !== 'GET') {
    return;
  }

  if (!event.request.url.startsWith('http')) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Network first for manifest.json to ensure PWA metadata is always fresh.
  if (requestUrl.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            const urlToCache = new URL(event.request.url);
            urlToCache.search = '?v=1.0-06.12.2025-v5';
            cache.put(urlToCache.href, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
           const urlToMatch = new URL(event.request.url);
           urlToMatch.search = '?v=1.0-06.12.2025-v5';
          return caches.match(urlToMatch.href);
        })
    );
    return;
  }

  // Cache first for all other requests.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
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