// Dashboard Customizável com Drag & Drop
class DashboardCustomizer {
    constructor() {
        this.widgets = [];
        this.gridStack = null;
        this.availableWidgets = [
            { id: 'battery', name: 'Bateria', icon: '🔋' },
            { id: 'locations', name: 'Localizações', icon: '📍' },
            { id: 'alerts', name: 'Alertas', icon: '🚨' },
            { id: 'messages', name: 'Mensagens', icon: '💬' },
            { id: 'map', name: 'Mapa', icon: '🗺️' },
            { id: 'activity', name: 'Atividade', icon: '📊' },
            { id: 'predictions', name: 'Previsões IA', icon: '🤖' },
            { id: 'safezones', name: 'Zonas Seguras', icon: '🛡️' }
        ];
        this.init();
    }
    
    init() {
        this.loadUserWidgets();
        this.setupEventListeners();
    }
    
    async loadUserWidgets() {
        try {
            const response = await fetch('/api/dashboard/widgets');
            const data = await response.json();
            
            if (data.success) {
                this.widgets = data.widgets || [];
                this.renderWidgets();
            }
        } catch (error) {
            console.error('Erro ao carregar widgets:', error);
            this.loadDefaultWidgets();
        }
    }
    
    loadDefaultWidgets() {
        this.widgets = [
            { id: 'battery', x: 0, y: 0, width: 6, height: 4 },
            { id: 'locations', x: 6, y: 0, width: 6, height: 4 },
            { id: 'map', x: 0, y: 4, width: 12, height: 8 },
            { id: 'alerts', x: 0, y: 12, width: 6, height: 4 },
            { id: 'activity', x: 6, y: 12, width: 6, height: 4 }
        ];
        this.renderWidgets();
    }
    
    renderWidgets() {
        const container = document.getElementById('dashboard-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.widgets.forEach(widget => {
            const widgetData = this.availableWidgets.find(w => w.id === widget.id);
            if (!widgetData) return;
            
            const widgetEl = document.createElement('div');
            widgetEl.className = 'dashboard-widget';
            widgetEl.dataset.widgetId = widget.id;
            widgetEl.innerHTML = `
                <div class="widget-header">
                    <span class="widget-icon">${widgetData.icon}</span>
                    <span class="widget-title">${widgetData.name}</span>
                    <button class="widget-remove" onclick="dashboardCustomizer.removeWidget('${widget.id}')">×</button>
                </div>
                <div class="widget-content" id="widget-${widget.id}">
                    <div class="widget-loading">Carregando...</div>
                </div>
            `;
            
            container.appendChild(widgetEl);
            
            this.loadWidgetContent(widget.id);
        });
        
        this.enableDragDrop();
    }
    
    enableDragDrop() {
        const widgets = document.querySelectorAll('.dashboard-widget');
        
        widgets.forEach(widget => {
            widget.draggable = true;
            
            widget.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', widget.dataset.widgetId);
                widget.classList.add('dragging');
            });
            
            widget.addEventListener('dragend', () => {
                widget.classList.remove('dragging');
            });
            
            widget.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            widget.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/html');
                const draggedWidget = document.querySelector(`[data-widget-id="${draggedId}"]`);
                const dropTarget = e.currentTarget;
                
                if (draggedWidget && dropTarget && draggedWidget !== dropTarget) {
                    const parent = dropTarget.parentNode;
                    const draggedIndex = Array.from(parent.children).indexOf(draggedWidget);
                    const dropIndex = Array.from(parent.children).indexOf(dropTarget);
                    
                    if (draggedIndex < dropIndex) {
                        parent.insertBefore(draggedWidget, dropTarget.nextSibling);
                    } else {
                        parent.insertBefore(draggedWidget, dropTarget);
                    }
                    
                    this.saveLayout();
                }
            });
        });
    }
    
    async loadWidgetContent(widgetId) {
        const contentEl = document.getElementById(`widget-${widgetId}`);
        if (!contentEl) return;
        
        try {
            switch (widgetId) {
                case 'battery':
                    await this.loadBatteryWidget(contentEl);
                    break;
                case 'locations':
                    await this.loadLocationsWidget(contentEl);
                    break;
                case 'alerts':
                    await this.loadAlertsWidget(contentEl);
                    break;
                case 'messages':
                    await this.loadMessagesWidget(contentEl);
                    break;
                case 'map':
                    await this.loadMapWidget(contentEl);
                    break;
                case 'activity':
                    await this.loadActivityWidget(contentEl);
                    break;
                case 'predictions':
                    await this.loadPredictionsWidget(contentEl);
                    break;
                case 'safezones':
                    await this.loadSafeZonesWidget(contentEl);
                    break;
            }
        } catch (error) {
            contentEl.innerHTML = '<div class="widget-error">Erro ao carregar</div>';
        }
    }
    
    async loadBatteryWidget(contentEl) {
        const response = await fetch('/api/family/members');
        const data = await response.json();
        
        if (data.success) {
            const members = data.members || [];
            const avgBattery = members.reduce((sum, m) => sum + (m.battery_level || 0), 0) / (members.length || 1);
            
            contentEl.innerHTML = `
                <div class="widget-stat">
                    <div class="stat-value">${avgBattery.toFixed(0)}%</div>
                    <div class="stat-label">Bateria Média</div>
                </div>
            `;
        }
    }
    
    async loadLocationsWidget(contentEl) {
        const response = await fetch('/api/locations/recent?limit=10');
        const data = await response.json();
        
        if (data.success) {
            const locations = data.locations || [];
            contentEl.innerHTML = `
                <div class="widget-stat">
                    <div class="stat-value">${locations.length}</div>
                    <div class="stat-label">Localizações Recentes</div>
                </div>
            `;
        }
    }
    
    async loadAlertsWidget(contentEl) {
        const response = await fetch('/api/alerts/recent?limit=5');
        const data = await response.json();
        
        if (data.success) {
            const alerts = data.alerts || [];
            contentEl.innerHTML = `
                <div class="widget-stat">
                    <div class="stat-value">${alerts.length}</div>
                    <div class="stat-label">Alertas Ativos</div>
                </div>
            `;
        }
    }
    
    async loadMessagesWidget(contentEl) {
        const response = await fetch('/api/messages/recent?limit=5');
        const data = await response.json();
        
        if (data.success) {
            const messages = data.messages || [];
            contentEl.innerHTML = `
                <div class="widget-stat">
                    <div class="stat-value">${messages.length}</div>
                    <div class="stat-label">Mensagens Não Lidas</div>
                </div>
            `;
        }
    }
    
    async loadMapWidget(contentEl) {
        contentEl.innerHTML = '<div id="dashboard-map" style="height: 100%; width: 100%;"></div>';
    }
    
    async loadActivityWidget(contentEl) {
        const response = await fetch('/api/stats/activity');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats || {};
            contentEl.innerHTML = `
                <div class="widget-stats-grid">
                    <div class="mini-stat">
                        <span class="mini-stat-value">${stats.total_users || 0}</span>
                        <span class="mini-stat-label">Usuários</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-stat-value">${stats.active_today || 0}</span>
                        <span class="mini-stat-label">Ativos Hoje</span>
                    </div>
                </div>
            `;
        }
    }
    
    async loadPredictionsWidget(contentEl) {
        const response = await fetch('/api/ml/predictions');
        const data = await response.json();
        
        if (data.success && data.predictions) {
            const predictions = data.predictions;
            contentEl.innerHTML = `
                <div class="widget-prediction">
                    <div class="prediction-title">🎯 Próximo Destino</div>
                    <div class="prediction-confidence">Confiança: ${(predictions.confidence * 100).toFixed(0)}%</div>
                </div>
            `;
        } else {
            contentEl.innerHTML = '<div class="widget-info">Dados insuficientes</div>';
        }
    }
    
    async loadSafeZonesWidget(contentEl) {
        const response = await fetch('/api/safe-zones');
        const data = await response.json();
        
        if (data.success) {
            const zones = data.safe_zones || [];
            contentEl.innerHTML = `
                <div class="widget-stat">
                    <div class="stat-value">${zones.length}</div>
                    <div class="stat-label">Zonas Ativas</div>
                </div>
            `;
        }
    }
    
    addWidget(widgetId) {
        if (this.widgets.find(w => w.id === widgetId)) {
            alert('Widget já adicionado!');
            return;
        }
        
        this.widgets.push({
            id: widgetId,
            x: 0,
            y: this.widgets.length * 4,
            width: 6,
            height: 4
        });
        
        this.renderWidgets();
        this.saveLayout();
    }
    
    removeWidget(widgetId) {
        this.widgets = this.widgets.filter(w => w.id !== widgetId);
        this.renderWidgets();
        this.saveLayout();
    }
    
    async saveLayout() {
        const layout = this.widgets.map((w, index) => ({
            id: w.id,
            position: index
        }));
        
        try {
            await fetch('/api/dashboard/widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ widgets: layout })
            });
        } catch (error) {
            console.error('Erro ao salvar layout:', error);
        }
    }
    
    setupEventListeners() {
        const addWidgetBtn = document.getElementById('add-widget-btn');
        if (addWidgetBtn) {
            addWidgetBtn.addEventListener('click', () => this.showWidgetSelector());
        }
    }
    
    showWidgetSelector() {
        const existingIds = this.widgets.map(w => w.id);
        const available = this.availableWidgets.filter(w => !existingIds.includes(w.id));
        
        if (available.length === 0) {
            alert('Todos os widgets já foram adicionados!');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'widget-selector-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Adicionar Widget</h3>
                <div class="widget-list">
                    ${available.map(w => `
                        <button class="widget-option" onclick="dashboardCustomizer.addWidget('${w.id}'); this.closest('.widget-selector-modal').remove();">
                            <span class="widget-icon">${w.icon}</span>
                            <span>${w.name}</span>
                        </button>
                    `).join('')}
                </div>
                <button onclick="this.closest('.widget-selector-modal').remove()">Cancelar</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}

let dashboardCustomizer;
document.addEventListener('DOMContentLoaded', () => {
    dashboardCustomizer = new DashboardCustomizer();
});
