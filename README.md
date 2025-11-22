# 🌐 Family Guardian 360°

**O melhor sistema profissional de gestão e proteção familiar**

Sistema moderno, elegante e totalmente seguro, capaz de conectar pessoas da família e fornecer informações úteis em tempo real, SEM invadir privacidade, sempre baseado em consentimento mútuo.

## 👨‍💻 Desenvolvedor

**João Layon** - Desenvolvedor Full Stack

## ✨ Principais Funcionalidades

### 📍 Localização em Tempo Real
- Mostra onde cada membro está no mapa com atualização automática
- Visualização interativa com Leaflet.js
- Precisão baseada na Geolocation API do navegador
- Histórico de localizações com visualização de trajetos

### 🔋 Status do Dispositivo
- Porcentagem da bateria em tempo real via Battery API
- Aviso automático quando bateria está abaixo do limite configurado
- Indicação de status de carregamento

### 🔒 Segurança e Privacidade
- Criptografia de senhas com bcrypt
- Sistema de permissões granulares
- Modo "Tranquilidade" para privacidade máxima
- Dados de localização mantidos apenas por 24 horas

### 🚨 Botão de Pânico
- Ativação rápida de emergência
- Envia localização exata para todos os membros da família
- Alertas imediatos com notificações

### 👨‍👩‍👧‍👦 Gestão Familiar
- Criação de múltiplas famílias
- Adição de membros por email
- Diferentes níveis de permissão
- Sistema de mensagens em tempo real

### 💬 Mensagens
- Sistema de chat por família
- Histórico de mensagens
- Mensagens de emergência com destaque especial

## 🛠️ Tecnologias Utilizadas

### Backend
- **Flask** - Framework web moderno e leve
- **SQLite3** - Banco de dados integrado (sem SQLAlchemy)
- **bcrypt** - Criptografia de senhas
- **Gunicorn** - Servidor WSGI para produção

### Frontend
- **HTML5** - Estrutura semântica e responsiva
- **CSS3** - Design moderno com Flexbox e Grid
- **JavaScript (ES6+)** - Funcionalidades interativas
- **Leaflet.js** - Mapas interativos
- **Geolocation API** - Localização em tempo real
- **Battery API** - Monitoramento de bateria

## 🚀 Como Executar Localmente

1. **Clone o repositório**
```bash
git clone <seu-repositorio>
cd family-guardian-360
```

2. **Instale as dependências**
```bash
pip install -r requirements.txt
```

3. **Execute o sistema**
```bash
python main.py
```

4. **Acesse no navegador**
```
http://localhost:5000
```

## 📦 Deploy no Render

Este projeto está otimizado para deploy no Render:

1. Faça push do código para o GitHub
2. Conecte seu repositório ao Render
3. O arquivo `render.yaml` já está configurado
4. O deploy será automático!

## 🗂️ Estrutura do Projeto

```
family-guardian-360/
├── src/
│   ├── database/
│   │   ├── schema.sql      # Schema do banco de dados
│   │   └── db.py           # Gerenciador de conexões
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css   # Estilos profissionais
│   │   ├── js/
│   │   │   ├── app.js      # Funções principais
│   │   │   ├── dashboard.js
│   │   │   ├── map.js
│   │   │   ├── messages.js
│   │   │   └── settings.js
│   │   └── images/
│   ├── templates/
│   │   ├── base.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard.html
│   │   ├── map.html
│   │   ├── messages.html
│   │   └── settings.html
│   └── app.py              # Aplicação Flask principal
├── main.py                 # Ponto de entrada
├── requirements.txt        # Dependências Python
├── render.yaml            # Configuração Render
└── README.md
```

## 🔐 Segurança

- Senhas criptografadas com bcrypt
- Sessões seguras com Flask
- Proteção CSRF
- Sanitização de inputs
- Dados sensíveis em variáveis de ambiente

## 📱 Funcionalidades Mobile

O sistema é totalmente responsivo e funcional em dispositivos móveis:
- Layout adaptativo para telas pequenas
- Touch-friendly interface
- Geolocalização nativa do dispositivo
- Status de bateria do celular

## 🌟 Diferenciais

✅ **100% Funcional** - Não usa dados mockados
✅ **Geolocalização Real** - Via JavaScript Geolocation API
✅ **Battery API** - Monitoramento real de bateria
✅ **Design Profissional** - Interface moderna e intuitiva
✅ **Performance** - Otimizado para Render
✅ **Privacidade** - Baseado em consentimento mútuo

## 📄 Licença

Desenvolvido por **João Layon** - Desenvolvedor Full Stack

---

**Family Guardian 360°** - Conectando famílias com segurança e tecnologia 🛡️
