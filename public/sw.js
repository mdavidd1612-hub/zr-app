// Service Worker para ZR App
// Permite que la app funcione sin conexión:
// - El carnet se genera del IndexedDB local
// - La cola de escaneos se sincroniza cuando vuelve la conexión

const CACHE_NAME = 'zr-app-v1'
const URLS_TO_CACHE = [
  '/',
  '/offline',
  '/app.css',
  '/app.js',
]

// Instalación: cachear recursos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // Si alguna URL no existe, continuar igualmente
        // El Service Worker sigue funcionando
      })
    })
  )
  self.skipWaiting()
})

// Activación: limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Red-first, cache-fallback:
// - Intenta la red primero
// - Si falla, usa la versión en caché
self.addEventListener('fetch', (event) => {
  // Solo cachear GET
  if (event.request.method !== 'GET') {
    return
  }

  // Las API calls y auth: solo red (podrían fallar, está bien)
  if (
    event.request.url.includes('/auth/') ||
    event.request.url.includes('/functions/') ||
    event.request.url.includes('supabase.co')
  ) {
    return
  }

  // Recursos estáticos: cache-first
  if (
    event.request.url.includes('.css') ||
    event.request.url.includes('.js') ||
    event.request.url.includes('.woff') ||
    event.request.url.includes('.png') ||
    event.request.url.includes('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((response) => {
            // Cachear la respuesta si es éxito
            if (response.status === 200) {
              const cache = caches.open(CACHE_NAME)
              cache.then((c) => c.put(event.request, response.clone()))
            }
            return response
          })
        )
      })
    )
    return
  }

  // Documentos HTML: network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear si es éxito
        if (response.status === 200 && event.request.method === 'GET') {
          const cache = caches.open(CACHE_NAME)
          cache.then((c) => c.put(event.request, response.clone()))
        }
        return response
      })
      .catch(() => {
        // Si la red falla, intentar caché
        return caches.match(event.request).then((response) => {
          return response || new Response('Sin conexión', { status: 503 })
        })
      })
  )
})

// Message API: permitir que el cliente fuerce actualización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
