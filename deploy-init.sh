#!/bin/bash
# Script para inicializar deploy a DigitalOcean
# Uso: bash deploy-init.sh

echo "==============================================="
echo "🚀 INICIALIZAR DEPLOY - Centro de Cultura Física"
echo "==============================================="
echo ""
echo "📋 VERIFICANDO REQUISITOS..."
echo ""

# Verificar Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js no instalado"
    exit 1
fi

# Verificar npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm no instalado"
    exit 1
fi

# Verificar estructura
echo ""
echo "📁 VERIFICANDO ESTRUCTURA..."

files=(
    "backend/server.js"
    "backend/package.json"
    "src/App.jsx"
    "package.json"
)

all_good=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Falta: $file"
        all_good=false
    fi
done

echo ""
echo "==============================================="

if [ "$all_good" = true ]; then
    echo "✅ TODO LISTO PARA DEPLOY"
    echo ""
    echo "📝 SIGUIENTES PASOS:"
    echo ""
    echo "1️⃣  Crear cuenta DigitalOcean:"
    echo "    https://www.digitalocean.com/"
    echo ""
    echo "2️⃣  Crear PostgreSQL Managed Database"
    echo ""
    echo "3️⃣  Obtener CONNECTION_STRING"
    echo ""
    echo "4️⃣  Conectar GitHub a DigitalOcean"
    echo ""
    echo "5️⃣  Agregar variables de entorno"
    echo ""
    echo "6️⃣  Deploy!"
    echo ""
else
    echo "❌ Soluciona los errores anteriores"
    exit 1
fi

echo "==============================================="
echo ""
