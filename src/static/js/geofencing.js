// Sistema de Geofencing - Zonas Seguras
// Family Guardian 360°

let safeZones = [];
let geofenceCheckInterval;

// Inicializa sistema de geofencing
async function initGeofencing() {
    await loadSafeZones();
    startGeofenceMonitoring();
}

// Carrega zonas seguras do servidor
async function loadSafeZones() {
    try {
        const response = await fetch('/api/safe-zones');
        const data = await response.json();
        
        if (data.success) {
            safeZones = data.zones;
            renderSafeZonesOnMap();
        }
    } catch (error) {
        console.error('Erro ao carregar zonas seguras:', error);
    }
}

// Mostrar modal de adicionar zona
function showAddZoneModal() {
    const modal = document.getElementById('addZoneModal');
    if (!modal) {
        createAddZoneModal();
    }
    
    // Resetar formulário
    document.getElementById('addZoneForm').reset();
    document.getElementById('zoneRadius').value = '200';
    
    showModal('addZoneModal');
}

// Criar modal de adicionar zona
function createAddZoneModal() {
    const modalHTML = `
        <div id="addZoneModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal('addZoneModal')">&times;</span>
                <h2><i class="fas fa-shield-alt"></i> Adicionar Zona Segura</h2>
                <form id="addZoneForm">
                    <div class="form-group">
                        <label for="zoneName">
                            <i class="fas fa-tag"></i> Nome da Zona
                        </label>
                        <input type="text" id="zoneName" required placeholder="Ex: Casa, Escola, Trabalho">
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <i class="fas fa-map-marker-alt"></i> Localização
                        </label>
                        <button type="button" class="btn btn-info btn-block" onclick="useCurrentLocationForZone()" style="margin-bottom: 10px;">
                            <i class="fas fa-crosshairs"></i> Usar Localização Atual
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <label for="zoneLatitude">Latitude</label>
                        <input type="number" id="zoneLatitude" step="any" required placeholder="-19.9529905">
                    </div>
                    
                    <div class="form-group">
                        <label for="zoneLongitude">Longitude</label>
                        <input type="number" id="zoneLongitude" step="any" required placeholder="-44.0501976">
                    </div>
                    
                    <div class="form-group">
                        <label for="zoneRadius">Raio (metros)</label>
                        <input type="number" id="zoneRadius" required value="200" min="50" max="5000">
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="notifyOnEnter" checked>
                            <i class="fas fa-bell"></i> Notificar ao entrar na zona
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="notifyOnExit" checked>
                            <i class="fas fa-bell"></i> Notificar ao sair da zona
                        </label>
                    </div>
                    
                    <button type="submit" class="btn btn-success btn-block">
                        <i class="fas fa-check"></i> Salvar Zona
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Adicionar evento de submit
    document.getElementById('addZoneForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addSafeZone();
    });
}

// Usar localização atual para preencher campos de zona
async function useCurrentLocationForZone() {
    const location = await getCurrentPosition();
    if (location) {
        document.getElementById('zoneLatitude').value = location.latitude.toFixed(6);
        document.getElementById('zoneLongitude').value = location.longitude.toFixed(6);
        alert('✅ Localização atual obtida com sucesso!');
    } else {
        alert('❌ Não foi possível obter sua localização atual. Verifique as permissões do navegador.');
    }
}

// Adicionar zona segura
async function addSafeZone() {
    const formData = {
        zone_name: document.getElementById('zoneName').value,
        latitude: parseFloat(document.getElementById('zoneLatitude').value),
        longitude: parseFloat(document.getElementById('zoneLongitude').value),
        radius: parseInt(document.getElementById('zoneRadius').value),
        notify_on_enter: document.getElementById('notifyOnEnter').checked,
        notify_on_exit: document.getElementById('notifyOnExit').checked,
        is_active: true
    };
    
    try {
        const response = await fetch('/api/safe-zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Zona segura criada com sucesso!');
            closeModal('addZoneModal');
            await loadSafeZones();
            
            // Recarregar lista no dashboard se existir
            if (typeof loadDashboardSafeZones === 'function') {
                loadDashboardSafeZones();
            }
            
            return true;
        } else {
            alert('❌ ' + (data.message || 'Erro ao criar zona segura'));
            return false;
        }
    } catch (error) {
        console.error('Erro ao adicionar zona segura:', error);
        alert('❌ Erro ao adicionar zona segura');
        return false;
    }
}

// Remover zona segura
async function removeSafeZone(zoneId) {
    try {
        const response = await fetch(`/api/safe-zones/${zoneId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadSafeZones();
            return true;
        } else {
            alert('❌ ' + (data.message || 'Erro ao remover zona'));
            return false;
        }
    } catch (error) {
        console.error('Erro ao remover zona:', error);
        return false;
    }
}

// Renderiza zonas seguras no mapa
function renderSafeZonesOnMap() {
    if (!mainMap) return;
    
    // Remove círculos antigos
    mainMap.eachLayer(layer => {
        if (layer instanceof L.Circle) {
            mainMap.removeLayer(layer);
        }
    });
    
    // Adiciona novas zonas
    safeZones.forEach(zone => {
        if (zone.is_active) {
            const circle = L.circle([zone.latitude, zone.longitude], {
                color: '#4CAF50',
                fillColor: '#4CAF50',
                fillOpacity: 0.1,
                radius: zone.radius
            }).addTo(mainMap);
            
            circle.bindPopup(`
                <div class="zone-popup">
                    <h3>${zone.zone_name}</h3>
                    <p>Raio: ${zone.radius}m</p>
                    ${zone.notify_on_enter ? '<p>✅ Notifica ao entrar</p>' : ''}
                    ${zone.notify_on_exit ? '<p>✅ Notifica ao sair</p>' : ''}
                </div>
            `);
        }
    });
}

// Inicia monitoramento de geofencing
function startGeofenceMonitoring() {
    if (geofenceCheckInterval) {
        clearInterval(geofenceCheckInterval);
    }
    
    geofenceCheckInterval = setInterval(checkGeofences, 10000); // Verifica a cada 10 segundos
}

// Verifica se usuários entraram/saíram de zonas
async function checkGeofences() {
    const currentLocation = await getCurrentPosition({
        enableHighAccuracy: true,  // GPS de alta precisão
        timeout: 30000,
        maximumAge: 0
    });
    if (!currentLocation) return;
    
    safeZones.forEach(zone => {
        const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            zone.latitude,
            zone.longitude
        );
        
        const isInside = distance <= zone.radius;
        const wasInside = zone.userWasInside || false;
        
        // Entrou na zona
        if (isInside && !wasInside && zone.notify_on_enter) {
            notifyGeofenceEvent(zone, 'enter');
        }
        
        // Saiu da zona
        if (!isInside && wasInside && zone.notify_on_exit) {
            notifyGeofenceEvent(zone, 'exit');
        }
        
        zone.userWasInside = isInside;
    });
}

// Notifica evento de geofencing
async function notifyGeofenceEvent(zone, action) {
    try {
        await fetch('/api/geofence-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zone_id: zone.id,
                action: action
            })
        });
        
        // Notificação local
        const actionText = action === 'enter' ? 'entrou em' : 'saiu de';
        if (window.showNotification) {
            showNotification('Zona Segura', {
                body: `Você ${actionText} ${zone.zone_name}`,
                icon: '/static/images/icon-192x192.png'
            });
        }
    } catch (error) {
        console.error('Erro ao notificar evento de geofencing:', error);
    }
}

// Calcula distância entre dois pontos (fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

// Obtém posição atual
function getCurrentPosition() {
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }),
                error => resolve(null)
            );
        } else {
            resolve(null);
        }
    });
}

// Adiciona nova zona segura
async function addSafeZone(zoneName, latitude, longitude, radius, notifyEnter, notifyExit) {
    try {
        const response = await fetch('/api/safe-zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zone_name: zoneName,
                latitude: latitude,
                longitude: longitude,
                radius: radius,
                notify_on_enter: notifyEnter ? 1 : 0,
                notify_on_exit: notifyExit ? 1 : 0
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadSafeZones();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao adicionar zona segura:', error);
        return false;
    }
}

// Remove zona segura
async function removeSafeZone(zoneId) {
    try {
        const response = await fetch(`/api/safe-zones/${zoneId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadSafeZones();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao remover zona segura:', error);
        return false;
    }
}

// Modal para adicionar zona
function showAddZoneModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-map-marker-alt"></i> Adicionar Zona Segura</h2>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Nome da Zona</label>
                    <input type="text" id="zoneName" placeholder="Ex: Casa, Escola, Trabalho" class="form-control">
                </div>
                <div class="form-group">
                    <label>Latitude</label>
                    <input type="number" id="zoneLatitude" step="any" class="form-control">
                </div>
                <div class="form-group">
                    <label>Longitude</label>
                    <input type="number" id="zoneLongitude" step="any" class="form-control">
                </div>
                <div class="form-group">
                    <label>Raio (metros)</label>
                    <input type="number" id="zoneRadius" value="100" min="10" max="5000" class="form-control">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="notifyEnter" checked> Notificar ao entrar
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="notifyExit" checked> Notificar ao sair
                    </label>
                </div>
                <button class="btn-primary" onclick="saveNewZone()">
                    <i class="fas fa-save"></i> Salvar Zona
                </button>
                <button class="btn-secondary" onclick="useCurrentLocation()">
                    <i class="fas fa-crosshairs"></i> Usar Localização Atual
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Usa localização atual para zona
async function useCurrentLocation() {
    const location = await getCurrentPosition();
    if (location) {
        document.getElementById('zoneLatitude').value = location.latitude;
        document.getElementById('zoneLongitude').value = location.longitude;
    }
}

// Salva nova zona
async function saveNewZone() {
    const zoneName = document.getElementById('zoneName').value;
    const latitude = parseFloat(document.getElementById('zoneLatitude').value);
    const longitude = parseFloat(document.getElementById('zoneLongitude').value);
    const radius = parseInt(document.getElementById('zoneRadius').value);
    const notifyEnter = document.getElementById('notifyEnter').checked;
    const notifyExit = document.getElementById('notifyExit').checked;
    
    if (!zoneName || !latitude || !longitude) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    const success = await addSafeZone(zoneName, latitude, longitude, radius, notifyEnter, notifyExit);
    
    if (success) {
        document.querySelector('.modal-overlay').remove();
        alert('Zona segura adicionada com sucesso!');
    } else {
        alert('Erro ao adicionar zona segura');
    }
}

// Exporta funções
window.initGeofencing = initGeofencing;
window.showAddZoneModal = showAddZoneModal;
window.saveNewZone = saveNewZone;
window.useCurrentLocation = useCurrentLocation;
window.removeSafeZone = removeSafeZone;
