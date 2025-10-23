// This service worker is intentionally minimal for the source directory.
// Its purpose is to prevent 404 errors during local development, as index.tsx registers it.
// The actual PWA caching logic is handled by docs/service-worker.js for the deployed application.

self.addEventListener('install', (event) => {
  console.log('Source Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  console.log('Source Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler. Does not intercept or cache requests.
  event.respondWith(fetch(event.request));
});
