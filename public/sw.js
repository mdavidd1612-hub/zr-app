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

  // Cualquier llamada a otro origen (Supabase, en producción o local, y
  // cualquier otra API) va solo por red — nunca por la estrategia de caché
  // de este service worker, que es para los recursos DE ESTA APP. Antes
  // solo se excluía por texto ("supabase.co", "/auth/", "/functions/"), lo
  // que dejaba pasar /rest/v1/ sin querer — inofensivo en producción
  // (mismo dominio supabase.co que sí calzaba), pero en desarrollo local
  // (Supabase en 127.0.0.1) el service worker interceptaba esas llamadas y,
  // ante cualquier tropiezo de red, devolvía su "Sin conexión" en vez de
  // dejarlas pasar — parecía que el backend local fallaba constantemente,
  // y era esto.
  if (new URL(event.request.url).origin !== self.location.origin) {
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

// Web Push: send-push (Edge Function, corre cada 5 min por pg_cron) manda el
// payload como JSON con { title, body, payload }. payload trae los datos para
// saber a dónde navegar al tocar la notificación (ej. exam_id).
self.addEventListener('push', (event) => {
  if (!event.data) return

  let datos
  try {
    datos = event.data.json()
  } catch {
    datos = { title: 'ZR App', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'ZR App', {
      body: datos.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: datos.payload || {},
    }),
  )
})

// Al tocar la notificación: si ya hay una pestaña abierta, la enfoca en vez
// de abrir una nueva — en un teléfono, dos pestañas de la misma app confunden.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const destino = event.notification.data?.exam_id
    ? `/examenes/${event.notification.data.exam_id}`
    : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) {
          cliente.navigate(destino)
          return cliente.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
