// Service worker simples: guarda os ficheiros do jogo para funcionar sem rede.
const CACHE = 'mister-foot-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  // Rede primeiro (para receber versões novas), cache se estiver offline.
  e.respondWith(
    fetch(e.request)
      .then((r) => { const c = r.clone(); caches.open(CACHE).then((cache) => cache.put(e.request, c)); return r })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  )
})
