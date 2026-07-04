// Fiti Electronics service worker: offline-first for the app shell,
// stale-while-revalidate for everything else.
const CACHE_NAME = 'fiti-v1';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './js/cart.js',
    './js/utils.js',
    './db.json',
    './manifest.json',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Never cache API mutations
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            const network = fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
