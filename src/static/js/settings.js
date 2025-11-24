/*
 * Family Guardian 360° - Settings JavaScript
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        if (data.settings) {
            document.getElementById('shareLocation').checked = data.settings.share_location;
            document.getElementById('shareBattery').checked = data.settings.share_battery_status;
            document.getElementById('notificationEnabled').checked = data.settings.notification_enabled;
            document.getElementById('privacyMode').value = data.settings.privacy_mode;
            document.getElementById('updateInterval').value = data.settings.location_update_interval;
            document.getElementById('batteryThreshold').value = data.settings.battery_alert_threshold;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        share_location: document.getElementById('shareLocation').checked ? 1 : 0,
        share_battery_status: document.getElementById('shareBattery').checked ? 1 : 0,
        notification_enabled: document.getElementById('notificationEnabled').checked ? 1 : 0,
        privacy_mode: document.getElementById('privacyMode').value,
        location_update_interval: parseInt(document.getElementById('updateInterval').value),
        battery_alert_threshold: parseInt(document.getElementById('batteryThreshold').value)
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Configurações salvas com sucesso!');
        } else {
            alert('❌ Erro ao salvar configurações');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao salvar configurações');
    }
});

async function checkSuperAdminStatus() {
    try {
        const response = await fetch('/api/can-become-super-admin');
        const data = await response.json();
        
        if (data.can_promote) {
            const card = document.getElementById('superAdminCard');
            if (card) {
                card.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Erro ao verificar status do Super Admin:', error);
    }
}

async function becomeSuperAdmin() {
    if (!confirm('Você será promovido a Super Administrador e terá acesso total ao sistema.\n\nDeseja continuar?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/promote-to-super-admin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            if (data.redirect) {
                window.location.href = data.redirect;
            } else {
                window.location.reload();
            }
        } else {
            alert(data.message);
            document.getElementById('superAdminCard').style.display = 'none';
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao promover usuário. Tente novamente.');
    }
}

// loadUserProfile() agora está em app.js (carregado globalmente)

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    checkSuperAdminStatus();
});
