#!/bin/bash

# Script para atualizar o componente node-red-contrib-mcp-tools no container Docker

echo "🔄 Atualizando componente node-red-contrib-mcp-tools..."

# Verificar se está usando Docker Compose ou container individual
if docker ps | grep -q "node-red-mcp"; then
    echo "📦 Detectado Docker Compose"
    CONTAINER_NAME="node-red-mcp"
    COMPONENT_PATH="/data/node_modules/node-red-contrib-mcp-tools"
    
    # Copiar arquivos atualizados para o container
    echo "📁 Copiando arquivos atualizados..."
    docker cp node-red-contrib-mcp-tools/mcp-tools.js $CONTAINER_NAME:$COMPONENT_PATH/
    docker cp node-red-contrib-mcp-tools/mcp-tools.html $CONTAINER_NAME:$COMPONENT_PATH/
    
    # Verificar se os arquivos foram atualizados
    echo "✅ Verificando atualizações..."
    docker exec $CONTAINER_NAME grep -q "mcpServerEnvs" $COMPONENT_PATH/mcp-tools.js && echo "✅ mcp-tools.js atualizado" || echo "❌ mcp-tools.js não foi atualizado"
    docker exec $CONTAINER_NAME grep -q "mcpServerEnvs" $COMPONENT_PATH/mcp-tools.html && echo "✅ mcp-tools.html atualizado" || echo "❌ mcp-tools.html não foi atualizado"
    
elif docker ps | grep -q "test-secure"; then
    echo "📦 Detectado container individual"
    CONTAINER_NAME="test-secure"
    COMPONENT_PATH="/data/node_modules/node-red-contrib-mcp-tools"
    
    # Verificar se o container está rodando
    if ! docker ps | grep -q $CONTAINER_NAME; then
        echo "⚠️  Container $CONTAINER_NAME não está rodando. Iniciando..."
        docker start $CONTAINER_NAME
        sleep 3
    fi
    
    # Copiar arquivos atualizados
    echo "📁 Copiando arquivos atualizados..."
    docker cp node-red-contrib-mcp-tools/mcp-tools.js $CONTAINER_NAME:$COMPONENT_PATH/
    docker cp node-red-contrib-mcp-tools/mcp-tools.html $CONTAINER_NAME:$COMPONENT_PATH/
    
    # Verificar se os arquivos foram atualizados
    echo "✅ Verificando atualizações..."
    docker exec $CONTAINER_NAME grep -q "mcpServerEnvs" $COMPONENT_PATH/mcp-tools.js && echo "✅ mcp-tools.js atualizado" || echo "❌ mcp-tools.js não foi atualizado"
    docker exec $CONTAINER_NAME grep -q "mcpServerEnvs" $COMPONENT_PATH/mcp-tools.html && echo "✅ mcp-tools.html atualizado" || echo "❌ mcp-tools.html não foi atualizado"
    
else
    echo "📁 Atualizando arquivos diretamente no volume..."
    # Atualizar arquivos diretamente no volume (node_modules onde o Node-RED realmente usa)
    cp node-red-contrib-mcp-tools/mcp-tools.js node-red-docker/node_red_data/node_modules/node-red-contrib-mcp-tools/
    cp node-red-contrib-mcp-tools/mcp-tools.html node-red-docker/node_red_data/node_modules/node-red-contrib-mcp-tools/
    
    # Verificar se os arquivos foram atualizados
    echo "✅ Verificando atualizações..."
    grep -q "mcpServerEnvs" node-red-docker/node_red_data/node_modules/node-red-contrib-mcp-tools/mcp-tools.js && echo "✅ mcp-tools.js atualizado" || echo "❌ mcp-tools.js não foi atualizado"
    grep -q "mcpServerEnvs" node-red-docker/node_red_data/node_modules/node-red-contrib-mcp-tools/mcp-tools.html && echo "✅ mcp-tools.html atualizado" || echo "❌ mcp-tools.html não foi atualizado"
fi

echo "🎉 Componente atualizado com sucesso!"
echo "💡 Acesse o Node-RED para ver as mudanças: http://localhost:1899 (Docker Compose) ou http://localhost:1880 (container individual)" 