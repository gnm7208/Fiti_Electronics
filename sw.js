// Fiti Electronics service worker: offline-first for the app shell,
// network-first (falling back to cache only when offline) for everything
// else, so catalog/asset updates are never masked by a stale cache.
const CACHE_NAME = 'fiti-v4';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './js/cart.js',
    './js/utils.js',
    './js/payments.js',
    './js/deals.js',
    './js/queries.js',
    './db.json',
    './manifest.json',
    './fonts/manrope-latin-400-normal.woff2',
    './fonts/manrope-latin-500-normal.woff2',
    './fonts/manrope-latin-600-normal.woff2',
    './fonts/manrope-latin-700-normal.woff2',
    './fonts/manrope-latin-800-normal.woff2',
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

    // Network-first: always prefer a live response so updated product images,
    // catalog data, etc. show immediately. Cache is only a fallback for when
    // the network is unavailable (offline support), not a shortcut that can
    // mask fresher content behind stale bytes.
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
