// Dashboard com Gráficos - Family Guardian 360°
// Usando Chart.js para visualizações

let batteryChart;
let activityChart;
let locationHistoryChart;

// Inicializa dashboard
async function initDashboard() {
    await loadDashboardData();
}

// Carrega dados do dashboard
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();
        
        if (data.success) {
            renderBatteryChart(data.battery_stats);
            renderActivityChart(data.activity_stats);
            renderLocationHistoryChart(data.location_history);
            updateDashboardSummary(data.summary);
        }
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
    }
}

// Gráfico de bateria
function renderBatteryChart(batteryData) {
    const ctx = document.getElementById('batteryChart');
    if (!ctx) return;
    
    if (batteryChart) {
        batteryChart.destroy();
    }
    
    batteryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: batteryData.map(d => d.time),
            datasets: [{
                label: 'Nível de Bateria (%)',
                data: batteryData.map(d => d.level),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        }
    });
}

// Gráfico de atividade
function renderActivityChart(activityData) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: activityData.map(d => d.member_name),
            datasets: [{
                label: 'Localizações Atualizadas',
                data: activityData.map(d => d.updates_count),
                backgroundColor: '#2196F3',
                borderColor: '#1976D2',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Gráfico de histórico de localizações
function renderLocationHistoryChart(locationData) {
    const ctx = document.getElementById('locationHistoryChart');
    if (!ctx) return;
    
    if (locationHistoryChart) {
        locationHistoryChart.destroy();
    }
    
    locationHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: locationData.map(d => d.hour),
            datasets: [{
                label: 'Atualizações de Localização',
                data: locationData.map(d => d.count),
                borderColor: '#FF9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Atualiza resumo do dashboard
function updateDashboardSummary(summary) {
    const elements = {
        totalMembers: document.getElementById('totalMembers'),
        activeMembers: document.getElementById('activeMembers'),
        totalAlerts: document.getElementById('totalAlerts'),
        avgBattery: document.getElementById('avgBattery')
    };
    
    if (elements.totalMembers) {
        elements.totalMembers.textContent = summary.total_members || 0;
    }
    if (elements.activeMembers) {
        elements.activeMembers.textContent = summary.active_members || 0;
    }
    if (elements.totalAlerts) {
        elements.totalAlerts.textContent = summary.total_alerts || 0;
    }
    if (elements.avgBattery) {
        elements.avgBattery.textContent = (summary.avg_battery || 0) + '%';
    }
}

// Exporta relatório em PDF
async function exportDashboardPDF() {
    try {
        const response = await fetch('/api/export/dashboard-pdf', {
            method: 'POST'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `relatorio-family-guardian-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            alert('Erro ao exportar PDF');
        }
    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        alert('Erro ao exportar PDF');
    }
}

// Exporta dados em CSV
async function exportDataCSV() {
    try {
        const response = await fetch('/api/export/locations-csv');
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `localizacoes-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            alert('Erro ao exportar CSV');
        }
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        alert('Erro ao exportar CSV');
    }
}

// Atualiza dashboard periodicamente
setInterval(() => {
    if (document.getElementById('batteryChart')) {
        loadDashboardData();
    }
}, 60000); // Atualiza a cada 1 minuto

// Exporta funções
window.initDashboard = initDashboard;
window.exportDashboardPDF = exportDashboardPDF;
window.exportDataCSV = exportDataCSV;
