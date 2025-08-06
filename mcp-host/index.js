import express from 'express';
import cors from 'cors';
import { MCPClient } from '../mcp-client/build/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Armazenar instâncias de clientes MCP por sessão
const mcpClients = new Map();

// Função para obter ou criar cliente MCP
function getMCPClient(sessionId, apiKey, serverCommand, serverArgs, serverEnvs) {
  const clientKey = `${sessionId}_${apiKey}_${serverCommand}_${serverArgs.join('_')}`;
  
  if (!mcpClients.has(clientKey)) {
    const client = new MCPClient(apiKey);
    mcpClients.set(clientKey, {
      client,
      connected: false,
      serverCommand,
      serverArgs,
      serverEnvs,
      lastActivity: Date.now()
    });
  }
  
  const clientInfo = mcpClients.get(clientKey);
  clientInfo.lastActivity = Date.now();
  
  return clientInfo;
}

// Endpoint principal para executar o agente
app.post('/execute', async (req, res) => {
  try {
    const { 
      prompt, 
      apiKey, 
      serverCommand = 'node', 
      serverArgs = ['../mcp-server-demo/influxdb3_mcp_server/build/index.js'],
      serverEnvs = {},
      sessionId = 'default'
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt é obrigatório'
      });
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key da OpenAI é obrigatória'
      });
    }

    console.log(`Executando prompt: ${prompt}`);
    console.log(`Comando do servidor: ${serverCommand} ${serverArgs.join(' ')}`);

    // Obter cliente MCP
    const mcpClientInfo = getMCPClient(sessionId, apiKey, serverCommand, serverArgs, serverEnvs);
    
    // 🔍 DEBUG: Adicionar logs aqui
    console.log('🔍 DEBUG - Dados recebidos no mcp-host:');
    console.log('  - serverCommand:', serverCommand);
    console.log('  - serverArgs:', serverArgs);
    console.log('  - serverEnvs:', serverEnvs);
    console.log('  - Tipo serverEnvs:', typeof serverEnvs);
    console.log('  - Chaves serverEnvs:', Object.keys(serverEnvs || {}));
    
    // Conectar se necessário
    if (!mcpClientInfo.connected) {
      try {
        await mcpClientInfo.client.connect(serverCommand, serverArgs, serverEnvs);
        mcpClientInfo.connected = true;
      } catch (error) {
        console.error('Erro ao conectar ao servidor MCP:', error);
        
        // Tentar reconectar uma vez para servidores remotos
        if (serverCommand.includes('npx')) {
          console.log('Tentando reconectar ao servidor remoto...');
          try {
            await mcpClientInfo.client.disconnect();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
            await mcpClientInfo.client.connect(serverCommand, serverArgs, serverEnvs);
            mcpClientInfo.connected = true;
            console.log('Reconexão bem-sucedida');
          } catch (retryError) {
            console.error('Falha na reconexão:', retryError);
            return res.status(500).json({
              success: false,
              error: `Erro ao conectar ao servidor MCP: ${retryError.message}`
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            error: `Erro ao conectar ao servidor MCP: ${error.message}`
          });
        }
      }
    }

    // Executar prompt
    const result = await mcpClientInfo.client.executePrompt(prompt);
    
    res.json(result);
  } catch (error) {
    console.error('Erro no endpoint /execute:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint para verificar status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeClients: mcpClients.size
  });
});

// Endpoint para listar ferramentas disponíveis
app.get('/tools', async (req, res) => {
  try {
    const { 
      apiKey, 
      serverCommand = 'node', 
      serverArgs = ['../mcp-server-demo/build/index.js'],
      serverEnvs = {},
      sessionId = 'tools'
    } = req.query;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key da OpenAI é obrigatória'
      });
    }

    // Processar serverEnvs se for string
    let serverEnvsObject = {};
    if (typeof serverEnvs === 'string' && serverEnvs.trim()) {
      try {
        serverEnvsObject = JSON.parse(serverEnvs);
      } catch (parseError) {
        console.warn('Erro ao fazer parse das variáveis de ambiente:', parseError.message);
      }
    } else if (typeof serverEnvs === 'object' && serverEnvs !== null) {
      serverEnvsObject = serverEnvs;
    }

    // Obter cliente MCP
    const mcpClientInfo = getMCPClient(sessionId, apiKey, serverCommand, serverArgs.split(','), serverEnvsObject);
    
    // Conectar se necessário
    if (!mcpClientInfo.connected) {
      await mcpClientInfo.client.connect(serverCommand, serverArgs.split(','), serverEnvsObject);
      mcpClientInfo.connected = true;
    }

    const tools = await mcpClientInfo.client.listTools();

    res.json({
      success: true,
      tools: tools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para desconectar um cliente específico
app.post('/disconnect', async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    // Encontrar e desconectar clientes da sessão
    const clientsToDisconnect = [];
    for (const [key, clientInfo] of mcpClients.entries()) {
      if (key.startsWith(sessionId + '_')) {
        clientsToDisconnect.push(key);
      }
    }

    for (const key of clientsToDisconnect) {
      const clientInfo = mcpClients.get(key);
      if (clientInfo.connected) {
        await clientInfo.client.disconnect();
      }
      mcpClients.delete(key);
    }

    res.json({
      success: true,
      disconnectedClients: clientsToDisconnect.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup ao encerrar o processo
process.on('SIGINT', async () => {
  console.log('Encerrando servidor e desconectando clientes MCP...');
  
  for (const [key, clientInfo] of mcpClients.entries()) {
    if (clientInfo.connected) {
      try {
        await clientInfo.client.disconnect();
      } catch (error) {
        console.error(`Erro ao desconectar cliente ${key}:`, error);
      }
    }
  }
  
  process.exit(0);
});

// Limpeza automática de sessões antigas (a cada 5 minutos)
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutos
  
  for (const [key, clientInfo] of mcpClients.entries()) {
    if (now - clientInfo.lastActivity > maxAge) {
      console.log(`Removendo sessão antiga: ${key}`);
      try {
        clientInfo.client.disconnect();
      } catch (error) {
        console.error('Erro ao desconectar cliente antigo:', error);
      }
      mcpClients.delete(key);
    }
  }
}, 5 * 60 * 1000); // Executar a cada 5 minutos

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Host rodando na porta ${PORT}`);
});

