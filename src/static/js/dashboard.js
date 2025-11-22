/*
 * Family Guardian 360° - Dashboard JavaScript
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

let miniMap = null;
let userMarker = null;

// Modal functions (available globally)
window.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
};

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

async function loadUserProfile() {
    try {
        const response = await fetch('/api/user/profile');
        const data = await response.json();

        if (data.user) {
            document.getElementById('userName').textContent = data.user.full_name;
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

async function loadFamilies() {
    try {
        const response = await fetch('/api/families');
        const data = await response.json();

        const familyList = document.getElementById('familyList');

        if (data.families && data.families.length > 0) {
            familyList.innerHTML = data.families.map(family => `
                <div class="family-item" style="padding: 15px; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0 0 5px 0;">${family.name}</h4>
                            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                                ${family.member_count} membro(s) ${family.role === 'admin' ? '• <span style="color: var(--success-color);">Admin</span>' : ''}
                            </p>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-sm btn-primary" onclick="viewFamily(${family.id})">
                                Ver <i class="fas fa-arrow-right"></i>
                            </button>
                            ${family.role === 'admin' ? `
                                <button class="btn btn-sm btn-info" onclick="viewFamilyMembers(${family.id}, '${family.name}')" title="Ver Membros">
                                    <i class="fas fa-users"></i>
                                </button>
                                <button class="btn btn-sm btn-success" onclick="manageFamilyMembers(${family.id}, '${family.name}')" title="Gerenciar Membros">
                                    <i class="fas fa-user-plus"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="managePermissions(${family.id}, '${family.name}')" title="Gerenciar Permissões">
                                    <i class="fas fa-key"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            familyList.innerHTML = '<p class="text-muted">Nenhuma família cadastrada. Crie sua primeira família!</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar famílias:', error);
    }
}

async function viewFamilyMembers(familyId, familyName) {
    try {
        const response = await fetch(`/api/families/${familyId}/members`);
        const data = await response.json();

        if (!response.ok) {
            alert(data.message || 'Erro ao carregar membros');
            return;
        }

        const modal = document.getElementById('viewMembersModal');
        if (!modal) {
            createViewMembersModal();
        }

        document.getElementById('viewMembersTitle').textContent = `Membros da ${familyName}`;

        const container = document.getElementById('viewMembersContainer');

        if (data.members && data.members.length > 0) {
            // Buscar localizações de todos os membros
            const locationPromises = data.members.map(async (member) => {
                try {
                    const locResponse = await fetch(`/api/location/user/${member.id}`);
                    const locData = await locResponse.json();
                    return { userId: member.id, location: locData.location };
                } catch (error) {
                    return { userId: member.id, location: null };
                }
            });

            const locations = await Promise.all(locationPromises);
            const locationMap = {};
            locations.forEach(loc => {
                locationMap[loc.userId] = loc.location;
            });

            container.innerHTML = data.members.map(member => {
                let roleLabel = 'Membro';
                let roleColor = '#6366f1';
                let roleIcon = 'fa-user';

                if (member.role === 'admin') {
                    roleLabel = 'Admin';
                    roleColor = '#10b981';
                    roleIcon = 'fa-user-shield';
                } else if (member.role === 'supervisor') {
                    roleLabel = 'Supervisor';
                    roleColor = '#f59e0b';
                    roleIcon = 'fa-user-tie';
                }

                const joinDate = new Date(member.joined_at).toLocaleDateString('pt-BR');
                const location = locationMap[member.id];

                let locationHtml = '';
                if (location) {
                    // Horário já vem do servidor em timezone de Brasília
                    const lastUpdate = new Date(location.timestamp).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo'
                    });
                    const batteryIcon = location.battery_level > 75 ? 'fa-battery-full' :
                                       location.battery_level > 50 ? 'fa-battery-three-quarters' :
                                       location.battery_level > 25 ? 'fa-battery-half' : 'fa-battery-quarter';
                    const batteryColor = location.battery_level > 50 ? '#10b981' :
                                        location.battery_level > 25 ? '#f59e0b' : '#ef4444';

                    locationHtml = `
                        <div style="margin-top: 12px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid ${roleColor};">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">
                                <i class="fas fa-map-marker-alt" style="color: ${roleColor};"></i> Localização em Tempo Real
                            </p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                                <div>
                                    <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                                    <strong>Lat:</strong> ${location.latitude.toFixed(6)}
                                </div>
                                <div>
                                    <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                                    <strong>Lon:</strong> ${location.longitude.toFixed(6)}
                                </div>
                                <div>
                                    <i class="fas fa-crosshairs" style="color: #8b5cf6; width: 16px;"></i>
                                    <strong>Precisão:</strong> ${location.accuracy ? Math.round(location.accuracy) + 'm' : 'N/A'}
                                </div>
                                <div>
                                    <i class="fas ${batteryIcon}" style="color: ${batteryColor}; width: 16px;"></i>
                                    <strong>Bateria:</strong> ${location.battery_level ? location.battery_level + '%' : 'N/A'}
                                </div>
                            </div>
                            <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                                <i class="fas fa-clock" style="width: 16px;"></i>
                                Última atualização: ${lastUpdate}
                            </p>
                            <button onclick="showMemberOnMap(${location.latitude}, ${location.longitude}, '${member.full_name}')"
                                    class="btn btn-sm btn-primary" style="margin-top: 8px; width: 100%;">
                                <i class="fas fa-map-marked-alt"></i> Ver no Mapa
                            </button>
                        </div>
                    `;
                } else {
                    locationHtml = `
                        <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;">
                            <p style="margin: 0; font-size: 13px; color: #92400e;">
                                <i class="fas fa-exclamation-triangle"></i> Localização não disponível
                            </p>
                        </div>
                    `;
                }

                return `
                    <div class="member-card" id="member-card-${member.id}" style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: start; gap: 15px;">
                            <div style="flex-shrink: 0;">
                                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, ${roleColor}33, ${roleColor}11); display: flex; align-items: center; justify-content: center;">
                                    <i class="fas ${roleIcon}" style="font-size: 28px; color: ${roleColor};"></i>
                                </div>
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <h4 style="margin: 0; font-size: 18px; color: #1f2937;">${member.full_name}</h4>
                                    <span style="display: inline-block; padding: 4px 12px; background: ${roleColor}; color: white; border-radius: 16px; font-size: 12px; font-weight: 600;">
                                        <i class="fas ${roleIcon}"></i> ${roleLabel}
                                    </span>
                                </div>
                                <div style="display: grid; gap: 6px; color: #6b7280; font-size: 14px;">
                                    <p style="margin: 0;">
                                        <i class="fas fa-envelope" style="width: 16px; color: ${roleColor};"></i>
                                        <strong>Email:</strong> ${member.email}
                                    </p>
                                    <p style="margin: 0;">
                                        <i class="fas fa-user-circle" style="width: 16px; color: ${roleColor};"></i>
                                        <strong>Username:</strong> ${member.username}
                                    </p>
                                    <p style="margin: 0;">
                                        <i class="fas fa-calendar-plus" style="width: 16px; color: ${roleColor};"></i>
                                        <strong>Membro desde:</strong> ${joinDate}
                                    </p>
                                </div>
                                ${locationHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Auto-atualizar localizações a cada 3 segundos (precisão centimétrica)
            if (window.memberLocationInterval) {
                clearInterval(window.memberLocationInterval);
            }
            window.memberLocationInterval = setInterval(() => {
                refreshMemberLocations(familyId, locationMap);
            }, 3000);
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #9ca3af;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="margin: 0; font-size: 16px;">Nenhum membro cadastrado ainda.</p>
                </div>
            `;
        }

        window.showModal('viewMembersModal');
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
        alert('Erro ao carregar membros da família');
    }
}

async function refreshMemberLocations(familyId, locationMap) {
    try {
        const response = await fetch(`/api/families/${familyId}/members`);
        const data = await response.json();

        if (data.members && data.members.length > 0) {
            for (const member of data.members) {
                try {
                    const locResponse = await fetch(`/api/location/user/${member.id}`);
                    const locData = await locResponse.json();

                    if (locData.location) {
                        const location = locData.location;
                        // Horário já vem do servidor em timezone de Brasília
                        const lastUpdate = new Date(location.timestamp).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo'
                        });
                        const batteryIcon = location.battery_level > 75 ? 'fa-battery-full' :
                                           location.battery_level > 50 ? 'fa-battery-three-quarters' :
                                           location.battery_level > 25 ? 'fa-battery-half' : 'fa-battery-quarter';
                        const batteryColor = location.battery_level > 50 ? '#10b981' :
                                            location.battery_level > 25 ? '#f59e0b' : '#ef4444';

                        const memberCard = document.getElementById(`member-card-${member.id}`);
                        if (memberCard) {
                            const locationDiv = memberCard.querySelector('div[style*="border-left"]');
                            if (locationDiv) {
                                locationDiv.innerHTML = `
                                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">
                                        <i class="fas fa-map-marker-alt" style="color: #10b981;"></i> Localização em Tempo Real
                                    </p>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                                        <div>
                                            <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                                            <strong>Lat:</strong> ${location.latitude.toFixed(6)}
                                        </div>
                                        <div>
                                            <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                                            <strong>Lon:</strong> ${location.longitude.toFixed(6)}
                                        </div>
                                        <div>
                                            <i class="fas fa-crosshairs" style="color: #8b5cf6; width: 16px;"></i>
                                            <strong>Precisão:</strong> ${location.accuracy ? Math.round(location.accuracy) + 'm' : 'N/A'}
                                        </div>
                                        <div>
                                            <i class="fas ${batteryIcon}" style="color: ${batteryColor}; width: 16px;"></i>
                                            <strong>Bateria:</strong> ${location.battery_level ? location.battery_level + '%' : 'N/A'}
                                        </div>
                                    </div>
                                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                                        <i class="fas fa-clock" style="width: 16px;"></i>
                                        Última atualização: ${lastUpdate}
                                    </p>
                                    <button onclick="showMemberOnMap(${location.latitude}, ${location.longitude}, '${member.full_name}')"
                                            class="btn btn-sm btn-primary" style="margin-top: 8px; width: 100%;">
                                        <i class="fas fa-map-marked-alt"></i> Ver no Mapa
                                    </button>
                                `;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao atualizar localização do membro ${member.id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar localizações:', error);
    }
}

function showMemberOnMap(lat, lon, name) {
    // Salvar coordenadas no localStorage para usar na página do mapa
    localStorage.setItem('focusLocation', JSON.stringify({ lat, lon, name }));
    // Redirecionar para a página do mapa
    window.location.href = '/map';
}

function createViewMembersModal() {
    const modalHTML = `
        <div id="viewMembersModal" class="modal">
            <div class="modal-content" style="max-width: 700px;">
                <span class="close" onclick="closeModal('viewMembersModal')">&times;</span>
                <h2 id="viewMembersTitle" style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-users"></i> Membros da Família
                </h2>
                <div id="viewMembersContainer" style="margin-top: 20px; max-height: 500px; overflow-y: auto;">
                    <p class="text-muted">Carregando...</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function loadAlerts() {
    try {
        const response = await fetch('/api/alerts');
        const data = await response.json();

        const alertsList = document.getElementById('alertsList');

        if (data.alerts && data.alerts.length > 0) {
            alertsList.innerHTML = data.alerts.slice(0, 5).map(alert => {
                let severityColor = 'var(--text-secondary)';
                if (alert.severity === 'warning') severityColor = 'var(--warning-color)';
                if (alert.severity === 'critical') severityColor = 'var(--danger-color)';

                return `
                    <div style="padding: 10px; border-left: 3px solid ${severityColor}; margin-bottom: 10px; background: #f8fafc;">
                        <p style="margin: 0; font-size: 14px;">${alert.alert_message}</p>
                        <small style="color: var(--text-secondary);">
                            ${new Date(alert.created_at).toLocaleString('pt-BR')}
                        </small>
                    </div>
                `;
            }).join('');
        } else {
            alertsList.innerHTML = '<p class="text-muted">Nenhum alerta recente</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar alertas:', error);
    }
}

function initMiniMap() {
    if (!document.getElementById('miniMap')) return;

    const isMobile = window.innerWidth < 768;
    const zoomLevel = isMobile ? 12 : 13;
    miniMap = L.map('miniMap').setView([0, 0], zoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(miniMap);

    updateMiniMap();
}

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
        console.log('📍 Usando endereço em cache');
        return addressCache[cacheKey];
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);

        // Verificar rate limiting - NÃO cachear para permitir retry depois
        if (response.status === 429 || response.status === 403) {
            console.warn('⚠️ Rate limit atingido na API Nominatim');
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
            console.log('✅ Endereço armazenado em cache');

            return finalAddress;
        }

        const fallback = 'Endereço não disponível';
        addressCache[cacheKey] = fallback;
        return fallback;
    } catch (error) {
        console.error('❌ Erro ao obter endereço:', error);
        return 'Coordenadas: ' + lat.toFixed(5) + ', ' + lon.toFixed(5);
    }
}

async function updateMiniMap() {
    if (!miniMap || !currentPosition) return;

    const lat = currentPosition.coords.latitude;
    const lon = currentPosition.coords.longitude;

    miniMap.setView([lat, lon], 16);

    if (userMarker) {
        userMarker.setLatLng([lat, lon]);
    } else {
        const myIcon = L.divIcon({
            html: '<i class="fas fa-user-circle" style="font-size: 30px; color: #3b82f6;"></i>',
            className: 'custom-marker',
            iconSize: [30, 30]
        });

        userMarker = L.marker([lat, lon], { icon: myIcon }).addTo(miniMap)
            .bindPopup('Você está aqui!')
            .openPopup();
    }

    const locationDiv = document.getElementById('currentLocation');
    if (locationDiv) {
        const address = await getAddressFromCoords(lat, lon);

        // Atualizar com endereço completo
        locationDiv.innerHTML = `
            <div style="margin-bottom: 12px; padding: 12px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600; color: #1e40af; display: flex; align-items: center; gap: 6px; font-size: 15px;">
                    <i class="fas fa-map-marker-alt"></i>
                    ${address}
                </p>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; color: #64748b; margin-bottom: 10px;">
                <div>
                    <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                    <strong>Lat:</strong> ${lat.toFixed(6)}
                </div>
                <div>
                    <i class="fas fa-compass" style="color: #6366f1; width: 16px;"></i>
                    <strong>Lon:</strong> ${lon.toFixed(6)}
                </div>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                <i class="fas fa-crosshairs" style="width: 16px;"></i>
                <strong>Precisão:</strong> ${currentPosition.coords.accuracy.toFixed(0)}m
            </p>
        `;
    }

    // Garantir que o mini mapa está visível e redimensionado
    const miniMapDiv = document.getElementById('miniMap');
    if (miniMapDiv) {
        miniMapDiv.style.display = 'block';
        miniMapDiv.style.height = '200px';
        miniMapDiv.style.marginTop = '12px';
        miniMapDiv.style.borderRadius = '8px';
        miniMapDiv.style.border = '2px solid #e2e8f0';

        setTimeout(() => {
            miniMap.invalidateSize();
        }, 100);
    }
}

async function showCreateFamilyModal() {
    // Verificar se o usuário é Super Admin
    try {
        const response = await fetch('/api/user/profile');
        const data = await response.json();

        if (data.user && data.user.user_type === 'super_admin') {
            // Se for Super Admin, redirecionar para a página de administração
            window.location.href = '/admin';
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar tipo de usuário:', error);
    }

    // Se não for Super Admin, abrir o modal normalmente
    showModal('createFamilyModal');
}

document.getElementById('createFamilyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        name: document.getElementById('familyName').value,
        description: document.getElementById('familyDescription').value
    };

    try {
        const response = await fetch('/api/families', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            alert('Família criada com sucesso!');
            closeModal('createFamilyModal');
            loadFamilies();
        } else {
            alert('Erro ao criar família');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao criar família');
    }
});

function viewFamily(familyId) {
    window.location.href = `/messages?family_id=${familyId}`;
}

// Adicionar funcionalidade de barra de bateria
async function getBatteryStatus() {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            const level = Math.round(battery.level * 100);
            document.getElementById('batteryLevel').textContent = level + '%';

            // Atualizar barra de bateria
            const batteryFill = document.getElementById('batteryFill');
            if (batteryFill) {
                batteryFill.style.width = level + '%';

                // Mudar cor baseado no nível
                if (level <= 20) {
                    batteryFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
                } else if (level <= 50) {
                    batteryFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                } else {
                    batteryFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
                }
            }

            // Atualizar ícone baseado no nível
            const batteryIcon = document.getElementById('batteryIcon');
            if (batteryIcon) {
                if (level > 75) {
                    batteryIcon.className = 'fas fa-battery-full battery-icon';
                } else if (level > 50) {
                    batteryIcon.className = 'fas fa-battery-three-quarters battery-icon';
                } else if (level > 25) {
                    batteryIcon.className = 'fas fa-battery-half battery-icon';
                } else {
                    batteryIcon.className = 'fas fa-battery-quarter battery-icon';
                }
            }
        }
    } catch (error) {
        console.log('Battery API não suportada');
    }
}

// Atualizar timestamp de última atualização
function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR')}`;
    }
}

// Carregar lista de usuários com câmeras disponíveis
async function loadAvailableCameras() {
    try {
        const response = await fetch('/api/camera/available-users');
        const data = await response.json();

        const container = document.getElementById('cameraUsersList');

        if (data.success && data.users && data.users.length > 0) {
            container.innerHTML = data.users.map(user => {
                let categoryIcon = '👤';
                let categoryText = '';

                if (user.user_category === 'filho') {
                    categoryIcon = '👶';
                    categoryText = 'Criança';
                } else if (user.user_category === 'idoso') {
                    categoryIcon = '👴';
                    categoryText = 'Idoso';
                } else if (user.user_category === 'outro') {
                    categoryIcon = '👤';
                    categoryText = 'Outro';
                }

                const photoCountBadge = user.photo_count > 0 
                    ? `<span class="badge" style="background: #10b981;">${user.photo_count} foto(s)</span>`
                    : `<span class="badge" style="background: #9ca3af;">Sem fotos</span>`;

                return `
                    <div class="camera-user-item" style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; background: white; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 5px 0; font-size: 15px;">
                                ${categoryIcon} ${user.full_name}
                                ${categoryText ? `<small style="color: #6b7280;"> (${categoryText})</small>` : ''}
                            </h4>
                            <p style="margin: 0; font-size: 13px; color: #6b7280;">
                                ${user.email}
                            </p>
                            ${photoCountBadge}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm btn-success" onclick="requestLiveCamera(${user.id}, '${user.full_name}')" title="Solicitar câmera ao vivo">
                                <i class="fas fa-video"></i> Ao Vivo
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="viewUserCameras(${user.id}, '${user.full_name}')" title="Ver fotos capturadas">
                                <i class="fas fa-camera"></i> Fotos
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <p class="text-muted" style="text-align: center; padding: 20px;">
                    <i class="fas fa-info-circle"></i> Nenhuma câmera disponível para visualização
                </p>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar câmeras:', error);
        document.getElementById('cameraUsersList').innerHTML = '<p class="text-danger">Erro ao carregar câmeras</p>';
    }
}

async function viewUserCameras(userId, userName) {
    try {
        const response = await fetch(`/api/camera/photos/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            alert(data.message || 'Sem permissão para visualizar as câmeras deste usuário');
            return;
        }

        const modal = document.getElementById('viewCamerasModal');
        if (!modal) {
            createViewCamerasModal();
        }

        document.getElementById('viewCamerasTitle').textContent = `Câmeras de ${userName}`;

        const container = document.getElementById('viewCamerasContainer');

        if (data.photos && data.photos.length > 0) {
            container.innerHTML = data.photos.map(photo => {
                const capturedDate = new Date(photo.captured_at).toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo'
                });
                const cameraTypeIcon = photo.camera_type === 'front' ? 'fa-user' : 'fa-camera';
                const cameraTypeName = photo.camera_type === 'front' ? 'Frontal' : 'Traseira';

                return `
                    <div class="camera-photo-item" style="padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; background: white;">
                        <div style="display: flex; gap: 15px; align-items: start;">
                            <div style="flex-shrink: 0;">
                                <img src="/${photo.filepath}" alt="Foto capturada" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; border: 2px solid #3b82f6;">
                            </div>
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 8px 0; font-size: 16px;">
                                    <i class="fas ${cameraTypeIcon}"></i> Câmera ${cameraTypeName}
                                </h4>
                                <p style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">
                                    <i class="fas fa-calendar"></i> Capturada em: ${capturedDate}
                                </p>
                                <button class="btn btn-sm btn-info" onclick="window.open('/${photo.filepath}', '_blank')" style="margin-top: 8px;">
                                    <i class="fas fa-expand"></i> Visualizar em Tela Cheia
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280; background: #f9fafb; border-radius: 8px;">
                    <i class="fas fa-camera" style="font-size: 48px; margin-bottom: 16px; color: #9ca3af;"></i>
                    <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #374151;">Nenhuma foto capturada ainda</h3>
                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                        <strong>${userName}</strong> ainda não capturou nenhuma foto com a câmera.<br>
                        As fotos serão exibidas aqui quando forem tiradas pelo usuário através do aplicativo.
                    </p>
                    <div style="background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 16px; text-align: left; border-radius: 4px; margin-top: 20px;">
                        <h4 style="margin: 0 0 8px 0; color: #0369a1; font-size: 14px;">
                            <i class="fas fa-info-circle"></i> Como capturar fotos:
                        </h4>
                        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #075985;">
                            <li>O usuário deve acessar o aplicativo no smartphone</li>
                            <li>Permitir acesso à câmera quando solicitado</li>
                            <li>Tirar fotos usando a funcionalidade de câmera</li>
                            <li>As fotos aparecerão automaticamente aqui</li>
                        </ol>
                    </div>
                </div>
            `;
        }

        window.showModal('viewCamerasModal');
    } catch (error) {
        console.error('Erro ao carregar fotos:', error);
        alert('Erro ao carregar fotos da câmera');
    }
}

function createViewCamerasModal() {
    const modalHTML = `
        <div id="viewCamerasModal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <span class="close" onclick="closeModal('viewCamerasModal')">&times;</span>
                <h2 id="viewCamerasTitle" style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-video"></i> Câmeras
                </h2>
                <div id="viewCamerasContainer" style="margin-top: 20px; max-height: 600px; overflow-y: auto;">
                    <p class="text-muted">Carregando...</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function refreshCameraList() {
    await loadAvailableCameras();
}

document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    loadFamilies();
    loadAlerts();
    initMiniMap();
    loadAvailableCameras();

    // Get user's current location and start watching for updates
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(function(position) {
            window.currentPosition = position;
            // Dispatch a custom event when location is updated
            const event = new CustomEvent('locationUpdated', { detail: position });
            window.dispatchEvent(event);
        }, function(error) {
            console.error('Erro ao obter localização:', error);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    } else {
        console.log('Geolocalização não é suportada por este navegador.');
    }

    // Update family locations periodically
    setInterval(updateFamilyLocations, 5000);

    // Update alerts periodically
    setInterval(loadAlerts, 10000);

    // Update battery status and timestamp
    updateBatteryStatus();
    updateLastUpdateTime();
    setInterval(updateBatteryStatus, 30000);
    setInterval(updateLastUpdateTime, 1000);
});

async function managePermissions(familyId, familyName) {
    try {
        const response = await fetch(`/api/families/${familyId}/permissions`);
        const data = await response.json();

        if (!response.ok) {
            alert(data.message || 'Erro ao carregar permissões');
            return;
        }

        const modal = document.getElementById('permissionsModal');
        if (!modal) {
            createPermissionsModal();
        }

        document.getElementById('permissionsModalTitle').textContent = `Gerenciar Permissões - ${familyName}`;

        const permissionsContainer = document.getElementById('permissionsContainer');
        permissionsContainer.innerHTML = '';

        data.permissions.forEach(member => {
            const memberCard = document.createElement('div');
            memberCard.className = 'permission-member-card';
            memberCard.innerHTML = `
                <div class="permission-member-header">
                    <h4>${member.full_name} ${member.role === 'admin' ? '<span class="badge-admin">Admin</span>' : ''}</h4>
                    <small>${member.email}</small>
                </div>
                <div class="permission-actions">
                    <button class="btn btn-sm btn-success" onclick="grantAllPermissions(${familyId}, ${member.user_id}, '${member.full_name}')">
                        <i class="fas fa-check-circle"></i> Conceder Todas
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="revokeAllPermissions(${familyId}, ${member.user_id}, '${member.full_name}')">
                        <i class="fas fa-times-circle"></i> Revogar Todas
                    </button>
                </div>
                <div class="permission-details">
                    <p><strong>Pode visualizar:</strong></p>
                    <ul id="permissions-list-${member.user_id}">
                        ${member.permissions.length > 0 ? member.permissions.map(perm => {
                            const targetMember = data.permissions.find(m => m.user_id === perm.target_user_id);
                            return `
                                <li>
                                    <span>${targetMember ? targetMember.full_name : 'Usuário #' + perm.target_user_id}</span>
                                    <span class="permission-badges">
                                        ${perm.can_view_location ? '<span class="badge-perm">📍 Localização</span>' : ''}
                                        ${perm.can_view_battery ? '<span class="badge-perm">🔋 Bateria</span>' : ''}
                                        ${perm.can_view_history ? '<span class="badge-perm">📜 Histórico</span>' : ''}
                                    </span>
                                </li>
                            `;
                        }).join('') : '<li class="text-muted">Nenhuma permissão concedida</li>'}
                    </ul>
                </div>
            `;
            permissionsContainer.appendChild(memberCard);
        });

        showModal('permissionsModal');
    } catch (error) {
        console.error('Erro ao carregar permissões:', error);
        alert('Erro ao carregar permissões');
    }
}

async function grantAllPermissions(familyId, memberId, memberName) {
    if (!confirm(`Conceder todas as permissões para ${memberName}? Ele(a) poderá visualizar localização, bateria e histórico de todos os membros da família.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/families/${familyId}/permissions/grant-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('permissionsModal');
            setTimeout(() => managePermissions(familyId, ''), 500);
        } else {
            alert(data.message || 'Erro ao conceder permissões');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conceder permissões');
    }
}

async function revokeAllPermissions(familyId, memberId, memberName) {
    if (!confirm(`Remover todas as permissões de ${memberName}? Ele(a) não poderá visualizar informações dos outros membros.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/families/${familyId}/permissions/revoke-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            closeModal('permissionsModal');
            setTimeout(() => managePermissions(familyId, ''), 500);
        } else {
            alert(data.message || 'Erro ao revogar permissões');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao revogar permissões');
    }
}

function createPermissionsModal() {
    const modalHTML = `
        <div id="permissionsModal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <span class="close" onclick="closeModal('permissionsModal')">&times;</span>
                <h2 id="permissionsModalTitle"><i class="fas fa-key"></i> Gerenciar Permissões</h2>
                <div id="permissionsContainer"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

let currentFamilyId = null;

async function manageFamilyMembers(familyId, familyName) {
    currentFamilyId = familyId;
    document.getElementById('manageMembersTitle').textContent = `Gerenciar Membros - ${familyName}`;

    hideAddExistingUserForm();
    hideCreateNewUserForm();

    await loadFamilyMembers(familyId);

    showModal('manageMembersModal');
}

async function loadFamilyMembers(familyId) {
    try {
        const response = await fetch(`/api/families/${familyId}/members`);
        const data = await response.json();

        const container = document.getElementById('membersListContainer');

        if (data.members && data.members.length > 0) {
            container.innerHTML = data.members.map(member => {
                let roleLabel = 'Membro';
                let roleColor = '#6366f1';
                if (member.role === 'admin') {
                    roleLabel = 'Admin';
                    roleColor = '#10b981';
                } else if (member.role === 'supervisor') {
                    roleLabel = 'Supervisor';
                    roleColor = '#f59e0b';
                }

                return `
                    <div style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px; background: white;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 5px 0;">${member.full_name}</h4>
                                <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                                    ${member.email}
                                </p>
                                <span style="display: inline-block; margin-top: 5px; padding: 3px 10px; background: ${roleColor}; color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                    ${roleLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="text-muted">Nenhum membro na família ainda.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
        document.getElementById('membersListContainer').innerHTML = '<p class="text-danger">Erro ao carregar membros</p>';
    }
}

function showAddExistingUserForm() {
    hideCreateNewUserForm();
    document.getElementById('addExistingUserForm').style.display = 'block';
}

function hideAddExistingUserForm() {
    document.getElementById('addExistingUserForm').style.display = 'none';
    document.getElementById('existingUserForm').reset();
}

function showCreateNewUserForm() {
    hideAddExistingUserForm();

    const formElement = document.querySelector('#createNewUserForm form');
    if (formElement) formElement.reset();

    document.getElementById('createNewUserForm').style.display = 'block';

    // Esconder seções de categoria e supervisor por padrão
    document.getElementById('userCategorySection').style.display = 'none';
    document.getElementById('supervisorInfoSection').style.display = 'none';

    // Aplicar máscara de CPF
    const cpfInput = document.getElementById('newUserCpf');
    if (cpfInput && !cpfInput.hasAttribute('data-masked')) {
        cpfInput.setAttribute('data-masked', 'true');
        cpfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                e.target.value = value;
            }
        });
    }
}

function hideCreateNewUserForm() {
    document.getElementById('createNewUserForm').style.display = 'none';
    const formElement = document.querySelector('#createNewUserForm form');
    if (formElement) formElement.reset();
}

document.getElementById('existingUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFamilyId) {
        alert('Erro: Família não selecionada');
        return;
    }

    const formData = {
        email: document.getElementById('existingUserEmail').value,
        role: document.getElementById('existingUserRole').value
    };

    try {
        const response = await fetch(`/api/families/${currentFamilyId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            alert('Usuário adicionado com sucesso!');
            hideAddExistingUserForm();
            await loadFamilyMembers(currentFamilyId);
            loadFamilies();
        } else {
            alert(data.message || 'Erro ao adicionar usuário');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao adicionar usuário');
    }
});

// Nova função para controlar as seções baseado no tipo de usuário
function toggleUserTypeOptions() {
    const role = document.getElementById('newUserRole').value;
    const userCategorySection = document.getElementById('userCategorySection');
    const supervisorInfoSection = document.getElementById('supervisorInfoSection');

    if (role === 'member') {
        // Mostrar seletor de categoria para usuários comuns
        userCategorySection.style.display = 'block';
        supervisorInfoSection.style.display = 'none';
    } else if (role === 'supervisor') {
        // Mostrar informações de permissões do supervisor
        userCategorySection.style.display = 'none';
        supervisorInfoSection.style.display = 'block';
    } else {
        // Esconder tudo se nada selecionado
        userCategorySection.style.display = 'none';
        supervisorInfoSection.style.display = 'none';
    }
}

// Manter função antiga para compatibilidade (se ainda for usada em algum lugar)
function toggleSupervisorPermissions() {
    toggleUserTypeOptions();
}

async function loadMembersForPermissions() {
    if (!currentFamilyId) return;

    try {
        const response = await fetch(`/api/families/${currentFamilyId}/members`);
        const data = await response.json();

        const permissionsList = document.getElementById('supervisorPermissionsList');
        permissionsList.innerHTML = '';

        if (data.members && data.members.length > 0) {
            data.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.style.marginBottom = '10px';
                memberDiv.style.padding = '10px';
                memberDiv.style.background = 'white';
                memberDiv.style.borderRadius = '5px';

                memberDiv.innerHTML = `
                    <strong>${member.full_name}</strong> (${member.email})
                    <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px;">
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_view_location">
                            Ver Localização
                        </label>
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_view_battery">
                            Ver Bateria
                        </label>
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_view_history">
                            Ver Histórico
                        </label>
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_receive_alerts">
                            Receber Alertas
                        </label>
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_view_messages">
                            Ver Mensagens
                        </label>
                        <label style="font-size: 0.85em;">
                            <input type="checkbox" class="perm-checkbox" data-user-id="${member.id}" data-perm="can_send_messages" checked>
                            Enviar Mensagens
                        </label>
                    </div>
                `;

                permissionsList.appendChild(memberDiv);
            });
        } else {
            permissionsList.innerHTML = '<p style="color: #666;">Nenhum membro ainda. As permissões serão configuradas depois.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
    }
}

// Handler para o formulário de criar novo usuário
document.getElementById('createNewUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFamilyId) {
        alert('Erro: Família não selecionada');
        return;
    }

    const role = document.getElementById('newUserRole').value;

    // Validação do role
    if (!role) {
        alert('Por favor, selecione o tipo de acesso');
        return;
    }

    const cpf = document.getElementById('newUserCpf').value.replace(/\D/g, '');

    const formData = {
        full_name: document.getElementById('newUserFullName').value,
        cpf: cpf,
        email: document.getElementById('newUserEmail').value,
        password: document.getElementById('newUserPassword').value,
        birth_date: document.getElementById('newUserBirthDate').value,
        role: role
    };

    // Se for usuário comum (member), adicionar categoria
    if (role === 'member') {
        const category = document.getElementById('newUserCategory').value;
        if (category) {
            formData.user_category = category;
        }
    }

    // Se for supervisor, configurar permissões completas automaticamente
    if (role === 'supervisor') {
        formData.grant_full_access = true;
    }

    try {
        const response = await fetch(`/api/families/${currentFamilyId}/members/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            const roleText = role === 'supervisor' ? 'Supervisor com acesso total' : 'Usuário Comum';
            alert(`✅ Usuário criado como ${roleText} e adicionado à família com sucesso!`);
            hideCreateNewUserForm();
            await loadFamilyMembers(currentFamilyId);
            loadFamilies();
        } else {
            alert(data.message || 'Erro ao criar usuário');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao criar usuário');
    }
});

async function refreshAIInsights() {
    try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
            console.error('Erro ao carregar perfil do usuário');
            return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Resposta não é JSON');
            return;
        }

        const userData = await response.json();
        if (userData.user && window.loadAIInsights) {
            window.loadAIInsights(userData.user.id);
        }
    } catch (error) {
        console.error('Erro ao atualizar insights de IA:', error);
    }
}

async function triggerHistoryCleanup() {
    try {
        const response = await fetch('/api/history/cleanup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (data.success) {
            console.log(`✅ Histórico limpo: ${data.deleted_locations} registros removidos`);
        }
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
    }
}

setTimeout(() => {
    refreshAIInsights();
    setInterval(refreshAIInsights, 30000);

    triggerHistoryCleanup();
    setInterval(triggerHistoryCleanup, 3600000);
}, 2000);

// Helper function to update family locations on the map
async function updateFamilyLocations() {
    if (!miniMap) return;

    try {
        const response = await fetch('/api/families/locations'); // Assumes this endpoint returns locations for all members of all families
        const data = await response.json();

        if (data.locations) {
            // Clear previous markers if necessary, or update existing ones
            // For simplicity, let's assume we might add new markers or update existing ones
            // In a real scenario, you'd manage markers more robustly (e.g., store them in a map or array)

            data.locations.forEach(locationInfo => {
                const { userId, latitude, longitude, familyId, memberName, timestamp, batteryLevel } = locationInfo;

                const markerId = `family-member-marker-${userId}`;
                let marker = null;

                // Check if marker already exists
                if (miniMap.hasLayer(window[markerId])) {
                    marker = window[markerId];
                    marker.setLatLng([latitude, longitude]);
                } else {
                    const memberIcon = L.divIcon({
                        html: `<div class="member-marker" style="background-color: ${getColorForUser(userId)};">
                                   <i class="fas fa-map-marker-alt"></i>
                                   <span class="marker-label">${memberName ? memberName.charAt(0) : '?'}</span>
                               </div>`,
                        className: 'custom-marker',
                        iconSize: [35, 35],
                        iconAnchor: [17, 35] // Point to the tip of the icon
                    });

                    marker = L.marker([latitude, longitude], { icon: memberIcon }).addTo(miniMap);
                    window[markerId] = marker; // Store marker to easily access/update later
                }

                // Horário já vem do servidor em timezone de Brasília
                const lastUpdate = new Date(timestamp).toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo'
                });
                const batteryIconClass = getBatteryIconClass(batteryLevel);
                const batteryColor = getBatteryColor(batteryLevel);

                const popupContent = `
                    <strong>${memberName || 'Membro'}</strong><br/>
                    <small>Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}</small><br/>
                    <small>Última atualização: ${lastUpdate}</small><br/>
                    <i class="fas ${batteryIconClass}" style="color: ${batteryColor};"></i> Bateria: ${batteryLevel !== undefined ? batteryLevel + '%' : 'N/A'}
                `;
                marker.bindPopup(popupContent).openPopup();
            });
        }
    } catch (error) {
        console.error('Erro ao atualizar localizações da família:', error);
    }
}

// Helper function to get a color for a user (you might want a more robust mapping)
function getColorForUser(userId) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8423a8'];
    return colors[userId % colors.length];
}

// Helper function to get battery icon class
function getBatteryIconClass(level) {
    if (level === undefined) return 'fa-battery-empty';
    if (level > 75) return 'fa-battery-full';
    if (level > 50) return 'fa-battery-three-quarters';
    if (level > 25) return 'fa-battery-half';
    return 'fa-battery-quarter';
}

// Helper function to get battery color
function getBatteryColor(level) {
    if (level === undefined) return '#9ca3af';
    if (level > 50) return '#10b981'; // Green
    if (level > 25) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
}

// Add event listener for the 'locationUpdated' custom event
window.addEventListener('locationUpdated', function() {
    updateMiniMap(); // Update the user's own position on the map
    // You might also want to call updateFamilyLocations() here if you want family locations to refresh immediately when the user's location updates.
    // updateFamilyLocations();
});

// Ensure the map is initialized and updated when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    loadFamilies();
    loadAlerts();
    initMiniMap();
    loadAvailableCameras();

    // Get user's current location and start watching for updates
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(function(position) {
            window.currentPosition = position;
            // Dispatch a custom event when location is updated
            const event = new CustomEvent('locationUpdated', { detail: position });
            window.dispatchEvent(event);
        }, function(error) {
            console.error('Erro ao obter localização:', error);
            // Optionally, initialize map even if geolocation fails, but updateMiniMap might not work as expected.
            // initMiniMap(); // Already called in initMiniMap
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    } else {
        console.log('Geolocalização não é suportada por este navegador.');
        // initMiniMap(); // Already called in initMiniMap
    }

    // Update family locations periodically
    setInterval(updateFamilyLocations, 5000);

    // Update alerts periodically
    setInterval(loadAlerts, 10000);

    // Update battery status and timestamp
    updateBatteryStatus();
    updateLastUpdateTime();
    setInterval(updateBatteryStatus, 30000);
    setInterval(updateLastUpdateTime, 1000);
});

// Function to get initial battery status
async function updateBatteryStatus() {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            const level = Math.round(battery.level * 100);
            document.getElementById('batteryLevel').textContent = level + '%';

            const batteryFill = document.getElementById('batteryFill');
            if (batteryFill) {
                batteryFill.style.width = level + '%';
                if (level <= 20) {
                    batteryFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
                } else if (level <= 50) {
                    batteryFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                } else {
                    batteryFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
                }
            }

            const batteryIcon = document.getElementById('batteryIcon');
            if (batteryIcon) {
                if (level > 75) {
                    batteryIcon.className = 'fas fa-battery-full battery-icon';
                } else if (level > 50) {
                    batteryIcon.className = 'fas fa-battery-three-quarters battery-icon';
                } else if (level > 25) {
                    batteryIcon.className = 'fas fa-battery-half battery-icon';
                } else {
                    batteryIcon.className = 'fas fa-battery-quarter battery-icon';
                }
            }
        }
    } catch (error) {
        console.log('Battery API não suportada');
    }
}