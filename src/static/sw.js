// Family Guardian 360° - Service Worker
const CACHE_NAME = 'family-guardian-v1.0';
const urlsToCache = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/pwa.js',
    '/static/js/websocket.js',
    '/static/images/icon-192x192.png',
    '/static/images/icon-512x512.png'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    console.log('🔧 Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('❌ Erro ao cachear:', err))
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    console.log('✅ Service Worker ativado');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Background Sync - Atualização periódica de localização
self.addEventListener('sync', event => {
    console.log('🔄 Background Sync disparado:', event.tag);

    if (event.tag === 'update-location') {
        event.waitUntil(updateLocationInBackground());
    }
});

// Sincronização periódica (a cada 5 minutos)
self.addEventListener('periodicsync', event => {
    console.log('⏰ Periodic Sync disparado:', event.tag);

    if (event.tag === 'update-location') {
        event.waitUntil(updateLocationInBackground());
    }
});

// Função para atualizar localização em background
async function updateLocationInBackground() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
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

        console.log('✅ Localização periódica atualizada em background');
    } catch (error) {
        console.error('❌ Erro ao atualizar localização em background:', error);
    }
}

// Push Notifications
self.addEventListener('push', event => {
    console.log('📬 Push notification recebida');

    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Family Guardian 360°';
    const options = {
        body: data.body || 'Nova notificação',
        icon: '/static/images/icon-192x192.png',
        badge: '/static/images/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
    console.log('🔔 Notificação clicada');
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('🚀 Service Worker carregado com sucesso');