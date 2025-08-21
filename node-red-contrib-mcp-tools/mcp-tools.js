module.exports = function(RED) {
    const http = require('http');
    const https = require('https');
    const url = require('url');
    const fs = require('fs');
    const path = require('path');

    function MCPAgentNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configurações do nó
        node.serverUrl = config.serverUrl || 'http://localhost:3000';
        node.prompt = config.prompt || '';
        node.apiKey = config.apiKey || '';
        node.mcpServers = config.mcpServers || '{"mcpServers": {"default": {"command": "node", "args": ["mcp-server/v1/build/index.js"]}}}';
        node.mcpServerEnvs = config.mcpServerEnvs || '';
        node.mcpServerEnvsFile = config.mcpServerEnvsFile || '';
        node.timeout = parseInt(config.timeout) || 30000;
        node.sessionId = config.sessionId || 'default';

        // Aumentar timeout para servidores remotos (npx)
        try {
            const serversConfig = JSON.parse(node.mcpServers);
            // Check if it's the new format with mcpServers property
            const mcpServers = serversConfig.mcpServers || serversConfig;
            for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
                if (serverConfig.command && serverConfig.command.includes('npx')) {
                    node.timeout = Math.max(node.timeout, 60000); // Mínimo 60s para servidores NPX
                    break;
                }
            }
        } catch (parseError) {
            node.warn(`Error parsing MCP servers configuration: ${parseError.message}`);
        }

        // Função para obter API Key de forma segura
        function getSecureApiKey() {
            // 1. Verificar se é uma variável de ambiente (formato {{VAR}})
            if (node.apiKey && typeof node.apiKey === 'string' && node.apiKey.startsWith('{{') && node.apiKey.endsWith('}}')) {
                const envVarName = node.apiKey.slice(2, -2); // Remove {{ }}
                const envValue = process.env[envVarName];
                if (envValue) {
                    node.log(`Using environment variable ${envVarName} for OpenAI API Key`);
                    return envValue;
                } else {
                    node.warn(`Environment variable ${envVarName} not found`);
                }
            }
            
            // 2. Primeiro, tentar obter da configuração de credenciais
            if (node.credentials && node.credentials.apiKey) {
                return node.credentials.apiKey;
            }
            
            // 3. Tentar obter da variável de ambiente padrão
            const envApiKey = process.env.OPENAI_API_KEY || process.env.ENV_OPENAI_API_KEY;
            if (envApiKey) {
                return envApiKey;
            }
            
            // 4. Tentar obter da configuração do nó (fallback)
            return node.apiKey;
        }

        // Função para obter variáveis de ambiente do MCP Server de forma segura
        function getSecureMCPEnvs() {
            console.log('DEBUG - getSecureMCPEnvs() called');
            const allEnvVars = {};
            
            // 1. Verificar se é uma variável de ambiente (formato {{VAR}})
            if (node.mcpServerEnvs && typeof node.mcpServerEnvs === 'string' && node.mcpServerEnvs.startsWith('{{') && node.mcpServerEnvs.endsWith('}}')) {
                const envVarName = node.mcpServerEnvs.slice(2, -2); // Remove {{ }}
                const envValue = process.env[envVarName];
                if (envValue) {
                    try {
                        const envVars = JSON.parse(envValue);
                        if (typeof envVars === 'object' && envVars !== null) {
                            node.log(`Using environment variable ${envVarName} for MCP Server environments`);
                            Object.assign(allEnvVars, envVars);
                        }
                    } catch (parseError) {
                        node.warn(`Error parsing environment variable ${envVarName}: ${parseError.message}`);
                    }
                } else {
                    node.warn(`Environment variable ${envVarName} not found`);
                }
            }
            
            // 2. Primeiro, tentar obter do arquivo de configuração
            if (node.mcpServerEnvsFile && node.mcpServerEnvsFile.trim()) {
                try {
                    const envFilePath = path.resolve(node.mcpServerEnvsFile);
                    if (fs.existsSync(envFilePath)) {
                        const envContent = fs.readFileSync(envFilePath, 'utf8');
                        const envVars = {};
                        
                        // Parse do arquivo .env
                        envContent.split('\n').forEach(line => {
                            line = line.trim();
                            if (line && !line.startsWith('#') && line.includes('=')) {
                                const [key, ...valueParts] = line.split('=');
                                const value = valueParts.join('=').trim();
                                if (key && value) {
                                    // Remover aspas se existirem
                                    envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
                                }
                            }
                        });
                        
                        if (Object.keys(envVars).length > 0) {
                            node.log(`Loaded ${Object.keys(envVars).length} environment variables from file: ${envFilePath}`);
                            Object.assign(allEnvVars, envVars);
                        }
                    }
                } catch (fileError) {
                    node.warn(`Error reading environment file: ${fileError.message}`);
                }
            }
            
            // 3. Tentar obter da variável de ambiente global
            const envMCPVars = process.env.ENV_MCP_VARIABLES;
            if (envMCPVars && envMCPVars.trim()) {
                try {
                    const envVars = JSON.parse(envMCPVars);
                    if (typeof envVars === 'object' && envVars !== null) {
                        node.log(`Loaded ${Object.keys(envVars).length} environment variables from ENV_MCP_VARIABLES`);
                        Object.assign(allEnvVars, envVars);
                    }
                } catch (parseError) {
                    node.warn(`Error parsing ENV_MCP_VARIABLES: ${parseError.message}`);
                }
            }
            
            // 4. IMPORTANTE: Incluir variáveis de ambiente individuais do sistema
            // Procurar por variáveis que começam com SMITHERY_ ou outras específicas
            console.log('🔧 DEBUG - Checking system environment variables...');
            console.log('🔧 DEBUG - process.env keys:', Object.keys(process.env).filter(k => k.startsWith('SMITHERY_') || k.startsWith('MCP_') || k.startsWith('OPENAI_')));
            
            for (const [key, value] of Object.entries(process.env)) {
                if (key.startsWith('SMITHERY_') || key.startsWith('MCP_') || key.startsWith('OPENAI_')) {
                    allEnvVars[key] = value;
                    console.log(`🔧 Added system environment variable: ${key} = ${value}`);
                }
            }
            
            // 5. Tentar obter da configuração do nó (fallback)
            if (node.mcpServerEnvs && node.mcpServerEnvs.trim()) {
                try {
                    if (typeof node.mcpServerEnvs === 'string') {
                        // Tentar fazer parse como JSON
                        const envVars = JSON.parse(node.mcpServerEnvs);
                        if (typeof envVars === 'object' && envVars !== null) {
                            Object.assign(allEnvVars, envVars);
                        }
                    } else if (typeof node.mcpServerEnvs === 'object' && node.mcpServerEnvs !== null) {
                        Object.assign(allEnvVars, node.mcpServerEnvs);
                    }
                } catch (parseError) {
                    // Se falhar, tentar parse como formato chave=valor
                    const envPairs = node.mcpServerEnvs.split(',').map(pair => pair.trim());
                    const envVars = {};
                    for (const pair of envPairs) {
                        const [key, value] = pair.split('=').map(s => s.trim());
                        if (key && value) {
                            // Remover aspas se existirem
                            const cleanValue = value.replace(/^["']|["']$/g, '');
                            const cleanKey = key.replace(/^["']|["']$/g, '');
                            envVars[cleanKey] = cleanValue;
                        }
                    }
                    if (Object.keys(envVars).length > 0) {
                        Object.assign(allEnvVars, envVars);
                    }
                }
            }
            
            // 6. Log final das variáveis carregadas
            if (Object.keys(allEnvVars).length > 0) {
                console.log(`🔧 Total environment variables loaded: ${Object.keys(allEnvVars).length}`);
                console.log(`🔧 Environment variable keys: ${Object.keys(allEnvVars).join(', ')}`);
            }
            
            // 7. Retornar todas as variáveis combinadas
            console.log('🔧 DEBUG - getSecureMCPEnvs() returning:', allEnvVars);
            return allEnvVars;
        }

        // Função para substituir variáveis de ambiente no texto
        function substituteEnvironmentVariables(text, envVars) {
            if (!text || typeof text !== 'string') return text;
            
            return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
                const value = envVars[varName.trim()];
                return value !== undefined ? value : match;
            });
        }

        async function discoverAllMCPServers(mcpServersConfig, serverEnvsObject) {
            const serverDiscoveryResults = {};
            const discoveryPromises = [];
            
            // Criar promises para descoberta paralela de todos os servidores
            for (const [serverName, serverConfig] of Object.entries(mcpServersConfig)) {
                const discoveryPromise = discoverSingleServer(serverName, serverConfig, serverEnvsObject);
                discoveryPromises.push(discoveryPromise);
            }
            
            // Executar todas as descobertas em paralelo
            const results = await Promise.allSettled(discoveryPromises);
            
            // Processar resultados
            results.forEach((result, index) => {
                const serverName = Object.keys(mcpServersConfig)[index];
                if (result.status === 'fulfilled') {
                    serverDiscoveryResults[serverName] = result.value;
                    
                    // Log detalhado do status do servidor
                    if (result.value.validForExecution === false) {
                        node.log(`⚠️ Server ${serverName}: Connected but no MCP capabilities - may still be valid for execution`);
                    }
                } else {
                    node.warn(`Error discovering server ${serverName}: ${result.reason.message}`);
                    serverDiscoveryResults[serverName] = {
                        config: mcpServersConfig[serverName],
                        available: false,
                        error: 'Discovery failed',
                        message: result.reason.message
                    };
                }
            });

            return serverDiscoveryResults;
        }

        async function discoverSingleServer(serverName, serverConfig, serverEnvsObject) {
            try {
                node.log(`🔍 Discovering capabilities for server: ${serverName}`);
                
                // Determinar timeout baseado no tipo de servidor
                const isExternalServer = serverConfig.command.includes('npx') || serverConfig.command.includes('npm');
                const timeout = isExternalServer ? 8000 : 5000; // 8s para externos, 5s para locais
                
                // Testar conexão com o servidor
                const testUrl = node.serverUrl + '/test-connection';
                const testData = JSON.stringify({
                    serverCommand: serverConfig.command,
                    serverArgs: serverConfig.args,
                    serverEnvs: serverEnvsObject
                });

                const testOptions = {
                    hostname: url.parse(node.serverUrl).hostname,
                    port: url.parse(node.serverUrl).port || 3000,
                    path: '/test-connection',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(testData)
                    },
                    timeout: timeout
                };

                const discoveryResult = await new Promise((resolve, reject) => {
                    const req = http.request(testOptions, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => {
                            try {
                                const response = JSON.parse(data);
                                if (res.statusCode === 200 && response.success) {
                                    // Servidor conectou com sucesso
                                    const isCapabilityDiscoveryFailed = response.message === 'Connected but capability discovery failed';
                                    
                                    resolve({
                                        available: true,
                                        toolsCount: response.toolsCount || 0,
                                        resourcesCount: response.resourcesCount || 0,
                                        message: response.message,
                                        // Marcar se é um servidor válido mesmo sem capacidades MCP
                                        validForExecution: response.validForExecution || !isCapabilityDiscoveryFailed,
                                        warning: response.warning || null
                                    });
                                } else {
                                    resolve({
                                        available: false,
                                        error: response.error || 'Connection test failed',
                                        message: response.message
                                    });
                                }
                            } catch (parseError) {
                                resolve({
                                    available: false,
                                    error: 'Response parsing failed',
                                    message: parseError.message
                                });
                            }
                        });
                    });

                    req.on('error', (error) => {
                        resolve({
                            available: false,
                            error: 'Connection error',
                            message: error.message
                        });
                    });

                    req.on('timeout', () => {
                        req.destroy();
                        resolve({
                            available: false,
                            error: 'Connection timeout',
                            message: `Request timed out after ${timeout}ms`
                        });
                    });

                    req.write(testData);
                    req.end();
                });

                const result = {
                    config: serverConfig,
                    ...discoveryResult
                };

                node.log(`📊 Server ${serverName}: ${discoveryResult.available ? 'Available' : 'Unavailable'} - Tools: ${discoveryResult.toolsCount || 0}, Resources: ${discoveryResult.resourcesCount || 0}`);

                return result;

            } catch (error) {
                throw new Error(`Discovery error for ${serverName}: ${error.message}`);
            }
        }

        // Função para selecionar o servidor MCP mais adequado baseado no prompt
        async function selectBestMCPServer(prompt, mcpServersConfig, serverEnvsObject, existingDiscovery = null) {
            try {
                // Se só há um servidor, usar ele
                const serverNames = Object.keys(mcpServersConfig);
                if (serverNames.length === 1) {
                    const serverName = serverNames[0];
                    const serverConfig = mcpServersConfig[serverName];
                    return {
                        serverName,
                        serverConfig,
                        reason: `Single server available: ${serverName}`,
                        allServers: { [serverName]: { config: serverConfig, available: true } }
                    };
                }

                // Usar discovery existente se disponível, senão fazer novo discovery
                let allServersDiscovery;
                if (existingDiscovery) {
                    allServersDiscovery = existingDiscovery;
                    node.log(`🔍 Using existing discovery data for ${Object.keys(allServersDiscovery).length} servers`);
                } else {
                    node.log(`🔍 Discovering capabilities for all ${serverNames.length} MCP servers...`);
                    allServersDiscovery = await discoverAllMCPServers(mcpServersConfig, serverEnvsObject);
                }
                
                // Analisar o prompt para identificar o tipo de tarefa
                const promptLower = prompt.toLowerCase();
                const taskKeywords = {
                    'web_search': ['search', 'buscar', 'encontrar', 'notícias', 'news', 'futebol', 'esportes'],
                    'file_management': ['arquivo', 'file', 'documento', 'drive', 'google', 'upload', 'download'],
                    'database': ['banco', 'database', 'query', 'sql', 'dados'],
                    'code_analysis': ['código', 'code', 'análise', 'review', 'debug'],
                    'general': ['geral', 'general', 'ajuda', 'help', 'o que você pode fazer']
                };

                // Determinar o tipo de tarefa
                let detectedTask = 'general';
                for (const [taskType, keywords] of Object.entries(taskKeywords)) {
                    if (keywords.some(keyword => promptLower.includes(keyword))) {
                        detectedTask = taskType;
                        break;
                    }
                }

                // Mapear tipos de tarefa para servidores preferidos
                const serverPreferences = {
                    'web_search': ['exa', 'smithery', 'search'],
                    'file_management': ['gdrive', 'google', 'file'],
                    'database': ['database', 'db'],
                    'code_analysis': ['code', 'analysis', 'review'],
                    'general': ['default', 'general']
                };

                const preferredServers = serverPreferences[detectedTask] || ['default'];

                // Tentar encontrar um servidor preferido que esteja disponível
                for (const preferredServer of preferredServers) {
                    for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                        if ((serverName.toLowerCase().includes(preferredServer) || 
                             preferredServer === 'default' && serverName === 'default') &&
                            (serverInfo.available && (serverInfo.validForExecution !== false))) {
                            
                            node.log(`🎯 Selected preferred server: ${serverName} for task type: ${detectedTask}`);
                            return {
                                serverName,
                                serverConfig: serverInfo.config,
                                reason: `Selected based on task type '${detectedTask}' and availability`,
                                allServers: allServersDiscovery
                            };
                        }
                    }
                }

                // Se nenhum servidor preferido estiver disponível, usar o primeiro disponível
                for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                    if (serverInfo.available && (serverInfo.validForExecution !== false)) {
                        node.log(`🔄 Using first available server: ${serverName}`);
                        return {
                            serverName,
                            serverConfig: serverInfo.config,
                            reason: `First available server: ${serverName}`,
                            allServers: allServersDiscovery
                        };
                    }
                }

                // Fallback: usar o primeiro servidor (mesmo que não esteja disponível)
                const firstServerName = Object.keys(mcpServersConfig)[0];
                const firstServerConfig = mcpServersConfig[firstServerName];
                node.warn(`No available servers found, using fallback: ${firstServerName}`);
                return {
                    serverName: firstServerName,
                    serverConfig: firstServerConfig,
                    reason: `Fallback to first server (may not be available): ${firstServerName}`,
                    allServers: allServersDiscovery
                };

            } catch (error) {
                node.warn(`Error selecting MCP server: ${error.message}`);
                // Fallback para o primeiro servidor
                const firstServerName = Object.keys(mcpServersConfig)[0];
                const firstServerConfig = mcpServersConfig[firstServerName];
                return {
                    serverName: firstServerName,
                    serverConfig: firstServerConfig,
                    reason: `Error in server selection, using fallback: ${firstServerName}`,
                    allServers: {}
                };
            }
        }

        node.on('input', async function(msg) {
            // Usar configurações do nó ou da mensagem
            let promptToUse = msg.prompt || node.prompt || msg.payload;
            const apiKeyToUse = msg.apiKey || getSecureApiKey();
            const mcpServersToUse = msg.mcpServers || node.mcpServers;
            const serverEnvsToUse = msg.mcpServerEnvs || getSecureMCPEnvs();
            const sessionIdToUse = msg.sessionId || node.sessionId;
            
            // 🔍 DEBUG: Log das variáveis de ambiente carregadas
            if (serverEnvsToUse && typeof serverEnvsToUse === 'object') {
                node.log(`🔧 DEBUG - Environment variables loaded from getSecureMCPEnvs():`);
                node.log(`  - Type: ${typeof serverEnvsToUse}`);
                node.log(`  - Keys: ${Object.keys(serverEnvsToUse).join(', ')}`);
                node.log(`  - SMITHERY_KEY present: ${'SMITHERY_KEY' in serverEnvsToUse}`);
                node.log(`  - SMITHERY_PROFILE present: ${'SMITHERY_PROFILE' in serverEnvsToUse}`);
            }
            
            if (!promptToUse) {
                node.error("No prompt provided", msg);
                return;
            }

            if (!apiKeyToUse) {
                node.error("OpenAI API Key is required. Please configure it in credentials or set OPENAI_API_KEY environment variable.", msg);
                return;
            }

            // Preparar configuração dos servidores MCP
            let mcpServersConfig;
            try {
                if (typeof mcpServersToUse === 'string') {
                    const parsedConfig = JSON.parse(mcpServersToUse);
                    // Check if it's the new format with mcpServers property
                    mcpServersConfig = parsedConfig.mcpServers || parsedConfig;
                } else if (typeof mcpServersToUse === 'object' && mcpServersToUse !== null) {
                    // Check if it's the new format with mcpServers property
                    mcpServersConfig = mcpServersToUse.mcpServers || mcpServersToUse;
            } else {
                    mcpServersConfig = {"default": {"command": "node", "args": ["mcp-server/v1/build/index.js"]}};
                }
            } catch (parseError) {
                node.error(`Error parsing MCP servers configuration: ${parseError.message}`, msg);
                return;
            }

            // Preparar variáveis de ambiente do servidor MCP
            let serverEnvsObject = {};
            if (typeof serverEnvsToUse === 'string' && serverEnvsToUse.trim()) {
                try {
                    // Tentar fazer parse como JSON
                    serverEnvsObject = JSON.parse(serverEnvsToUse);
                } catch (parseError) {
                    // Se falhar, tentar parse como formato chave=valor
                    const envPairs = serverEnvsToUse.split(',').map(pair => pair.trim());
                    for (const pair of envPairs) {
                        const [key, value] = pair.split('=').map(s => s.trim());
                        if (key && value) {
                            // Remover aspas se existirem
                            const cleanValue = value.replace(/^["']|["']$/g, '');
                            const cleanKey = key.replace(/^["']|["']$/g, '');
                            serverEnvsObject[cleanKey] = cleanValue;
                        }
                    }
                }
            } else if (typeof serverEnvsToUse === 'object' && serverEnvsToUse !== null) {
                serverEnvsObject = serverEnvsToUse;
            }
            
            // 🔧 SOLUÇÃO DIRETA: Adicionar variáveis SMITHERY_ diretamente
            if (process.env.SMITHERY_KEY) {
                serverEnvsObject.SMITHERY_KEY = process.env.SMITHERY_KEY;
                node.log(`🔧 Added SMITHERY_KEY: ${process.env.SMITHERY_KEY}`);
            }
            if (process.env.SMITHERY_PROFILE) {
                serverEnvsObject.SMITHERY_PROFILE = process.env.SMITHERY_PROFILE;
                node.log(`🔧 Added SMITHERY_PROFILE: ${process.env.SMITHERY_PROFILE}`);
            }
            
            // 🔍 DEBUG: Log do serverEnvsObject final
            node.log(`🔧 DEBUG - serverEnvsObject final:`);
            node.log(`  - Type: ${typeof serverEnvsObject}`);
            node.log(`  - Keys: ${Object.keys(serverEnvsObject).join(', ')}`);
            node.log(`  - SMITHERY_KEY present: ${'SMITHERY_KEY' in serverEnvsObject}`);
            node.log(`  - SMITHERY_PROFILE present: ${'SMITHERY_PROFILE' in serverEnvsObject}`);
            if ('SMITHERY_KEY' in serverEnvsObject) {
                node.log(`  - SMITHERY_KEY value: ${serverEnvsObject.SMITHERY_KEY}`);
            }
            if ('SMITHERY_PROFILE' in serverEnvsObject) {
                node.log(`  - SMITHERY_PROFILE value: ${serverEnvsObject.SMITHERY_PROFILE}`);
            }

            // Descobrir todos os servidores MCP primeiro para obter todas as ferramentas
            let allServersDiscovery;
            try {
                node.log(`🔍 Discovering capabilities for all ${Object.keys(mcpServersConfig).length} MCP servers...`);
                allServersDiscovery = await discoverAllMCPServers(mcpServersConfig, serverEnvsObject);
                
                // Log do status de cada servidor
                for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                    const status = serverInfo.available ? '✅ Available' : '❌ Unavailable';
                    const tools = serverInfo.toolsCount || 0;
                    const resources = serverInfo.resourcesCount || 0;
                    node.log(`📊 ${serverName}: ${status} - Tools: ${tools}, Resources: ${resources}`);
                }
            } catch (error) {
                node.warn(`Error discovering MCP servers: ${error.message}`);
                // Fallback: usar apenas o primeiro servidor
                const firstServerName = Object.keys(mcpServersConfig)[0];
                const firstServerConfig = mcpServersConfig[firstServerName];
                allServersDiscovery = {
                    [firstServerName]: {
                        config: firstServerConfig,
                        available: true,
                        toolsCount: 0,
                        resourcesCount: 0
                    }
                };
            }

            // Selecionar o servidor MCP mais adequado baseado no prompt (para execução)
            let selectedServer;
            try {
                selectedServer = await selectBestMCPServer(promptToUse, mcpServersConfig, serverEnvsObject, allServersDiscovery);
                node.log(`Selected MCP server for execution: ${selectedServer.serverName} - ${selectedServer.reason}`);
            } catch (error) {
                node.warn(`Error in server selection, using fallback: ${error.message}`);
                // Fallback para o primeiro servidor disponível
                for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                    if (serverInfo.available) {
                        selectedServer = {
                            serverName: serverName,
                            serverConfig: serverInfo.config,
                            reason: `Fallback to first available server: ${serverName}`
                        };
                        break;
                    }
                }
                
                // Se nenhum estiver disponível, usar o primeiro configurado
                if (!selectedServer) {
                    const firstServerName = Object.keys(mcpServersConfig)[0];
                    const firstServerConfig = mcpServersConfig[firstServerName];
                    selectedServer = {
                        serverName: firstServerName,
                        serverConfig: firstServerConfig,
                        reason: `Fallback to first configured server: ${firstServerName}`
                    };
                }
            }

            const serverCommandToUse = selectedServer.serverConfig.command;
            let serverArgsArray = selectedServer.serverConfig.args;

            // DEBUG: Add logs here (sem expor dados sensíveis)
            console.log('DEBUG - Environment variables processed:');
            console.log('  - Type received:', typeof serverEnvsToUse);
            console.log('  - Number of variables:', Object.keys(serverEnvsObject).length);
            console.log('  - Variable keys:', Object.keys(serverEnvsObject));
            console.log('DEBUG - All servers discovery:');
            console.log('  - Total servers:', Object.keys(allServersDiscovery).length);
            console.log('  - Available servers:', Object.keys(allServersDiscovery).filter(name => allServersDiscovery[name].available));
            console.log('  - Total tools available:', Object.values(allServersDiscovery).reduce((sum, info) => sum + (info.toolsCount || 0), 0));
            console.log('  - Total resources available:', Object.values(allServersDiscovery).reduce((sum, info) => sum + (info.resourcesCount || 0), 0));

            // Substituir variáveis de ambiente no prompt
            const originalPrompt = promptToUse;
            promptToUse = substituteEnvironmentVariables(promptToUse, serverEnvsObject);
            
            if (originalPrompt !== promptToUse) {
                node.log(`Prompt after environment variable substitution: ${promptToUse}`);
            }

            // Substituir variáveis de ambiente nos argumentos do servidor
            const originalArgs = [...serverArgsArray];
            const processedArgs = serverArgsArray.map(arg => substituteEnvironmentVariables(arg, serverEnvsObject));
            
            // Log das substituições feitas nos argumentos
            for (let i = 0; i < originalArgs.length; i++) {
                if (originalArgs[i] !== processedArgs[i]) {
                    node.log(`Argument ${i} substituted: "${originalArgs[i]}" → "${processedArgs[i]}"`);
                }
            }
            
            // Usar os argumentos processados
            serverArgsArray = processedArgs;

            // Converter caminhos para o formato que o mcp-host espera (com ../)
            serverArgsArray = serverArgsArray.map(arg => {
                // Se o argumento é um caminho para mcp-server e não começa com ../
                if (arg.includes('mcp-server/') && !arg.startsWith('../')) {
                    return '../' + arg;
                }
                return arg;
            });

            // Log da seleção do servidor e status geral
            node.log(`Using MCP server for execution: ${selectedServer.serverName} (${selectedServer.reason})`);
            node.log(`Server command: ${serverCommandToUse} ${serverArgsArray.join(' ')}`);
            node.log(`Total MCP servers discovered: ${Object.keys(allServersDiscovery).length}`);
            node.log(`Total tools available across all servers: ${Object.values(allServersDiscovery).reduce((sum, info) => sum + (info.toolsCount || 0), 0)}`);

            // Preparar dados para envio (incluindo todos os servidores descobertos)
            const postData = JSON.stringify({
                prompt: promptToUse,
                apiKey: apiKeyToUse,
                mcpServers: mcpServersConfig,
                allServersDiscovery: allServersDiscovery, // Enviar descoberta de todos os servidores
                selectedServer: selectedServer.serverName,
                serverCommand: serverCommandToUse,
                serverArgs: serverArgsArray,
                serverEnvs: serverEnvsObject,
                sessionId: sessionIdToUse,
                timeout: node.timeout
            });

            // Configurar requisição HTTP
            const urlObj = url.parse(node.serverUrl + '/execute');
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: node.timeout
            };

            // Atualizar status do nó com informações do servidor selecionado
            node.status({fill: "blue", shape: "dot", text: `processing with ${selectedServer.serverName}...`});

            // Fazer requisição
            const protocol = urlObj.protocol === 'https:' ? https : http;
            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        
                        if (response.success) {
                            // Sucesso
                            node.status({fill: "green", shape: "dot", text: `success with ${selectedServer.serverName}`});
                            
                            // Preparar mensagem de saída
                            const outputMsg = {
                                payload: response.response,
                                mcpResult: {
                                success: true,
                                response: response.response,
                                toolsUsed: response.toolsUsed || [],
                                messages: response.messages || [],
                                    originalPrompt: originalPrompt, // Use originalPrompt
                                    mcpServers: mcpServersConfig,
                                    selectedServer: selectedServer.serverName,
                                serverCommand: serverCommandToUse,
                                serverArgs: serverArgsArray,
                                    selectionReason: selectedServer.reason,
                                    allServersDiscovery: allServersDiscovery, // Incluir descoberta de todos os servidores
                                    allAvailableTools: response.allAvailableTools || {}, // Incluir ferramentas disponíveis
                                    sessionId: sessionIdToUse,
                                    timestamp: new Date().toISOString()
                                }
                            };
                            
                            node.send(outputMsg);
                        } else {
                            // Erro na resposta
                            node.status({fill: "red", shape: "ring", text: `error with ${selectedServer.serverName}`});
                            node.error(`MCP Server Error (${selectedServer.serverName}): ${response.error}`, msg);
                        }
                    } catch (parseError) {
                        node.status({fill: "red", shape: "ring", text: `parsing error with ${selectedServer.serverName}`});
                        node.error(`Error parsing response (${selectedServer.serverName}): ${parseError.message}`, msg);
                    }
                });
            });

            req.on('error', (error) => {
                node.status({fill: "red", shape: "ring", text: `connection error with ${selectedServer.serverName}`});
                node.error(`Connection error (${selectedServer.serverName}): ${error.message}`, msg);
            });

            req.on('timeout', () => {
                node.status({fill: "red", shape: "ring", text: `timeout with ${selectedServer.serverName}`});
                node.error(`Request timed out (${selectedServer.serverName})`, msg);
                req.destroy();
            });

            // Enviar dados
            req.write(postData);
            req.end();
        });

        node.on('close', function() {
            node.status({});
        });
    }

    // Registrar o tipo de nó
    RED.nodes.registerType("mcp-tools", MCPAgentNode, {
        credentials: {
            apiKey: {type: "text", required: false}
        }
    });
};



