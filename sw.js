const CACHE_NAME = 'shift-tracker-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

self.addEventListener('install', (event) => {
    // skipWaiting заставляет новый Service Worker активироваться немедленно
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Очистка старого кэша при активации новой версии
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Захват управления страницами
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});