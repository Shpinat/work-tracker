const CACHE_NAME = 'worktrack-v3.4';

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

// Стратегия Network First с безопасным офлайн-фоллбэком
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const reqUrl = new URL(event.request.url);
    const isSameOrigin = reqUrl.origin === self.location.origin;
    const isNavigate = event.request.mode === 'navigate';

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Кэшируем только корректные ответы same-origin (без captive-portal подмен и редиректов)
                if (isSameOrigin && networkResponse && networkResponse.status === 200 && !networkResponse.redirected) {
                    const resClone = networkResponse.clone();
                    const reqDest = event.request.destination;
                    const resType = resClone.headers.get('content-type') || '';
                    const isHtml = resType.includes('text/html');

                    if (!((reqDest === 'script' || reqDest === 'style' || reqDest === 'image') && isHtml)) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
                    }
                }
                return networkResponse;
            })
            .catch(() => {
                // В офлайне отдаем кэш; фоллбэк на index.html только для навигации
                return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
                    if (cached) return cached;
                    if (isNavigate) return caches.match('./index.html');
                    return Response.error();
                });
            })
    );
});

// Слушаем команду на мгновенную активацию
self.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'skipWaiting' || event.data.type === 'SKIP_WAITING')) {
        self.skipWaiting();
    }
});
