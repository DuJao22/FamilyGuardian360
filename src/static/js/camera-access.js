
// Módulo de Acesso às Câmeras
// Family Guardian 360°

let currentStream = null;
let currentCamera = 'user'; // 'user' = frontal, 'environment' = traseira

// Solicita permissão e acessa câmera
async function requestCameraAccess(cameraType = 'user') {
    try {
        // Para stream anterior se existir
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // Constraints para câmera
        const constraints = {
            video: {
                facingMode: cameraType, // 'user' ou 'environment'
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        // Solicita acesso
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        currentCamera = cameraType;

        console.log(`✅ Acesso à câmera ${cameraType === 'user' ? 'frontal' : 'traseira'} concedido`);
        return currentStream;

    } catch (error) {
        console.error('❌ Erro ao acessar câmera:', error);
        
        if (error.name === 'NotAllowedError') {
            alert('⚠️ Permissão de câmera negada. Por favor, permita o acesso nas configurações do navegador.');
        } else if (error.name === 'NotFoundError') {
            alert('⚠️ Nenhuma câmera encontrada no dispositivo.');
        } else {
            alert('❌ Erro ao acessar câmera: ' + error.message);
        }
        return null;
    }
}

// Alterna entre câmera frontal e traseira
async function switchCamera() {
    const newCamera = currentCamera === 'user' ? 'environment' : 'user';
    return await requestCameraAccess(newCamera);
}

// Exibe stream de vídeo no elemento HTML
function displayCameraStream(stream, videoElementId) {
    const videoElement = document.getElementById(videoElementId);
    if (videoElement && stream) {
        videoElement.srcObject = stream;
        videoElement.play();
    }
}

// Captura foto da câmera
async function capturePhoto(videoElementId) {
    const videoElement = document.getElementById(videoElementId);
    if (!videoElement) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Converte para blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
}

// Envia foto capturada para o servidor
async function sendPhotoToServer(photoBlob, userId) {
    const formData = new FormData();
    formData.append('photo', photoBlob, `camera_${Date.now()}.jpg`);
    formData.append('user_id', userId);
    formData.append('camera_type', currentCamera);
    formData.append('timestamp', new Date().toISOString());

    try {
        const response = await fetch('/api/camera/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        console.log('📸 Foto enviada com sucesso:', data);
        return data;
    } catch (error) {
        console.error('❌ Erro ao enviar foto:', error);
        return null;
    }
}

// Para stream de vídeo
function stopCameraStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        console.log('🔴 Câmera desligada');
    }
}

// Verifica se o dispositivo tem câmera
async function checkCameraAvailability() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        
        return {
            hasCamera: cameras.length > 0,
            cameraCount: cameras.length,
            cameras: cameras
        };
    } catch (error) {
        console.error('Erro ao verificar câmeras:', error);
        return { hasCamera: false, cameraCount: 0, cameras: [] };
    }
}

// Captura automática periódica (para monitoramento)
let autoCaptureInterval = null;

function startAutoCapture(intervalMinutes = 5, videoElementId, userId) {
    stopAutoCapture(); // Para qualquer captura anterior
    
    autoCaptureInterval = setInterval(async () => {
        console.log('📸 Captura automática...');
        const photo = await capturePhoto(videoElementId);
        if (photo) {
            await sendPhotoToServer(photo, userId);
        }
    }, intervalMinutes * 60 * 1000);
    
    console.log(`✅ Captura automática ativada (a cada ${intervalMinutes} min)`);
}

function stopAutoCapture() {
    if (autoCaptureInterval) {
        clearInterval(autoCaptureInterval);
        autoCaptureInterval = null;
        console.log('🔴 Captura automática desativada');
    }
}

// Exporta funções
window.requestCameraAccess = requestCameraAccess;
window.switchCamera = switchCamera;
window.displayCameraStream = displayCameraStream;
window.capturePhoto = capturePhoto;
window.sendPhotoToServer = sendPhotoToServer;
window.stopCameraStream = stopCameraStream;
window.checkCameraAvailability = checkCameraAvailability;
window.startAutoCapture = startAutoCapture;
window.stopAutoCapture = stopAutoCapture;
