// Dark Mode para Family Guardian 360°

const DARK_MODE_KEY = 'family-guardian-dark-mode';

// Inicializa modo escuro
function initDarkMode() {
    const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
    
    if (isDarkMode) {
        enableDarkMode();
    }
    
    // Adiciona botão de alternância se não existir
    addDarkModeToggle();
}

// Ativa modo escuro
function enableDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(DARK_MODE_KEY, 'true');
    updateDarkModeIcon(true);
}

// Desativa modo escuro
function disableDarkMode() {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(DARK_MODE_KEY, 'false');
    updateDarkModeIcon(false);
}

// Alterna modo escuro
function toggleDarkMode() {
    const isDarkMode = document.documentElement.hasAttribute('data-theme');
    
    if (isDarkMode) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

// Atualiza ícone do botão
function updateDarkModeIcon(isDark) {
    const icon = document.getElementById('darkModeIcon');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Adiciona botão de alternância
function addDarkModeToggle() {
    const existingToggle = document.getElementById('darkModeToggle');
    if (existingToggle) return;
    
    const toggle = document.createElement('button');
    toggle.id = 'darkModeToggle';
    toggle.className = 'dark-mode-toggle';
    toggle.setAttribute('aria-label', 'Alternar modo escuro');
    toggle.innerHTML = '<i id="darkModeIcon" class="fas fa-moon"></i>';
    toggle.onclick = toggleDarkMode;
    
    document.body.appendChild(toggle);
    
    const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
    updateDarkModeIcon(isDarkMode);
}

// Inicializa quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
    initDarkMode();
}

// Exporta funções
window.toggleDarkMode = toggleDarkMode;
