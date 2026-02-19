/**
 * Service Worker Personalizado para Miss Chulerías POS
 * Maneja sincronización en background y cacheo de recursos
 */

const CACHE_NAME = 'miss-chulerias-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js'
];

// Instalación - Cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando recursos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error en instalación:', error);
      })
  );
});

// Activación - Limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Eliminando cache antigua:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completada');
        return self.clients.claim();
      })
  );
});

// Fetch - Estrategia de cacheo
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar requests de API (las maneja la app con IndexedDB)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Estrategia: Cache First para recursos estáticos
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Retornar del cache y actualizar en background
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, networkResponse);
                  });
                }
              })
              .catch(() => {
                // Error de red, usar cache
              });
            return cachedResponse;
          }

          // Si no está en cache, buscar en la red
          return fetch(request)
            .then((networkResponse) => {
              if (!networkResponse.ok) {
                throw new Error('Network response was not ok');
              }
              
              // Guardar en cache
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
              
              return networkResponse;
            })
            .catch((error) => {
              console.error('[SW] Error fetching:', error);
              throw error;
            });
        })
    );
  }
});

// Background Sync - Sincronización cuando vuelva la conexión
self.addEventListener('sync', (event) => {
  console.log('[SW] Evento de sincronización:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncPendingSales());
  } else if (event.tag === 'sync-purchases') {
    event.waitUntil(syncPendingPurchases());
  } else if (event.tag === 'sync-transfers') {
    event.waitUntil(syncPendingTransfers());
  } else if (event.tag === 'sync-all') {
    event.waitUntil(syncAll());
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event);
  
  const options = {
    body: event.data?.text() || 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Miss Chulerías', options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

// Funciones de sincronización (se ejecutan en background)
async function syncPendingSales() {
  console.log('[SW] Sincronizando ventas pendientes...');
  // La sincronización real la hace la app principal via SyncManager
  // Esto es solo un trigger para que la app sepa que debe sincronizar
  
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_SALES' });
  });
}

async function syncPendingPurchases() {
  console.log('[SW] Sincronizando compras pendientes...');
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_PURCHASES' });
  });
}

async function syncPendingTransfers() {
  console.log('[SW] Sincronizando traslados pendientes...');
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_TRANSFERS' });
  });
}

async function syncAll() {
  console.log('[SW] Sincronizando todo...');
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_ALL' });
  });
}

// Mensajes desde la aplicación
self.addEventListener('message', (event) => {
  console.log('[SW] Mensaje recibido:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'REGISTER_SYNC') {
    registerBackgroundSync(event.data.tag);
  }
});

// Registrar sincronización en background
async function registerBackgroundSync(tag) {
  try {
    const registration = await self.registration;
    await registration.sync.register(tag);
    console.log('[SW] Sincronización registrada:', tag);
  } catch (error) {
    console.error('[SW] Error registrando sincronización:', error);
  }
}

console.log('[SW] Service Worker cargado');
