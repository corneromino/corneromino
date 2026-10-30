const CACHE_PREFIX = 'corneromino-shell-'
const APP_VERSION = new URL(self.location.href).searchParams.get('v') || 'unknown'
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)))),
  ]))
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    // Always revalidate navigations, so an installed app launches the newest
    // deployed HTML instead of an HTTP-cache copy of an older release.
    fetch(event.request, event.request.mode === 'navigate' ? { cache: 'no-store' } : undefined)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const cachedResponse = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cachedResponse))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((response) => response ?? caches.match('./index.html'))),
  )
})
