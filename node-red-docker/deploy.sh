#!/bin/bash

# Node-RED MCP Server - Deploy Script
# This script automates deployment to Railway

set -e

echo "🚀 Node-RED MCP Server - Deploy Script"
echo "======================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found!"
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Check if logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "🔐 Logging in to Railway..."
    railway login
fi

# Run from repo root so Docker build context includes mcp-server/v1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Check if Railway project exists
if [ ! -f "railway.json" ]; then
    echo "📁 Initializing Railway project..."
    railway init
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file..."
    cp .env.example .env
    echo "📝 Please edit the .env file with your configurations"
    echo "   - ADMIN_PASSWORD: Node-RED admin password"
    echo "   - OPENAI_API_KEY: Your OpenAI API key (optional)"
    read -p "Press Enter after configuring .env..."
fi

# Deploy to Railway using repo root as context
echo "🚀 Deploying to Railway..."
railway up --dockerfile node-red-docker/Dockerfile

# Get project URL
echo "🔗 Getting project URL..."
PROJECT_URL=$(railway status --json | jq -r '.url' 2>/dev/null || echo "Check manually in Railway dashboard")

echo ""
echo "✅ Deployment completed!"
echo "🌐 Project URL: $PROJECT_URL"
echo ""
echo "⚠️  IMPORTANT - Persistent disk (one-time setup):"
echo "   Railway volumes cannot be configured in railway.toml."
echo "   Set it up once via the dashboard:"
echo "   1. Railway dashboard → your service → Volumes tab"
echo "   2. Add volume → mount path: /data"
echo "   This persists your flows across every future redeploy."
echo ""
echo "📋 Next steps:"
echo "1. Set up the persistent volume (see above)"
echo "2. Access: $PROJECT_URL"
echo "3. Login: admin / value of ADMIN_PASSWORD env var"
echo ""
echo "📚 Docs: https://docs.railway.app/reference/volumes" 