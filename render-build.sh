
#!/usr/bin/env bash
set -o errexit

# Atualizar pip e instalar dependências
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Build completo! Aguardando inicialização..."
