// Visualização Avançada de Histórico de Localizações
// Family Guardian 360°

let historyPolyline;
let historyMarkers = [];
let playbackInterval;
let playbackIndex = 0;

// Carrega histórico de localização de um usuário
async function loadLocationHistory(userId, startDate, endDate) {
    try {
        const response = await fetch(`/api/location/history/${userId}?start=${startDate}&end=${endDate}`);
        const data = await response.json();
        
        if (data.success) {
            displayLocationHistory(data.locations);
        }
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Exibe histórico no mapa
function displayLocationHistory(locations) {
    if (!mainMap || !locations || locations.length === 0) return;
    
    clearHistoryDisplay();
    
    // Cria array de coordenadas
    const coords = locations.map(loc => [loc.latitude, loc.longitude]);
    
    // Desenha linha do trajeto
    historyPolyline = L.polyline(coords, {
        color: '#2196F3',
        weight: 4,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(mainMap);
    
    // Adiciona marcadores nos pontos
    locations.forEach((loc, index) => {
        const isFirst = index === 0;
        const isLast = index === locations.length - 1;
        
        let iconColor = '#2196F3';
        let iconType = 'circle';
        
        if (isFirst) {
            iconColor = '#4CAF50';
            iconType = 'play';
        } else if (isLast) {
            iconColor = '#F44336';
            iconType = 'stop';
        }
        
        const marker = L.circleMarker([loc.latitude, loc.longitude], {
            radius: isFirst || isLast ? 8 : 5,
            fillColor: iconColor,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mainMap);
        
        marker.bindPopup(`
            <div class="history-popup">
                <strong>${isFirst ? '🚀 Início' : isLast ? '🏁 Fim' : '📍 Ponto'}</strong><br>
                <small>${formatDateTime(loc.timestamp)}</small><br>
                ${loc.battery_level ? `🔋 ${loc.battery_level}%` : ''}
                ${loc.speed ? `<br>🚗 ${Math.round(loc.speed * 3.6)} km/h` : ''}
            </div>
        `);
        
        historyMarkers.push(marker);
    });
    
    // Ajusta zoom para mostrar todo o trajeto
    mainMap.fitBounds(historyPolyline.getBounds(), { padding: [50, 50] });
}

// Limpa exibição de histórico
function clearHistoryDisplay() {
    if (historyPolyline) {
        mainMap.removeLayer(historyPolyline);
        historyPolyline = null;
    }
    
    historyMarkers.forEach(marker => mainMap.removeLayer(marker));
    historyMarkers = [];
    
    stopPlayback();
}

// Animação de playback do trajeto
function startPlayback(locations, speed = 1000) {
    if (!locations || locations.length === 0) return;
    
    stopPlayback();
    playbackIndex = 0;
    
    const playbackMarker = L.marker([locations[0].latitude, locations[0].longitude], {
        icon: L.divIcon({
            className: 'playback-marker',
            html: '<div class="pulse-marker"></div>',
            iconSize: [20, 20]
        })
    }).addTo(mainMap);
    
    playbackInterval = setInterval(() => {
        if (playbackIndex >= locations.length) {
            stopPlayback();
            mainMap.removeLayer(playbackMarker);
            return;
        }
        
        const loc = locations[playbackIndex];
        playbackMarker.setLatLng([loc.latitude, loc.longitude]);
        
        playbackMarker.setPopupContent(`
            <div class="playback-popup">
                <strong>📍 ${formatDateTime(loc.timestamp)}</strong><br>
                ${loc.battery_level ? `🔋 ${loc.battery_level}%` : ''}
                ${loc.speed ? `<br>🚗 ${Math.round(loc.speed * 3.6)} km/h` : ''}
            </div>
        `);
        
        if (playbackIndex === 0) {
            playbackMarker.openPopup();
        }
        
        updatePlaybackProgress(playbackIndex, locations.length);
        playbackIndex++;
    }, speed);
}

// Para playback
function stopPlayback() {
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    playbackIndex = 0;
}

// Atualiza progresso do playback
function updatePlaybackProgress(current, total) {
    const progressBar = document.getElementById('playbackProgress');
    if (progressBar) {
        const percentage = (current / total) * 100;
        progressBar.style.width = percentage + '%';
    }
    
    const progressText = document.getElementById('playbackText');
    if (progressText) {
        progressText.textContent = `${current + 1} / ${total}`;
    }
}

// Formata data e hora
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Modal de seleção de histórico
function showHistoryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-route"></i> Histórico de Localizações</h2>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Membro da Família</label>
                    <select id="historyUserId" class="form-control">
                        <option value="">Selecione...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Data Inicial</label>
                    <input type="date" id="historyStartDate" class="form-control" 
                           value="${new Date(Date.now() - 86400000).toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Data Final</label>
                    <input type="date" id="historyEndDate" class="form-control" 
                           value="${new Date().toISOString().split('T')[0]}">
                </div>
                <button class="btn-primary" onclick="loadHistoryFromModal()">
                    <i class="fas fa-search"></i> Ver Histórico
                </button>
                <button class="btn-secondary" onclick="clearHistoryDisplay(); this.closest('.modal-overlay').remove()">
                    <i class="fas fa-eraser"></i> Limpar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    loadFamilyMembersForHistory();
}

// Carrega membros da família para seleção
async function loadFamilyMembersForHistory() {
    try {
        const response = await fetch('/api/families/members');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('historyUserId');
            data.members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.user_id;
                option.textContent = member.full_name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar membros:', error);
    }
}

// Carrega histórico do modal
async function loadHistoryFromModal() {
    const userId = document.getElementById('historyUserId').value;
    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;
    
    if (!userId) {
        alert('Selecione um membro da família');
        return;
    }
    
    await loadLocationHistory(userId, startDate, endDate);
    document.querySelector('.modal-overlay').remove();
}

// Exporta funções
window.loadLocationHistory = loadLocationHistory;
window.showHistoryModal = showHistoryModal;
window.loadHistoryFromModal = loadHistoryFromModal;
window.startPlayback = startPlayback;
window.stopPlayback = stopPlayback;
window.clearHistoryDisplay = clearHistoryDisplay;
