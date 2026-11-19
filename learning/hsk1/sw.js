const SCOPE = self.registration.scope;
const CACHE_PREFIX = `han-ngu-hsk1:${SCOPE}:`;
const VERSION = 'local-v11'; // Replaced with the commit SHA in the Pages artifact.
const CACHE = CACHE_PREFIX + VERSION;
const APP_SHELL = new URL('index.html', SCOPE).href;
const CORE = new Set([
  'index.html', 'styles.css', 'boot.js', 'data.js', 'engine.js', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'art/school.webp', 'art/market.webp', 'art/river.webp',
  'arcade/arcade.css', 'arcade/pinyin.css', 'arcade/strokes.css', 'arcade/memory-games.css',
  'arcade/catalog.js', 'arcade/visual.js', 'arcade/strokes-data.js', 'arcade/pinyin.js',
  'arcade/cinema.css', 'arcade/cinema-scenes.js', 'arcade/story-world.js', 'arcade/game-sets.js',
  'arcade/strokes.js', 'arcade/pairs.js', 'arcade/flow.js',
  'arcade/wind.js', 'arcade/echo.js', 'arcade/riddle.js', 'arcade/lights.js',
  'arcade/wind.css', 'arcade/echo.css', 'arcade/riddle.css', 'arcade/lights.css',
  'arcade/ARPHICPL.TXT', 'arcade/vendor/THREE-LICENSE.txt',
  'arcade/vendor/three.module.min.js', 'arcade/vendor/three.core.min.js'
].map(path => new URL(path, SCOPE).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll([...CORE].map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'activate-hsk1-update') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let cacheKey = request.url;
  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    url.search = '';
    if (url.href === SCOPE || url.href === APP_SHELL) cacheKey = APP_SHELL;
  }
  if (!CORE.has(cacheKey)) return;

  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE);
      const response = await cache.match(cacheKey);
      if (response) return response;
    } catch {
      // A browser may evict caches or revoke storage while the app is open.
    }
    return fetch(request);
  })());
});
