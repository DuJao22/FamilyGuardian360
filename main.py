"""
Family Guardian 360° - Ponto de entrada principal
Desenvolvido por: João Layon - Desenvolvedor Full Stack
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from database.db import init_database
from app import app, socketio

if __name__ == '__main__':
    if not os.path.exists('family_guardian.db'):
        print("Inicializando banco de dados...")
        init_database()
        print("✅ Banco de dados criado com sucesso!")
    
    print("🚀 Iniciando Family Guardian 360°...")
    print("📍 Sistema de Geolocalização em Tempo Real")
    print("⚡ WebSocket habilitado para atualizações em tempo real")
    print("🔒 Desenvolvido por: João Layon - Desenvolvedor Full Stack")
    print("")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
