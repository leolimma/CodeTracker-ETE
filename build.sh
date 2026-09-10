#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== Verificando ambiente de compilação ==="

# Verifica se o Node.js e npm estão disponíveis no ambiente nativo do Render
if ! command -v npm &> /dev/null; then
  echo "Node.js / npm não encontrado no container nativo Python. Baixando Node.js LTS standalone..."
  NODE_VERSION="20.18.0"
  NODE_DIR="$HOME/.local/node-v$NODE_VERSION"

  if [ ! -f "$NODE_DIR/bin/npm" ]; then
    mkdir -p "$NODE_DIR"
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C "$NODE_DIR" --strip-components=1
  fi

  export PATH="$NODE_DIR/bin:$PATH"
fi

echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"

echo "=== Instalando dependências do frontend (React) ==="
npm install

echo "=== Compilando o frontend (React SPA) ==="
npm run build

echo "=== Instalando dependências do backend (Python) ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Build finalizado com sucesso! ==="
