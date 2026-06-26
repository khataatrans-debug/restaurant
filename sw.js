const CACHE = 'app-v2';

const ASSETS = [
  '/login.html',
  '/driver.html',
  '/app-config.js',
  '/manifest.json',

  '/icon-192.png',
  '/icon-512.png',

  '/icon-admin-192.png',
  '/icon-admin-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});