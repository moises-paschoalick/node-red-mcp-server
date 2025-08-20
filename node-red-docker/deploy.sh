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

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

# Get project URL
echo "🔗 Getting project URL..."
PROJECT_URL=$(railway status --json | jq -r '.url' 2>/dev/null || echo "Check manually in Railway dashboard")

echo ""
echo "✅ Deployment completed!"
echo "🌐 Project URL: $PROJECT_URL"
echo ""
echo "📋 Next steps:"
echo "1. Access the URL above"
echo "2. Login with:"
echo "   - Username: admin"
echo "   - Password: value of ADMIN_PASSWORD variable"
echo "3. Configure the MCP Tools node"
echo "4. Start creating your flows!"
echo ""
echo "📚 For more information, see:"
echo "   - Template README: node-red-docker/README.md"
echo "   - Railway documentation: https://docs.railway.app" 