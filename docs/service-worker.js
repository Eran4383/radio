const CACHE_NAME = 'radio-premium-cache-v27'; // Incremented version to force update
const urlsToCache = [
  './index.html',
  './manifest.json?v=27', // Incremented version
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
  './components/MergeDataModal.js',
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
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache for v27. Caching all assets atomically.');
        // Use addAll for atomic caching. It fetches and caches in a single operation.
        // If any file fails to download, the entire operation fails, and the Promise rejects.
        // This is the correct, robust way to handle installation.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All files cached successfully for v27.');
      })
      .catch(error => {
        // If addAll fails, the installation will fail, which is the desired behavior.
        console.error('Service Worker installation failed for v27:', error);
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

  // Network first for manifest.json to ensure PWA metadata is always fresh.
  if (requestUrl.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            const urlToCache = new URL(event.request.url);
            urlToCache.search = '?v=27';
            cache.put(urlToCache.href, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
           const urlToMatch = new URL(event.request.url);
           urlToMatch.search = '?v=27';
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
