// PWA - Progressive Web App
// Registro do Service Worker e Notificações Push

let deferredPrompt;
let swRegistration;

// Registra o Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async function() {
        try {
            const registration = await navigator.serviceWorker.register('/static/sw.js');
            console.log('✅ Service Worker registrado:', registration);

            // Registra sincronização periódica de localização (a cada 5 minutos)
            if ('periodicSync' in registration) {
                const status = await navigator.permissions.query({
                    name: 'periodic-background-sync'
                });

                if (status.state === 'granted') {
                    await registration.periodicSync.register('update-location', {
                        minInterval: 5 * 60 * 1000 // 5 minutos
                    });
                    console.log('✅ Sincronização periódica de localização ativada');
                }
            }

            // Background Sync para envios offline
            if ('sync' in registration) {
                console.log('✅ Background Sync disponível');
            }
        } catch (error) {
            console.log('❌ Falha ao registrar Service Worker:', error);
        }
    });
}

// Mantém a aba ativa mesmo em background usando Wake Lock API
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake Lock ativado - tela permanecerá ativa');

            wakeLock.addEventListener('release', () => {
                console.log('🔓 Wake Lock liberado');
            });
        }
    } catch (err) {
        console.log('Wake Lock não disponível:', err);
    }
}

// Reativa Wake Lock quando a página se torna visível novamente
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// Ativa Wake Lock quando o usuário permite
if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    requestWakeLock();
}


// Solicita permissão para notificações
function requestNotificationPermission() {
    if ('Notification' in window && navigator.serviceWorker) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('✅ Permissão de notificação concedida');
            }
        });
    }
}

// Mostra notificação local
function showNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const defaultOptions = {
            icon: '/static/images/icon-192x192.png',
            badge: '/static/images/icon-72x72.png',
            vibrate: [200, 100, 200],
            tag: 'family-guardian',
            requireInteraction: false,
            ...options
        };

        if (swRegistration) {
            swRegistration.showNotification(title, defaultOptions);
        } else {
            new Notification(title, defaultOptions);
        }
    }
}

// Evento de instalação do PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostra botão de instalação (se houver)
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', installPWA);
    }
});

// Instala o PWA
function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ PWA instalado');
            }
            deferredPrompt = null;
        });
    }
}

// Detecta quando o app foi instalado
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA instalado com sucesso!');
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'none';
    }
});

// Exporta funções para uso global
window.showNotification = showNotification;
window.requestNotificationPermission = requestNotificationPermission;