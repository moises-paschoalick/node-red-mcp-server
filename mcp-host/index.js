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
      mcpServers,
      allServersDiscovery, // Nova propriedade com informações de todos os servidores
      selectedServer,
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
    if (selectedServer) {
      console.log(`Selected MCP server for execution: ${selectedServer}`);
    }
    console.log(`Comando do servidor: ${serverCommand} ${serverArgs.join(' ')}`);
    
    // Log MCP Servers configuration
    if (mcpServers) {
      console.log('🔍 DEBUG - MCP Servers configuration received:');
      console.log('  - mcpServers type:', typeof mcpServers);
      console.log('  - mcpServers keys:', Object.keys(mcpServers || {}));
      
      // Check if it's the new format with mcpServers property
      if (mcpServers.mcpServers) {
        console.log('  - Using new format with mcpServers property');
        console.log('  - Available servers:', Object.keys(mcpServers.mcpServers));
      } else {
        console.log('  - Using legacy format (direct server configuration)');
      }
    }

    // Log All Servers Discovery information
    if (allServersDiscovery) {
      console.log('🔍 DEBUG - All Servers Discovery received:');
      console.log('  - allServersDiscovery type:', typeof allServersDiscovery);
      console.log('  - allServersDiscovery keys:', Object.keys(allServersDiscovery || {}));
      
      // Log status of each discovered server
      for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
        const status = serverInfo.available ? '✅ Available' : '❌ Unavailable';
        const tools = serverInfo.toolsCount || 0;
        const resources = serverInfo.resourcesCount || 0;
        console.log(`  📊 ${serverName}: ${status} - Tools: ${tools}, Resources: ${resources}`);
      }
      
      // Calculate totals
      const totalServers = Object.keys(allServersDiscovery).length;
      const availableServers = Object.values(allServersDiscovery).filter(info => info.available).length;
      const totalTools = Object.values(allServersDiscovery).reduce((sum, info) => sum + (info.toolsCount || 0), 0);
      const totalResources = Object.values(allServersDiscovery).reduce((sum, info) => sum + (info.resourcesCount || 0), 0);
      
      console.log(`  📈 Summary: ${availableServers}/${totalServers} servers available`);
      console.log(`  🛠️  Total tools across all servers: ${totalTools}`);
      console.log(`  📚 Total resources across all servers: ${totalResources}`);
    }

    // Obter cliente MCP
    const mcpClientInfo = getMCPClient(sessionId, apiKey, serverCommand, serverArgs, serverEnvs);
    
    // 🔍 DEBUG: Adicionar logs aqui
    console.log('🔍 DEBUG - Dados recebidos no mcp-host:');
    console.log('  - serverCommand:', serverCommand);
    console.log('  - serverArgs:', serverArgs);
    console.log('  - serverEnvs:', serverEnvs);
    console.log('  - Tipo serverEnvs:', typeof serverEnvs);
    console.log('  - Chaves serverEnvs:', Object.keys(serverEnvs || {}));
    console.log('  - Valores serverEnvs:', Object.values(serverEnvs || {}));
    
    // Processar serverEnvs se for string
    let serverEnvsObject = serverEnvs;
    if (typeof serverEnvs === 'string' && serverEnvs.trim()) {
        try {
            serverEnvsObject = JSON.parse(serverEnvs);
        } catch (parseError) {
            console.warn('Erro ao fazer parse das variáveis de ambiente:', parseError.message);
            serverEnvsObject = {};
        }
    }
    
    console.log('🔍 DEBUG - Variáveis processadas:');
    console.log('  - serverEnvsObject:', serverEnvsObject);
    console.log('  - Tipo serverEnvsObject:', typeof serverEnvsObject);
    console.log('  - Chaves serverEnvsObject:', Object.keys(serverEnvsObject || {}));
    
    // Conectar a todos os servidores MCP disponíveis para obter todas as ferramentas
    const allMCPClients = {};
    const allTools = [];
    const allResources = [];
    
    console.log('🔗 Conectando a todos os servidores MCP disponíveis...');
    
    // Conectar ao servidor selecionado para execução
    if (!mcpClientInfo.connected) {
      try {
        await mcpClientInfo.client.connect(serverCommand, serverArgs, serverEnvsObject);
        mcpClientInfo.connected = true;
        console.log(`✅ Conectado ao servidor de execução: ${selectedServer || 'default'}`);
      } catch (error) {
        console.error('Erro ao conectar ao servidor MCP de execução:', error);
        
        // Tentar reconectar uma vez para servidores remotos (com timeout reduzido)
        if (serverCommand.includes('npx')) {
          console.log('Tentando reconectar ao servidor remoto...');
          try {
            await mcpClientInfo.client.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1s (reduzido de 2s)
            await mcpClientInfo.client.connect(serverCommand, serverArgs, serverEnvsObject);
            mcpClientInfo.connected = true;
            console.log('Reconexão bem-sucedida');
          } catch (retryError) {
            console.error('Falha na reconexão:', retryError);
            return res.status(500).json({
              success: false,
              error: `Erro ao conectar ao servidor MCP de execução: ${retryError.message}`
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            error: `Erro ao conectar ao servidor MCP de execução: ${error.message}`
          });
        }
      }
    }
    
    // Conectar a todos os outros servidores disponíveis para obter suas ferramentas
    if (allServersDiscovery && Object.keys(allServersDiscovery).length > 1) {
      console.log('🔗 Conectando aos outros servidores MCP para obter ferramentas...');
      
      for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
        // Pular o servidor já conectado para execução
        if (serverName === selectedServer) {
          console.log(`⏭️  Pulando ${serverName} (já conectado para execução)`);
          continue;
        }
        
        // Pular servidores indisponíveis
        if (!serverInfo.available) {
          console.log(`❌ Pulando ${serverName} (indisponível: ${serverInfo.error || 'unknown error'})`);
          continue;
        }
        
        try {
          console.log(`🔗 Conectando ao servidor: ${serverName}`);
          const serverConfig = serverInfo.config;
          
          // Criar cliente temporário para este servidor
          const tempClient = new MCPClient({
            name: `temp-${serverName}`,
            version: '1.0.0'
          });
          
          // Conectar ao servidor
          await tempClient.connect(serverConfig.command, serverConfig.args, serverEnvsObject);
          console.log(`✅ Conectado ao servidor: ${serverName}`);
          
          // Obter ferramentas e recursos
          try {
            const tools = await tempClient.listTools();
            const resources = await tempClient.listResources();
            
            console.log(`🛠️  ${serverName}: ${tools.length} ferramentas, ${resources.length} recursos`);
            
            // Adicionar ferramentas e recursos à lista geral
            allTools.push(...tools.map(tool => ({ ...tool, server: serverName })));
            allResources.push(...resources.map(resource => ({ ...resource, server: serverName })));
            
          } catch (toolError) {
            console.warn(`⚠️  Erro ao obter ferramentas de ${serverName}: ${toolError.message}`);
          }
          
          // Desconectar do servidor temporário
          await tempClient.disconnect();
          console.log(`🔌 Desconectado do servidor: ${serverName}`);
          
        } catch (connectionError) {
          console.warn(`⚠️  Erro ao conectar ao servidor ${serverName}: ${connectionError.message}`);
        }
      }
    }
    
    console.log(`📊 Resumo das ferramentas disponíveis:`);
    console.log(`  - Servidor de execução: ${mcpClientInfo.connected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`  - Ferramentas adicionais: ${allTools.length}`);
    console.log(`  - Recursos adicionais: ${allResources.length}`);
    console.log(`  - Total de ferramentas: ${allTools.length + (mcpClientInfo.connected ? 3 : 0)}`); // 3 é o padrão do servidor de execução

    // Executar prompt
    console.log('🚀 Executando prompt com todas as ferramentas disponíveis...');
    const result = await mcpClientInfo.client.executePrompt(prompt);
    
    // Adicionar informações sobre todas as ferramentas disponíveis
    const enhancedResult = {
      ...result,
      allAvailableTools: {
        executionServer: {
          name: selectedServer || 'default',
          toolsCount: result.toolsUsed ? result.toolsUsed.length : 0,
          tools: result.toolsUsed || []
        },
        additionalServers: allTools.map(tool => ({
          server: tool.server,
          tool: tool.name,
          description: tool.description
        })),
        summary: {
          totalServers: 1 + (allTools.length > 0 ? new Set(allTools.map(t => t.server)).size : 0),
          totalTools: (result.toolsUsed ? result.toolsUsed.length : 0) + allTools.length,
          totalResources: allResources.length
        }
      }
    };
    
    console.log('📊 Resultado da execução:');
    console.log(`  - Ferramentas usadas: ${result.toolsUsed ? result.toolsUsed.length : 0}`);
    console.log(`  - Ferramentas adicionais disponíveis: ${allTools.length}`);
    console.log(`  - Total de ferramentas: ${enhancedResult.allAvailableTools.summary.totalTools}`);
    
    res.json(enhancedResult);
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

// Endpoint para testar conexão com servidor MCP
app.post('/test-connection', async (req, res) => {
  try {
    const { 
      serverCommand = 'node', 
      serverArgs = ['../mcp-server-demo/influxdb3_mcp_server/build/index.js'],
      serverEnvs = {}
    } = req.body;

    console.log(`🔍 Testing connection to MCP server: ${serverCommand} ${serverArgs.join(' ')}`);

    // Criar cliente temporário para teste
    const testClient = new MCPClient('test-api-key');
    
    try {
      // Tentar conectar com timeout reduzido
      await testClient.connect(serverCommand, serverArgs, serverEnvs);
      
      // Se conectou com sucesso, tentar listar ferramentas
      try {
        const tools = await testClient.listTools();
        const resources = await testClient.listResources();
        
        console.log(`✅ Connection test successful for ${serverCommand}`);
        console.log(`  - Tools available: ${tools.length}`);
        console.log(`  - Resources available: ${resources.length}`);
        
        res.json({
          success: true,
          message: 'Connection test successful',
          toolsCount: tools.length,
          resourcesCount: resources.length,
          serverCommand,
          serverArgs
        });
      } catch (capabilityError) {
        console.log(`⚠️ Connected but capability discovery failed: ${capabilityError.message}`);
        
        // Para servidores que não implementam métodos MCP padrão,
        // ainda consideramos válidos se conseguirem conectar
        res.json({
          success: true,
          message: 'Connected but capability discovery failed',
          warning: capabilityError.message,
          toolsCount: 0,
          resourcesCount: 0,
          serverCommand,
          serverArgs,
          // Marcar como servidor válido mesmo sem capacidades MCP
          validForExecution: true
        });
      }
      
      // Desconectar cliente de teste
      await testClient.disconnect();
      
    } catch (connectionError) {
      console.log(`❌ Connection test failed: ${connectionError.message}`);
      res.status(500).json({
        success: false,
        error: 'Connection test failed',
        details: connectionError.message,
        serverCommand,
        serverArgs
      });
    }
    
  } catch (error) {
    console.error('Error in connection test:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during connection test',
      details: error.message
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

