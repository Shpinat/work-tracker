const CACHE_NAME = 'worktrack-v3.0';

// Относительные пути (корректно работают в GitHub Pages подкаталогах)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './data/storage.js',
    './data/backup.js',
    './domain/payroll.js',
    './domain/analytics.js',
    './domain/schedule.js',
    './ui/icons.js',
    './ui/toast.js',
    './ui/modals.js',
    './ui/shift-list.js',
    './ui/calendar.js',
    './manifest.webmanifest',
    './icon-192x192.png',
    './icon-512x512.png',
    './icon-192x192.png?v=3',
    './icon-512x512.png?v=3'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Очистка старых кэшей при обновлении версии
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия Network First с откатом в кэш и офлайн-фоллбэком
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Если сеть ответила нормально, обновляем кэш
                if (networkResponse && networkResponse.status === 200) {
                    const resClone = networkResponse.clone();
                    // Защита от Captive Portals: не кэшируем HTML ответ вместо скриптов/стилей
                    const reqDest = event.request.destination;
                    const resType = resClone.headers.get('content-type') || '';
                    const isHtml = resType.includes('text/html');

                    if ((reqDest === 'script' || reqDest === 'style' || reqDest === 'image') && isHtml) {
                         // Captive portal detected, don't put in cache
                    } else if (networkResponse.redirected) {
                         // Captive portal might redirect
                    } else {
                         caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
                    }
                }
                return networkResponse;
            })
            .catch(() => {
                // В офлайне отдаем кэш, если есть — иначе фоллбэк на index.html
                return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                    return cached || caches.match('./index.html');
                });
            })
    );
});

// Слушаем команду на мгновенную активацию
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
