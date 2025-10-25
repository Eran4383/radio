const CACHE_NAME = 'radio-premium-cache-v21'; // Force update for correct icons and auth logic
const urlsToCache = [
  './index.html',
  './manifest.json?v=21',
  './icon-192-v2.png',
  './icon-512-v2.png',
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
  self.skipWaiting(); // Force the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching assets for v21.');
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
  const req = event.request;
  
  // Don't cache anything that's not a GET request or not http/https
  if (req.method !== 'GET' || !req.url.startsWith('http')) {
    return;
  }
  
  const requestUrl = new URL(req.url);

  // For proxy requests, always go to network first to get fresh data
  if (requestUrl.hostname.includes('corsproxy.io')) {
      event.respondWith(
          fetch(req).catch(() => {
              // Optional: return a generic error response if network fails
          })
      );
      return;
  }

  // Network first for manifest.json to ensure PWA metadata is always fresh.
  if (requestUrl.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(req)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            const urlToCache = new URL(req.url);
            urlToCache.search = '?v=21';
            cache.put(urlToCache.href, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
           const urlToMatch = new URL(req.url);
           urlToMatch.search = '?v=21';
          return caches.match(urlToMatch.href);
        })
    );
    return;
  }

  // Cache first, then network for all other static assets
  event.respondWith(
    caches.match(req)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(req).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(req, responseToCache);
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