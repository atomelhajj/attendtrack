const CACHE = 'attendtrack-v1';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/db.js',
  './js/auth.js',
  './js/staff.js',
  './js/supervisor.js',
  './js/admin.js',
  './js/import.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
