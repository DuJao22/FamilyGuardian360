// WebSocket para comunicação em tempo real
// Family Guardian 360° - Real-time updates

let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Inicializa conexão WebSocket
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/socket.io/`;
    
    socket = io({
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        timeout: 10000, // 10 segundos de timeout
        pingTimeout: 20000,
        pingInterval: 25000
    });

    // Conexão estabelecida
    socket.on('connect', () => {
        console.log('✅ WebSocket conectado');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log('⚠️ WebSocket desconectado');
        updateConnectionStatus(false);
    });

    // Erro de conexão
    socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log('Voltando para polling HTTP...');
        }
    });

    // Recebe atualização de localização
    socket.on('location_update', (data) => {
        console.log('📍 Nova localização recebida:', data);
        if (typeof updateMemberLocation === 'function') {
            updateMemberLocation(data);
        }
    });

    // Recebe nova mensagem
    socket.on('new_message', (data) => {
        console.log('💬 Nova mensagem recebida:', data);
        if (typeof handleNewMessage === 'function') {
            handleNewMessage(data);
        }
        
        // Mostra notificação
        if (window.showNotification) {
            showNotification('Nova Mensagem', {
                body: `${data.sender_name}: ${data.message_text}`,
                icon: '/static/images/icon-192x192.png'
            });
        }
    });

    // Recebe alerta de emergência
    socket.on('panic_alert', (data) => {
        console.log('🚨 ALERTA DE PÂNICO:', data);
        if (typeof handlePanicAlert === 'function') {
            handlePanicAlert(data);
        }
        
        // Notificação de emergência
        if (window.showNotification) {
            showNotification('🚨 EMERGÊNCIA!', {
                body: `${data.user_name} acionou o botão de pânico!`,
                icon: '/static/images/icon-192x192.png',
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200, 100, 200]
            });
        }
        
        // Toca som de alerta
        playAlertSound();
    });

    // Recebe alerta de bateria baixa
    socket.on('battery_alert', (data) => {
        console.log('🔋 Alerta de bateria baixa:', data);
        
        if (window.showNotification) {
            showNotification('Bateria Baixa', {
                body: `${data.user_name} está com ${data.battery_level}% de bateria`,
                icon: '/static/images/icon-192x192.png'
            });
        }
    });

    // Recebe alerta de zona segura
    socket.on('geofence_alert', (data) => {
        console.log('🏠 Alerta de zona segura:', data);
        
        if (window.showNotification) {
            const action = data.action === 'enter' ? 'entrou em' : 'saiu de';
            showNotification('Zona Segura', {
                body: `${data.user_name} ${action} ${data.zone_name}`,
                icon: '/static/images/icon-192x192.png'
            });
        }
    });

    // Membro online/offline
    socket.on('member_status', (data) => {
        console.log('👤 Status do membro:', data);
        if (typeof updateMemberStatus === 'function') {
            updateMemberStatus(data);
        }
    });
}

// Emite localização via WebSocket
function emitLocation(locationData) {
    if (socket && socket.connected) {
        socket.emit('update_location', locationData);
    }
}

// Emite mensagem via WebSocket
function emitMessage(messageData) {
    if (socket && socket.connected) {
        socket.emit('send_message', messageData);
    }
}

// Emite alerta de pânico via WebSocket
function emitPanicAlert(alertData) {
    if (socket && socket.connected) {
        socket.emit('panic_alert', alertData);
    }
}

// Atualiza indicador de status de conexão
function updateConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('connectionStatus');
    if (statusIndicator) {
        if (isConnected) {
            statusIndicator.className = 'connection-status online';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Online';
        } else {
            statusIndicator.className = 'connection-status offline';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Offline';
        }
    }
}

// Toca som de alerta
function playAlertSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuAzPDaijgIGGS57OihUQ0OTqXh8bllHAU2jdXxx3QpBSh+zPHajz0LFFu16OyrWBELTKPg8b1hHAU0itPvxHAlBSV8y+/Zj0AKE1mz6OmpWhIMTqbj8rx1JQUpftH');
    audio.play().catch(e => console.log('Não foi possível reproduzir som de alerta'));
}

// Inicializa WebSocket quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebSocket);
} else {
    initWebSocket();
}
