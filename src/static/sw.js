// Service Worker para Family Guardian 360° PWA
const CACHE_NAME = 'family-guardian-v1';
const urlsToCache = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/dashboard.js',
  '/static/js/map.js',
  '/static/js/messages.js',
  '/static/js/settings.js',
  '/static/images/default-avatar.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Instalação do Service Worker
self.addEventListener('install', function(event) {
    console.log('Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estratégia: Network First, fallback para Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone da resposta
        const responseClone = response.clone();

        // Atualiza o cache com a nova resposta
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Se falhar, tenta buscar do cache
        return caches.match(event.request);
      })
  );
});

// Notificações Push
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação',
    icon: '/static/images/icon-192x192.png',
    badge: '/static/images/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'family-guardian-notification',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification('Family Guardian 360°', options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Sincronização periódica em background
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-location') {
        event.waitUntil(updateLocationInBackground());
    }
});

// Atualiza localização mesmo em background
async function updateLocationInBackground() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,  // GPS de alta precisão
                timeout: 30000,             // 30s para precisão máxima
                maximumAge: 0               // Sempre nova localização
            });
        });

        const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: new Date().toISOString()
        };

        await fetch('/api/location/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        });

        console.log('📍 Localização atualizada em background pelo Service Worker');
    } catch (error) {
        console.error('❌ Erro ao atualizar localização em background:', error);
    }
}

// Sync periódico de localização (quando o navegador permitir)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-location') {
        event.waitUntil(updateLocationInBackground());
    }
});

async function updateLocationInBackground() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,  // GPS de alta precisão
                timeout: 30000,             // 30s para precisão máxima
                maximumAge: 0               // Sempre nova localização
            });
        });

        const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
        };

        await fetch('/api/location/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        });

        console.log('✅ Localização periódica atualizada em background');
    } catch (error) {
        console.error('❌ Erro ao atualizar localização periódica:', error);
    }
}