/*
 * Family Guardian 360° - Map JavaScript
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

let mainMap = null;
let markers = {};
let isMobile = window.innerWidth <= 768;
let allFamilyMembers = [];
let selectedUserId = null;

// Cache para endereços já buscados (evita rate limiting)
let addressCache = {};
const CACHE_PRECISION = 3; // Arredondar coordenadas para 3 casas decimais (~111m de precisão)

// Função para criar chave de cache baseada em coordenadas arredondadas
function getCacheKey(lat, lon) {
    const roundedLat = parseFloat(lat.toFixed(CACHE_PRECISION));
    const roundedLon = parseFloat(lon.toFixed(CACHE_PRECISION));
    return `${roundedLat},${roundedLon}`;
}

// Função para obter endereço a partir de coordenadas (com cache)
async function getAddressFromCoords(lat, lon) {
    const cacheKey = getCacheKey(lat, lon);
    
    // Verificar se já temos o endereço em cache
    if (addressCache[cacheKey]) {
        console.log('📍 Usando endereço em cache para:', cacheKey);
        return addressCache[cacheKey];
    }
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
        
        // Verificar rate limiting - NÃO cachear para permitir retry depois
        if (response.status === 429 || response.status === 403) {
            console.warn('⚠️ Rate limit atingido na API Nominatim - tentaremos novamente mais tarde');
            return 'Endereço temporariamente indisponível';
        }
        
        if (!response.ok) {
            console.error('❌ Erro ao buscar endereço:', response.status);
            return 'Coordenadas: ' + lat.toFixed(5) + ', ' + lon.toFixed(5);
        }
        
        const data = await response.json();

        if (data && data.address) {
            const address = data.address;
            const street = address.road || address.street || '';
            const number = address.house_number || '';
            const neighborhood = address.suburb || address.neighbourhood || '';
            const city = address.city || address.town || address.village || '';
            const state = address.state || '';

            let fullAddress = '';
            if (street) fullAddress += street;
            if (number) fullAddress += `, ${number}`;
            if (neighborhood) fullAddress += ` - ${neighborhood}`;
            if (city) fullAddress += `, ${city}`;
            if (state) fullAddress += ` - ${state}`;

            const finalAddress = fullAddress || 'Endereço não disponível';
            
            // Armazenar no cache
            addressCache[cacheKey] = finalAddress;
            console.log('✅ Endereço armazenado em cache:', cacheKey);
            
            return finalAddress;
        }
        
        const fallback = 'Endereço não disponível';
        addressCache[cacheKey] = fallback;
        return fallback;
    } catch (error) {
        console.error('❌ Erro ao obter endereço:', error);
        const fallback = 'Coordenadas: ' + lat.toFixed(5) + ', ' + lon.toFixed(5);
        return fallback;
    }
}

// Variáveis para seleção de zona
let isSelectingZone = false;
let tempZoneCircle = null;
let tempZoneMarker = null;
let selectedZoneLocation = null;

function initMainMap() {
    mainMap = L.map('mainMap', {
        zoomControl: !isMobile
    }).setView([0, 0], 13);

    // Adicionar controle de zoom à direita em mobile
    if (isMobile) {
        L.control.zoom({
            position: 'topright'
        }).addTo(mainMap);
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mainMap);

    // Adicionar evento de clique no mapa para selecionar zona
    mainMap.on('click', function(e) {
        if (isSelectingZone) {
            selectZoneLocation(e.latlng);
        }
    });

    // Ajustar mapa ao redimensionar
    setTimeout(() => mainMap.invalidateSize(), 100);

    refreshLocations();
    
    // Verificar se está no modo de seleção
    if (localStorage.getItem('selectingZone') === 'true') {
        activateZoneSelection();
    }
}

function activateZoneSelection() {
    isSelectingZone = true;
    localStorage.removeItem('selectingZone');
    
    // Alterar cursor do mapa
    document.getElementById('mainMap').style.cursor = 'crosshair';
    
    // Mostrar mensagem
    alert('📍 Clique no mapa para selecionar o centro da zona segura');
}

function selectZoneLocation(latlng) {
    selectedZoneLocation = latlng;
    
    // Remover círculo/marcador temporário anterior
    if (tempZoneCircle) {
        mainMap.removeLayer(tempZoneCircle);
    }
    if (tempZoneMarker) {
        mainMap.removeLayer(tempZoneMarker);
    }
    
    // Adicionar marcador temporário
    tempZoneMarker = L.marker([latlng.lat, latlng.lng], {
        icon: L.divIcon({
            html: '<i class="fas fa-map-marker-alt" style="font-size: 32px; color: #10b981;"></i>',
            className: 'custom-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        })
    }).addTo(mainMap);
    
    // Adicionar círculo temporário (200m de raio padrão)
    tempZoneCircle = L.circle([latlng.lat, latlng.lng], {
        radius: 200,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.2
    }).addTo(mainMap);
    
    // Desativar modo de seleção
    isSelectingZone = false;
    document.getElementById('mainMap').style.cursor = '';
    
    // Mostrar modal com os dados preenchidos
    showAddZoneModalWithLocation(latlng.lat, latlng.lng);
}

function showAddZoneModalWithLocation(lat, lon) {
    const modal = document.getElementById('addZoneModal');
    if (modal) {
        document.getElementById('zoneLatitude').value = lat.toFixed(6);
        document.getElementById('zoneLongitude').value = lon.toFixed(6);
        document.getElementById('zoneRadius').value = '200';
        modal.style.display = 'block';
    }
}

// Toggle seletor de usuários
function toggleUserSelector() {
    const content = document.getElementById('userSelectorContent');
    const icon = document.getElementById('selectorToggleIcon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-up';
    } else {
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
    }
}

// Toggle legenda
function toggleLegend() {
    const content = document.getElementById('legendContent');
    const icon = document.getElementById('legendToggleIcon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-down';
    } else {
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-up';
    }
}

// Focar em usuário específico
function focusOnUser(userId, userName, lat, lon) {
    selectedUserId = userId;

    // Atualizar chips visuais
    document.querySelectorAll('.user-chip').forEach(chip => {
        chip.classList.remove('active');
    });

    const activeChip = document.querySelector(`.user-chip[data-user-id="${userId}"]`);
    if (activeChip) {
        activeChip.classList.add('active');
    }

    // Centralizar no mapa
    mainMap.setView([lat, lon], 16);

    // Abrir popup do marcador
    if (markers[userId]) {
        markers[userId].openPopup();
    }
}

// Mostrar todos os membros
function showAllMembers() {
    selectedUserId = null;

    // Remover seleção
    document.querySelectorAll('.user-chip').forEach(chip => {
        chip.classList.remove('active');
    });

    // Ajustar bounds para mostrar todos
    if (Object.keys(markers).length > 0) {
        const group = L.featureGroup(Object.values(markers));
        mainMap.fitBounds(group.getBounds().pad(0.1));
    }
}

async function refreshLocations() {
    console.log('🔄 Atualizando localizações da família...');
    try {
        const response = await fetch('/api/location/family');

        if (!response.ok) {
            console.error('❌ Erro ao buscar localizações:', response.status);
            // Mostrar mensagem de erro para o usuário
            const membersList = document.getElementById('membersList');
            if (membersList && response.status === 401) {
                membersList.innerHTML = '<p class="text-danger">Sessão expirada. Por favor, faça login novamente.</p>';
            }
            return;
        }

        const data = await response.json();
        console.log('📍 Localizações recebidas:', data);

        // Limpar marcadores antigos
        Object.keys(markers).forEach(key => {
            mainMap.removeLayer(markers[key]);
        });
        markers = {};
        allFamilyMembers = [];

        // Chip para "Você"
        let userChipsHTML = '';

        if (data.own_location) {
            const lat = data.own_location.latitude;
            const lon = data.own_location.longitude;

            if (!selectedUserId) {
                mainMap.setView([lat, lon], 13);
            }

            const myIcon = L.divIcon({
                html: '<div class="custom-marker-icon"><i class="fas fa-user-circle" style="font-size: 32px; color: #3b82f6;"></i></div>',
                className: 'custom-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });

            // Criar marcador com popup inicial
            const myMarker = L.marker([lat, lon], { icon: myIcon })
                .addTo(mainMap)
                .bindPopup('<strong>Você</strong><br><small>📍 Carregando endereço...</small>');
            
            markers['me'] = myMarker;

            // Buscar endereço de forma assíncrona e atualizar popup
            getAddressFromCoords(lat, lon).then(address => {
                myMarker.setPopupContent(`
                    <strong>Você</strong>
                    <br><small style="color: #666;">📍 ${address}</small>
                    <br><small style="color: #888;">Coord: ${lat.toFixed(5)}, ${lon.toFixed(5)}</small>
                `);
            });

            userChipsHTML += `
                <div class="user-chip ${selectedUserId === 'me' ? 'active' : ''}" 
                     data-user-id="me" 
                     onclick="focusOnUser('me', 'Você', ${lat}, ${lon})">
                    <div class="chip-avatar" style="background: #3b82f6;">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="chip-info">
                        <span class="chip-name">Você</span>
                        <span class="chip-status">Online</span>
                    </div>
                </div>
            `;

            allFamilyMembers.push({ id: 'me', name: 'Você', lat, lon });
        }

        const membersList = document.getElementById('membersList');
        let membersHTML = '';

        if (data.family_locations && data.family_locations.length > 0) {
            data.family_locations.forEach(member => {
                const lat = member.location.latitude;
                const lon = member.location.longitude;
                const userId = member.user.id;
                const userName = member.user.full_name;
                const batteryLevel = member.location.battery_level || 0;

                allFamilyMembers.push({ id: userId, name: userName, lat, lon });

                // Cor do marcador baseada em bateria
                let markerColor = '#10b981'; // Verde
                if (batteryLevel < 20) markerColor = '#ef4444'; // Vermelho
                else if (batteryLevel < 50) markerColor = '#f59e0b'; // Amarelo

                const memberIcon = L.divIcon({
                    html: `<div class="custom-marker-icon"><i class="fas fa-map-marker-alt" style="font-size: 32px; color: ${markerColor};"></i></div>`,
                    className: 'custom-marker',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                });

                const batteryIcon = batteryLevel > 75 ? 'fa-battery-full' : 
                                   batteryLevel > 50 ? 'fa-battery-three-quarters' :
                                   batteryLevel > 25 ? 'fa-battery-half' : 'fa-battery-quarter';

                const batteryInfo = member.location.battery_level ? 
                    `<br><i class="fas ${batteryIcon}"></i> ${member.location.battery_level}%` : '';

                // Criar marcador com popup inicial
                const memberMarker = L.marker([lat, lon], { icon: memberIcon })
                    .addTo(mainMap)
                    .bindPopup(`<strong>${userName}</strong>${batteryInfo}<br><small>📍 Carregando endereço...</small>`);
                
                markers[userId] = memberMarker;

                // Buscar endereço de forma assíncrona e atualizar popup
                getAddressFromCoords(lat, lon).then(address => {
                    memberMarker.setPopupContent(`
                        <strong>${userName}</strong>
                        ${batteryInfo}
                        <br><small style="color: #666;">📍 ${address}</small>
                        <br><small style="color: #888;">Coord: ${lat.toFixed(5)}, ${lon.toFixed(5)}</small>
                    `);
                });

                // Chip para seletor
                userChipsHTML += `
                    <div class="user-chip ${selectedUserId === userId ? 'active' : ''}" 
                         data-user-id="${userId}" 
                         onclick="focusOnUser('${userId}', '${userName}', ${lat}, ${lon})">
                        <div class="chip-avatar" style="background: ${markerColor};">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="chip-info">
                            <span class="chip-name">${userName}</span>
                            <span class="chip-status">
                                <i class="fas ${batteryIcon}"></i> ${batteryLevel}%
                            </span>
                        </div>
                    </div>
                `;

                // Lista lateral
                const timeAgo = getTimeAgo(new Date(member.location.timestamp));
                membersHTML += `
                    <div class="member-item" onclick="focusOnUser('${userId}', '${userName}', ${lat}, ${lon})">
                        <div class="member-avatar" style="background: ${markerColor};">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="member-info">
                            <p class="member-name">${userName}</p>
                            <small class="member-time">
                                <i class="fas fa-clock"></i> ${timeAgo}
                            </small>
                            <small class="member-battery">
                                <i class="fas ${batteryIcon}"></i> ${batteryLevel}%
                            </small>
                        </div>
                    </div>
                `;
            });
        } else {
            membersHTML = '<p class="text-muted">Nenhum membro com localização compartilhada</p>';
        }

        // Atualizar chips e lista
        document.getElementById('userChips').innerHTML = userChipsHTML;
        membersList.innerHTML = membersHTML;

        console.log('✅ Mapa atualizado com sucesso');

    } catch (error) {
        console.error('❌ Erro ao carregar localizações:', error);
    }
}

// Helper: Tempo relativo
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
}

function focusOnMember(lat, lon) {
    mainMap.setView([lat, lon], 16);
}

function centerOnMe() {
    if (currentPosition) {
        const lat = currentPosition.coords.latitude;
        const lon = currentPosition.coords.longitude;
        mainMap.setView([lat, lon], 16);
    }
}

// loadUserProfile() agora está em app.js (carregado globalmente)

document.addEventListener('DOMContentLoaded', function() {
    initMainMap();

    // Verificar se há localização para focar (vindo do dashboard)
    const focusLocation = localStorage.getItem('focusLocation');
    if (focusLocation) {
        try {
            const { lat, lon, name } = JSON.parse(focusLocation);
            mainMap.setView([lat, lon], 16);

            const focusIcon = L.divIcon({
                html: '<i class="fas fa-map-marker-alt" style="font-size: 40px; color: #ef4444;"></i>',
                className: 'custom-marker',
                iconSize: [40, 40]
            });

            const focusMarker = L.marker([lat, lon], { icon: focusIcon })
                .addTo(mainMap)
                .bindPopup(`<strong>${name}</strong><br>Localização Atual<br><small>📍 Carregando endereço...</small>`)
                .openPopup();

            // Buscar endereço de forma assíncrona e atualizar popup
            getAddressFromCoords(lat, lon).then(address => {
                focusMarker.setPopupContent(`
                    <strong>${name}</strong>
                    <br>Localização Atual
                    <br><small style="color: #666;">📍 ${address}</small>
                    <br><small style="color: #888;">Coord: ${lat.toFixed(5)}, ${lon.toFixed(5)}</small>
                `);
                focusMarker.openPopup();
            });

            // Limpar após usar
            localStorage.removeItem('focusLocation');
        } catch (error) {
            console.error('Erro ao focar na localização:', error);
        }
    }

    setInterval(refreshLocations, 3000);
});