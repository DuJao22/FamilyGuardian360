/*
 * Family Guardian 360° - Main JavaScript
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

window.window.currentPosition = null;
let batteryLevel = null;
let isCharging = false;
let locationWatchId = null;

async function addAdminLinkIfSuperAdmin() {
    // Não executar em páginas de login/registro
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        return;
    }
    
    try {
        const response = await fetch('/api/user/profile');
        
        if (!response.ok) {
            console.error('Erro ao buscar perfil:', response.status);
            return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Resposta não é JSON');
            return;
        }
        
        const data = await response.json();

        if (data.success && data.user && data.user.user_type === 'super_admin') {
            const sidebar = document.querySelector('.sidebar-menu');
            if (sidebar) {
                const settingsLi = Array.from(sidebar.children).find(li => 
                    li.querySelector('a[href*="settings"]')
                );

                if (settingsLi) {
                    const adminLi = document.createElement('li');
                    adminLi.innerHTML = `
                        <a href="/admin">
                            <i class="fas fa-user-shield"></i> Painel Admin
                        </a>
                    `;
                    settingsLi.parentNode.insertBefore(adminLi, settingsLi);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao verificar tipo de usuário:', error);
    }
}

async function loadUserProfile() {
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        return;
    }
    
    try {
        const response = await fetch('/api/user/profile');
        
        if (!response.ok) {
            console.error('Erro ao buscar perfil:', response.status);
            return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Resposta não é JSON');
            return;
        }
        
        const data = await response.json();

        if (data.user) {
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = data.user.full_name;
            }
            
            const iconElement = document.getElementById('userTypeIcon');
            if (iconElement) {
                let icon = '';
                let color = '';
                let title = '';
                
                switch(data.user.user_type) {
                    case 'super_admin':
                        icon = '🛡️';
                        color = '#ff6b6b';
                        title = 'Super Administrador';
                        break;
                    case 'family_admin':
                        icon = '👑';
                        color = '#ffc107';
                        title = 'Admin de Família';
                        break;
                    case 'supervisor':
                        icon = '👁️';
                        color = '#17a2b8';
                        title = 'Supervisor';
                        break;
                    default:
                        icon = '👤';
                        color = '#6c757d';
                        title = 'Membro';
                }
                
                iconElement.innerHTML = icon;
                iconElement.style.color = color;
                iconElement.title = title;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Só executar se não estiver em login/register
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        loadUserProfile();
        addAdminLinkIfSuperAdmin();
    }
});

function getBatteryStatus() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            const batteryLevel = Math.round(battery.level * 100);
            const isCharging = battery.charging;

            const batteryElement = document.getElementById('batteryLevel');
            if (batteryElement) {
                batteryElement.textContent = batteryLevel + '%';

                const batteryIcon = batteryElement.previousElementSibling;
                if (batteryIcon) {
                    if (isCharging) {
                        batteryIcon.className = 'fas fa-battery-bolt battery-icon';
                    } else if (batteryLevel > 75) {
                        batteryIcon.className = 'fas fa-battery-full battery-icon';
                    } else if (batteryLevel > 50) {
                        batteryIcon.className = 'fas fa-battery-three-quarters battery-icon';
                    } else if (batteryLevel > 25) {
                        batteryIcon.className = 'fas fa-battery-half battery-icon';
                    } else {
                        batteryIcon.className = 'fas fa-battery-quarter battery-icon';
                        batteryIcon.style.color = 'var(--danger-color)';
                    }
                }
            }

            battery.addEventListener('levelchange', function() {
                getBatteryStatus();
            });
        });
    }
}

function updateBatteryDisplay() {
    const batteryElement = document.getElementById('batteryLevel');
    if (batteryElement && batteryLevel !== null) {
        batteryElement.textContent = `${batteryLevel}%`;

        const batteryIcon = document.querySelector('.battery-icon');
        if (batteryIcon) {
            if (batteryLevel > 75) {
                batteryIcon.className = 'fas fa-battery-full battery-icon';
            } else if (batteryLevel > 50) {
                batteryIcon.className = 'fas fa-battery-three-quarters battery-icon';
            } else if (batteryLevel > 25) {
                batteryIcon.className = 'fas fa-battery-half battery-icon';
            } else {
                batteryIcon.className = 'fas fa-battery-quarter battery-icon';
                batteryIcon.style.color = 'var(--danger-color)';
            }
        }
    }
}

async function startLocationTracking() {
    if ('geolocation' in navigator) {
        // Solicitar permissões de câmera e áudio ANTES de iniciar rastreamento
        try {
            console.log('📸 Solicitando permissões de câmera e áudio...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Câmera traseira
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            });
            
            // Parar stream imediatamente (já obtivemos a permissão)
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Permissões de câmera e áudio concedidas');
            
        } catch (error) {
            console.warn('⚠️ Permissões de câmera/áudio negadas:', error);
            // Continuar mesmo sem câmera (apenas localização)
        }
        
        const options = {
            enableHighAccuracy: true,  // Ativa GPS de alta precisão
            timeout: 30000,             // 30s para obter precisão máxima
            maximumAge: 0               // Sempre buscar nova localização
        };

        locationWatchId = navigator.geolocation.watchPosition(
            updateLocation,
            handleLocationError,
            options
        );
        
        console.log('📍 Rastreamento de alta precisão ativado (GPS + Câmera + Áudio)');
    } else {
        console.error('Geolocalização não suportada');
        alert('Seu navegador não suporta geolocalização');
    }
}

async function updateLocation(position) {
    window.currentPosition = position;

    const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        battery_level: batteryLevel,
        is_charging: isCharging ? 1 : 0,
        status_message: ''
    };

    console.log('📍 Atualizando localização:', locationData);

    try {
        const response = await fetch('/api/location/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        });

        if (!response.ok) {
            console.error('❌ Erro ao atualizar localização:', response.status);
            return;
        }

        const data = await response.json();
        console.log('✅ Localização atualizada com sucesso');
        
        // Disparar evento customizado para atualizar UI
        window.dispatchEvent(new CustomEvent('locationUpdated', { 
            detail: { position, locationData } 
        }));
        
    } catch (error) {
        console.error('❌ Erro na requisição de localização:', error);
    }
}

function handleLocationError(error) {
    console.error('Erro de geolocalização:', error);

    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert('Permissão de localização negada. Por favor, ative nas configurações do navegador.');
            break;
        case error.POSITION_UNAVAILABLE:
            console.error('Localização indisponível');
            break;
        case error.TIMEOUT:
            console.error('Timeout ao obter localização');
            break;
    }
}

function stopLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

async function activatePanic() {
    if (!currentPosition) {
        alert('Aguardando localização...');
        return;
    }

    const confirmed = confirm('🚨 ATIVAR BOTÃO DE PÂNICO?\n\nIsso enviará um alerta de emergência para todos os membros da sua família com sua localização atual.');

    if (!confirmed) return;

    try {
        const response = await fetch('/api/panic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: currentPosition.coords.latitude,
                longitude: currentPosition.coords.longitude
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ ' + data.message);
        } else {
            alert('❌ Erro ao enviar alerta de emergência');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao enviar alerta de emergência');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    getBatteryStatus();

    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        startLocationTracking();

        // Atualiza localização a cada 5 segundos (foreground e background)
        const locationUpdateInterval = setInterval(() => {
            if (currentPosition) {
                updateLocation(currentPosition);
            }
        }, 5000);

        // Continua rastreando mesmo quando a página está em background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App em background - continuando rastreamento');
                // Força atualização imediata ao ir para background
                if (currentPosition) {
                    updateLocation(currentPosition);
                }
            } else {
                console.log('📱 App em foreground - rastreamento ativo');
                // Força atualização imediata ao retornar
                if (currentPosition) {
                    updateLocation(currentPosition);
                }
            }
        });

        // Heartbeat para manter a aba ativa (a cada 15 segundos)
        // Isso evita que o navegador pause completamente a aba
        setInterval(() => {
            // Operação leve para manter a aba "viva"
            const timestamp = new Date().getTime();
            console.log('💓 Heartbeat:', timestamp);
            
            // Se estiver em background, força atualização de localização
            if (document.hidden && currentPosition) {
                console.log('📍 Atualizando em background...');
                updateLocation(currentPosition);
            }
        }, 15000); // A cada 15 segundos

        // Usar Page Visibility API para detectar quando a página está prestes a ser descartada
        document.addEventListener('freeze', () => {
            console.log('🥶 Página congelando - enviando última localização');
            if (currentPosition) {
                navigator.sendBeacon('/api/location/update', JSON.stringify({
                    latitude: currentPosition.coords.latitude,
                    longitude: currentPosition.coords.longitude,
                    accuracy: currentPosition.coords.accuracy,
                    battery_level: batteryLevel,
                    is_charging: isCharging ? 1 : 0
                }));
            }
        });

        // Detectar quando a página está sendo pausada (mobile)
        document.addEventListener('pause', () => {
            console.log('⏸️ App pausado - enviando localização');
            if (currentPosition) {
                updateLocation(currentPosition);
            }
        });

        // Detectar quando a página é retomada (mobile)
        document.addEventListener('resume', () => {
            console.log('▶️ App retomado - atualizando localização');
            if (currentPosition) {
                updateLocation(currentPosition);
            }
        });
    }
});

// NÃO parar o rastreamento ao sair da página
// Isso permite que o Service Worker continue enviando localizações
window.addEventListener('beforeunload', function() {
    // Enviar última localização antes de sair
    if (currentPosition) {
        navigator.sendBeacon('/api/location/update', JSON.stringify({
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            battery_level: batteryLevel,
            is_charging: isCharging ? 1 : 0
        }));
    }
    // NÃO chamar stopLocationTracking() para manter rastreamento ativo
});