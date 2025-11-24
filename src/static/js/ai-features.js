/*
 * Family Guardian 360° - AI Features JavaScript
 * Funcionalidades avançadas de IA
 * Desenvolvido por: João Layon - Desenvolvedor Full Stack
 */

async function loadAIInsights(userId) {
    try {
        const response = await fetch(`/api/ai/analyze/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            displayAIInsights(data);
        }
    } catch (error) {
        console.error('Erro ao carregar insights de IA:', error);
    }
}

function displayAIInsights(data) {
    const container = document.getElementById('ai-insights-container');
    if (!container) return;
    
    let html = '<div class="ai-insights">';
    
    if (data.risk_analysis.abnormal_trajectory.is_abnormal) {
        const risk = data.risk_analysis.abnormal_trajectory;
        html += `
            <div class="alert alert-${risk.severity}" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Trajeto Anormal Detectado
                </h4>
                <p style="margin: 0; font-size: 14px;">${risk.reason}</p>
                ${risk.distance_km ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Distância do padrão: ${risk.distance_km} km</p>` : ''}
            </div>
        `;
    }
    
    if (data.risk_analysis.prolonged_stop.is_prolonged_stop) {
        const stop = data.risk_analysis.prolonged_stop;
        html += `
            <div class="alert alert-warning" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-pause-circle"></i>
                    Parada Prolongada
                </h4>
                <p style="margin: 0; font-size: 14px;">Usuário parado por ${stop.minutes} minutos em local incomum</p>
            </div>
        `;
    }
    
    if (data.risk_analysis.dangerous_area.is_dangerous) {
        const area = data.risk_analysis.dangerous_area;
        html += `
            <div class="alert alert-danger" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626;">
                <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-shield-alt"></i>
                    Área de Risco Detectada
                </h4>
                <p style="margin: 0; font-size: 14px;">Usuário em: ${area.area_name}</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Nível de risco: ${area.risk_level}</p>
            </div>
        `;
    }
    
    if (data.risk_analysis.charging_analysis.is_suspicious) {
        const charging = data.risk_analysis.charging_analysis;
        html += `
            <div class="alert alert-info" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-charging-station"></i>
                    Carregamento Incomum
                </h4>
                <p style="margin: 0; font-size: 14px;">${charging.reason}</p>
            </div>
        `;
    }
    
    if (data.destination_prediction.has_prediction) {
        const pred = data.destination_prediction;
        html += `
            <div class="prediction-card" style="margin-bottom: 15px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <h4 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-route"></i>
                    Destino Previsto
                </h4>
                <p style="margin: 0; font-size: 14px;">Distância: ${pred.distance_km} km</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Tempo estimado: ${pred.eta_minutes} minutos</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Confiança: ${Math.round(pred.confidence * 100)}%</p>
            </div>
        `;
    }
    
    if (data.suggested_actions && data.suggested_actions.length > 0) {
        html += '<div class="suggested-actions" style="margin-top: 20px;">';
        html += '<h4 style="margin: 0 0 15px 0; font-size: 16px; color: #1f2937;">Ações Sugeridas pela IA:</h4>';
        
        data.suggested_actions.forEach(action => {
            const priorityColors = {
                'critical': '#dc2626',
                'high': '#ef4444',
                'medium': '#f59e0b',
                'low': '#10b981'
            };
            
            html += `
                <div class="action-card" style="padding: 12px; margin-bottom: 10px; background: white; border-left: 4px solid ${priorityColors[action.priority]}; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <p style="margin: 0; font-weight: 600; font-size: 14px; color: #1f2937;">${action.description}</p>
                    <span style="display: inline-block; margin-top: 6px; padding: 3px 10px; background: ${priorityColors[action.priority]}20; color: ${priorityColors[action.priority]}; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                        Prioridade: ${action.priority}
                    </span>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    if (html === '<div class="ai-insights">') {
        html += `
            <div style="text-align: center; padding: 30px; color: #10b981;">
                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 10px;"></i>
                <p style="margin: 0; font-size: 16px; font-weight: 600;">Tudo Normal</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #6b7280;">Nenhum comportamento de risco detectado</p>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadWidgets() {
    try {
        const response = await fetch('/api/widgets');
        const data = await response.json();
        
        if (data.widgets) {
            displayWidgets(data.widgets);
        }
    } catch (error) {
        console.error('Erro ao carregar widgets:', error);
    }
}

function displayWidgets(widgets) {
    const container = document.getElementById('widgets-container');
    if (!container) return;
    
    let html = '<div class="widgets-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';
    
    widgets.forEach(widget => {
        if (!widget.is_visible) return;
        
        html += `
            <div class="widget-card" data-widget-id="${widget.id}" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas ${widget.icon}" style="color: #3b82f6;"></i>
                        ${widget.name}
                    </h3>
                    <span class="widget-size-badge" style="padding: 4px 10px; background: #f3f4f6; border-radius: 12px; font-size: 11px; color: #6b7280;">
                        ${widget.size}
                    </span>
                </div>
                <p style="margin: 0 0 15px 0; font-size: 13px; color: #6b7280;">${widget.description}</p>
                <div id="widget-content-${widget.id}" class="widget-content" style="min-height: 100px;">
                    <p style="text-align: center; color: #9ca3af;">Carregando...</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    widgets.forEach(widget => {
        if (widget.is_visible) {
            loadWidgetData(widget.id);
        }
    });
}

async function loadWidgetData(widgetId) {
    try {
        const response = await fetch(`/api/widgets/${widgetId}/data`);
        const data = await response.json();
        
        const contentDiv = document.getElementById(`widget-content-${widgetId}`);
        if (!contentDiv) return;
        
        if (widgetId === 'battery_status' && data.members) {
            let html = '<div class="battery-list">';
            data.members.forEach(member => {
                const batteryLevel = member.battery_level || 0;
                const batteryIcon = batteryLevel > 75 ? 'fa-battery-full' :
                                   batteryLevel > 50 ? 'fa-battery-three-quarters' :
                                   batteryLevel > 25 ? 'fa-battery-half' : 'fa-battery-quarter';
                const batteryColor = batteryLevel > 50 ? '#10b981' :
                                    batteryLevel > 25 ? '#f59e0b' : '#ef4444';
                
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: #f9fafb; border-radius: 6px;">
                        <span style="font-weight: 500; font-size: 14px;">${member.full_name}</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas ${batteryIcon}" style="color: ${batteryColor}; font-size: 18px;"></i>
                            <span style="font-weight: 600; color: ${batteryColor};">${batteryLevel}%</span>
                            ${member.is_charging ? '<i class="fas fa-plug" style="color: #3b82f6; font-size: 12px;" title="Carregando"></i>' : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = '<p style="text-align: center; color: #9ca3af;">Sem dados disponíveis</p>';
        }
    } catch (error) {
        console.error(`Erro ao carregar dados do widget ${widgetId}:`, error);
    }
}

async function applyRelationshipProfile(profileType, targetUserId) {
    try {
        const response = await fetch(`/api/profiles/${profileType}/apply/${targetUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Perfil "${profileType}" aplicado com sucesso!`);
            return true;
        } else {
            alert(`Erro ao aplicar perfil: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error('Erro ao aplicar perfil:', error);
        alert('Erro ao aplicar perfil de relacionamento');
        return false;
    }
}

async function getTranquilityStatus(userId) {
    try {
        const response = await fetch(`/api/tranquility/${userId}`);
        const data = await response.json();
        
        const statusColors = {
            'safe': '#10b981',
            'ok': '#3b82f6',
            'attention': '#f59e0b',
            'concern': '#ef4444',
            'unknown': '#6b7280'
        };
        
        const statusIcons = {
            'safe': 'fa-check-circle',
            'ok': 'fa-info-circle',
            'attention': 'fa-exclamation-circle',
            'concern': 'fa-exclamation-triangle',
            'unknown': 'fa-question-circle'
        };
        
        return {
            html: `
                <div style="padding: 20px; background: ${statusColors[data.status]}20; border-left: 4px solid ${statusColors[data.status]}; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                        <i class="fas ${statusIcons[data.status]}" style="font-size: 32px; color: ${statusColors[data.status]};"></i>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; color: #1f2937;">${data.user_name}</h3>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">${data.message}</p>
                        </div>
                    </div>
                    ${data.battery_level ? `
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: #6b7280;">
                            <i class="fas fa-battery-three-quarters"></i>
                            <span>Bateria: ${data.battery_level}%</span>
                        </div>
                    ` : ''}
                </div>
            `,
            data: data
        };
    } catch (error) {
        console.error('Erro ao obter status de tranquilidade:', error);
        return null;
    }
}

window.loadAIInsights = loadAIInsights;
window.loadWidgets = loadWidgets;
window.applyRelationshipProfile = applyRelationshipProfile;
window.getTranquilityStatus = getTranquilityStatus;
