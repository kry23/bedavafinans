/* BedavaFinans Service Worker - Stale-while-revalidate caching */

const CACHE_NAME = 'bedavafinans-v2';
const STATIC_ASSETS = [
    '/',
    '/static/css/custom.css',
    '/static/js/utils.js',
    '/static/js/i18n.js',
    '/static/js/api.js',
    '/static/js/charts.js',
    '/static/js/signals.js',
    '/static/js/widgets.js',
    '/static/js/app.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // API calls: network-first
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return res;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Static assets: stale-while-revalidate (show cache, update in background)
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(request).then((cached) => {
                const fetched = fetch(request).then((networkRes) => {
                    cache.put(request, networkRes.clone());
                    return networkRes;
                }).catch(() => cached);
                return cached || fetched;
            })
        )
    );
});
