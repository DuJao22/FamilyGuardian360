/*
 * Family Guardian 360° - Messages JavaScript
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

let userFamilies = [];

async function loadUserFamilies() {
    try {
        const response = await fetch('/api/families');
        const data = await response.json();
        
        if (data.families && data.families.length > 0) {
            userFamilies = data.families;
            loadMessages();
        } else {
            document.getElementById('messagesList').innerHTML = 
                '<p class="text-muted text-center">Você não está em nenhuma família ainda</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar famílias:', error);
    }
}

async function loadMessages() {
    if (!userFamilies || userFamilies.length === 0) {
        document.getElementById('messagesList').innerHTML = 
            '<p class="text-muted text-center">Você não está em nenhuma família ainda</p>';
        return;
    }
    
    try {
        // Buscar mensagens de todas as famílias do usuário
        const allMessages = [];
        
        for (const family of userFamilies) {
            const response = await fetch(`/api/messages?family_id=${family.id}`);
            const data = await response.json();
            
            if (data.messages && data.messages.length > 0) {
                // Adicionar o nome da família a cada mensagem
                data.messages.forEach(msg => {
                    msg.family_name = family.name;
                    allMessages.push(msg);
                });
            }
        }
        
        const messagesList = document.getElementById('messagesList');
        
        if (allMessages.length > 0) {
            // Ordenar mensagens por data
            allMessages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
            
            messagesList.innerHTML = allMessages.map(msg => `
                <div class="message-item" style="padding: 15px; margin-bottom: 10px; background: #f8fafc; border-radius: 8px; border-left: 4px solid var(--secondary-color);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <strong>${msg.full_name}</strong>
                        <span style="background: var(--secondary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                            ${msg.family_name}
                        </span>
                        <small style="color: var(--text-secondary); margin-left: auto;">
                            ${new Date(msg.sent_at).toLocaleString('pt-BR')}
                        </small>
                    </div>
                    <p style="margin: 0;">${msg.message_text}</p>
                </div>
            `).join('');
            
            messagesList.scrollTop = messagesList.scrollHeight;
        } else {
            messagesList.innerHTML = '<p class="text-muted text-center">Nenhuma mensagem ainda</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
    }
}

document.getElementById('messageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userFamilies || userFamilies.length === 0) {
        alert('Você não está em nenhuma família');
        return;
    }
    
    const messageText = document.getElementById('messageText').value;
    
    // Se o usuário tiver apenas uma família, envia para ela
    // Se tiver múltiplas, envia para todas
    try {
        for (const family of userFamilies) {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    family_id: family.id,
                    message: messageText
                })
            });
        }
        
        document.getElementById('messageText').value = '';
        loadMessages();
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao enviar mensagem');
    }
});

// loadUserProfile() agora está em app.js (carregado globalmente)

document.addEventListener('DOMContentLoaded', function() {
    loadUserFamilies();
    
    // Auto-atualizar mensagens a cada 3 segundos
    setInterval(() => {
        if (userFamilies && userFamilies.length > 0) {
            loadMessages();
        }
    }, 3000);
});
