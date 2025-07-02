# Node-RED MCP Server Template for Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/deploy/node-red-mcp)

> **🚀 Railway-specific deployment template** - Node-RED configured with MCP (Model Context Protocol) for LLM integration, optimized for Railway platform

## 📋 Project Description

This template provides a complete and pre-configured Node-RED environment with **Model Context Protocol (MCP)** support, specifically designed for Railway deployment. It allows your flows to interact directly with language models like OpenAI's GPT-4.

### 🎯 What this template solves

- **LLM Integration**: Connects Node-RED to AI models via MCP
- **Railway-Optimized Deployment**: One-click to have Node-RED running on Railway
- **Automatic Configuration**: Everything pre-configured and ready to use
- **Railway Infrastructure**: Runs on Railway with high availability and automatic scaling

## ⚡ Main Features

- ✅ **Node-RED 4.0.0** with complete web interface
- ✅ **MCP Tools Node** pre-installed and configured
- ✅ **OpenAI Support** integrated
- ✅ **Automatic deployment** on Railway
- ✅ **Configuration via environment variables**
- ✅ **Centralized logs** and monitoring

## 🛠️ Prerequisites

- [Railway](https://railway.app) account (free)
- OpenAI API key (optional, for LLM features)
- Modern web browser

## 🚀 How to Use

### Automatic Deployment (Recommended)

1. **Click the "Deploy on Railway" button** above
2. **Configure environment variables** (see Configuration section)
3. **Wait for deployment** (2-3 minutes)
4. **Access your instance** via URL provided by Railway

### 🔐 How to Get Admin Password on Railway

After deployment, the admin password is generated automatically. To find it:

1. **Access Railway Dashboard**
2. **Click on your project**
3. **Go to "Deployments" tab**
4. **Click on the latest deployment**
5. **Go to "Logs" tab**
6. **Look for this block:**
   ```
   ============================================================
   🚀 NODE-RED ADMIN CREDENTIALS
   ============================================================
   👤 Username: admin
   🔑 Password: [GENERATED_PASSWORD]
   ============================================================
   ```

**💡 Tip:** The password is generated automatically on each new deployment. If you want a fixed password, set the `ADMIN_PASSWORD` environment variable on Railway.

### Manual Deployment

```bash
# Clone the repository
git clone https://github.com/moises-paschoalick/node-red-mcp-server
cd node-red-docker

# Deploy to Railway via CLI
railway login
railway init
railway up
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ADMIN_PASSWORD` | Node-RED admin password (if not defined, will be generated automatically) | Generated automatically | ❌ |
| `OPENAI_API_KEY` | OpenAI API key | - | ❌ |

### Ports

- **1880**: Node-RED web interface

### Volumes

- `/data`: Persistent Node-RED data
  - Flows and configurations
  - Custom node modules
  - Logs and backups


## 🔧 Initial Configuration

### 1. First Access

1. Access the URL provided by Railway
2. Login with:
   - **Username**: `admin`
   - **Password**: Get the password from Railway logs (see "How to Get Admin Password on Railway" section above)

**💡 Note:** The password is generated automatically on each deployment. If you set `ADMIN_PASSWORD` as an environment variable, use that password instead of the automatically generated one.

### 2. Configure MCP Tools

For detailed instructions on how to configure MCP Tools and examples, see the [main README](../README.md#how-to-run).

**Quick setup:**
1. Install the `node-red-contrib-mcp-tools` node from the palette
2. Configure with your OpenAI API key
3. Set up your MCP server connection

## 📈 Monitoring

### Available Metrics

- **CPU Usage**: Via Railway Dashboard
- **Memory Usage**: Via Railway Dashboard
- **Network Traffic**: Via Railway Dashboard
- **Application Logs**: Via Railway Logs

### Alerts

Configure alerts in Railway for:
- CPU usage > 80%
- Memory usage > 80%
- Application errors
- Response time > 5s

## 🔄 Backup and Restore

### Automatic Backup

Railway automatically backs up volumes. For manual backup:

```bash
# Backup data
docker exec node-red-mcp tar -czf /tmp/backup.tar.gz /data

# Download backup
docker cp node-red-mcp:/tmp/backup.tar.gz ./backup.tar.gz
```

### Restore

```bash
# Upload backup
docker cp ./backup.tar.gz node-red-mcp:/tmp/

# Restore data
docker exec node-red-mcp tar -xzf /tmp/backup.tar.gz -C /
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


**⭐ If this template was helpful, consider giving a star to the repository!**