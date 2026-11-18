/* Service worker de Park&Go Tunja.
 * - Precarga el "shell" (index, página sin conexión, íconos, logo).
 * - Navegación: primero la red; sin conexión usa el index guardado o offline.html.
 * - /assets/* (archivos de Vite con hash): primero la caché.
 * - /api/** NUNCA se intercepta ni se guarda (network-only): ni datos de sesión ni
 *   tokens llegan a la caché. Tampoco se guardan peticiones a otros dominios.
 */
const VERSION = 'parkgo-v1'
const SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/img/logo-blanco.png',
  '/img/logo-color.png',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim()),
  )
})

const sePuedeGuardar = (respuesta) => respuesta && respuesta.ok && respuesta.type === 'basic'

async function guardar(peticion, respuesta) {
  if (!sePuedeGuardar(respuesta)) return
  const cache = await caches.open(VERSION)
  await cache.put(peticion, respuesta)
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // La API siempre va a la red y jamás se guarda.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        const respuesta = await fetch(request)
        // El HTML es el mismo para todas las rutas (SPA): se guarda como "/".
        if (sePuedeGuardar(respuesta)) await guardar('/', respuesta.clone())
        return respuesta
      } catch {
        return (await caches.match('/')) ?? (await caches.match('/offline.html'))
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith((async () => {
      const guardada = await caches.match(request)
      if (guardada) return guardada
      const respuesta = await fetch(request)
      await guardar(request, respuesta.clone())
      return respuesta
    })())
    return
  }

  // Imágenes e íconos: se muestra lo guardado y se actualiza en segundo plano.
  if (/\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    evento.respondWith((async () => {
      const guardada = await caches.match(request)
      const red = fetch(request).then(async (respuesta) => { await guardar(request, respuesta.clone()); return respuesta }).catch(() => null)
      return guardada ?? (await red) ?? Response.error()
    })())
  }
})
