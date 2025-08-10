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
        node.mcpServerCommand = config.mcpServerCommand || 'node';
        node.mcpServerArgs = config.mcpServerArgs || '../mcp-server/build/index.js';
        node.mcpServerEnvs = config.mcpServerEnvs || '';
        node.mcpServerEnvsFile = config.mcpServerEnvsFile || '';
        node.timeout = parseInt(config.timeout) || 30000;
        node.sessionId = config.sessionId || 'default';

        // Aumentar timeout para servidores remotos (npx)
        if (node.mcpServerCommand && node.mcpServerCommand.includes('npx')) {
            node.timeout = Math.max(node.timeout, 120000); // Mínimo 120s para remotos
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
            // 1. Verificar se é uma variável de ambiente (formato {{VAR}})
            if (node.mcpServerEnvs && typeof node.mcpServerEnvs === 'string' && node.mcpServerEnvs.startsWith('{{') && node.mcpServerEnvs.endsWith('}}')) {
                const envVarName = node.mcpServerEnvs.slice(2, -2); // Remove {{ }}
                const envValue = process.env[envVarName];
                if (envValue) {
                    try {
                        const envVars = JSON.parse(envValue);
                        if (typeof envVars === 'object' && envVars !== null) {
                            node.log(`Using environment variable ${envVarName} for MCP Server environments`);
                            return envVars;
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
                            return envVars;
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
                        return envVars;
                    }
                } catch (parseError) {
                    node.warn(`Error parsing ENV_MCP_VARIABLES: ${parseError.message}`);
                }
            }
            
            // 4. Tentar obter da configuração do nó (fallback)
            if (node.mcpServerEnvs && node.mcpServerEnvs.trim()) {
                try {
                    if (typeof node.mcpServerEnvs === 'string') {
                        // Tentar fazer parse como JSON
                        const envVars = JSON.parse(node.mcpServerEnvs);
                        if (typeof envVars === 'object' && envVars !== null) {
                            return envVars;
                        }
                    } else if (typeof node.mcpServerEnvs === 'object' && node.mcpServerEnvs !== null) {
                        return node.mcpServerEnvs;
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
                        return envVars;
                    }
                }
            }
            
            // 5. Retornar objeto vazio se nada for encontrado
            return {};
        }

        // Função para substituir variáveis de ambiente no prompt
        function substituteEnvironmentVariables(text, envVars) {
            if (!text || typeof text !== 'string') {
                return text;
            }
            
            let result = text;
            
            // Substituir variáveis no formato {{VAR}}
            const envVarRegex = /\{\{([^}]+)\}\}/g;
            result = result.replace(envVarRegex, (match, varName) => {
                // Primeiro, tentar obter das variáveis de ambiente do MCP Server
                if (envVars && envVars[varName]) {
                    node.log(`Substituting {{${varName}}} with value from MCP Server envs`);
                    return envVars[varName];
                }
                
                // Depois, tentar obter das variáveis de ambiente do sistema
                const systemEnvValue = process.env[varName];
                if (systemEnvValue) {
                    node.log(`Substituting {{${varName}}} with system environment variable`);
                    return systemEnvValue;
                }
                
                // Se não encontrar, manter o placeholder e logar warning
                node.warn(`Environment variable {{${varName}}} not found, keeping placeholder`);
                return match;
            });
            
            return result;
        }

        node.on('input', function(msg) {
            // Usar configurações do nó ou da mensagem
            let promptToUse = msg.prompt || node.prompt || msg.payload;
            const apiKeyToUse = msg.apiKey || getSecureApiKey();
            const serverCommandToUse = msg.mcpServerCommand || node.mcpServerCommand;
            const serverArgsToUse = msg.mcpServerArgs || node.mcpServerArgs;
            const serverEnvsToUse = msg.mcpServerEnvs || getSecureMCPEnvs();
            const sessionIdToUse = msg.sessionId || node.sessionId;
            
            if (!promptToUse) {
                node.error("No prompt provided", msg);
                return;
            }

            if (!apiKeyToUse) {
                node.error("OpenAI API Key is required. Please configure it in credentials or set OPENAI_API_KEY environment variable.", msg);
                return;
            }

            // Preparar argumentos do servidor MCP
            let serverArgsArray;
            if (typeof serverArgsToUse === 'string') {
                serverArgsArray = serverArgsToUse.split(',').map(arg => arg.trim());
            } else if (Array.isArray(serverArgsToUse)) {
                serverArgsArray = serverArgsToUse;
            } else {
                serverArgsArray = ['../mcp-server/build/index.js'];
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

            // 🔍 DEBUG: Add logs here (sem expor dados sensíveis)
            console.log('🔧 DEBUG - Environment variables processed:');
            console.log('  - Type received:', typeof serverEnvsToUse);
            console.log('  - Number of variables:', Object.keys(serverEnvsObject).length);
            console.log('  - Variable keys:', Object.keys(serverEnvsObject));

            // Substituir variáveis de ambiente no prompt
            const originalPrompt = promptToUse;
            promptToUse = substituteEnvironmentVariables(promptToUse, serverEnvsObject);
            
            if (originalPrompt !== promptToUse) {
                node.log(`Prompt after environment variable substitution: ${promptToUse}`);
            }

            // Preparar dados para envio (sem expor API key nos logs)
            const postData = JSON.stringify({
                prompt: promptToUse,
                apiKey: apiKeyToUse,
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

            // Atualizar status do nó
            node.status({fill: "blue", shape: "dot", text: "executing..."});

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
                            node.status({fill: "green", shape: "dot", text: "success"});
                            
                            // Preparar mensagem de saída
                            const outputMsg = {
                                payload: response.response,
                                mcpResult: {
                                    success: true,
                                    response: response.response,
                                    toolsUsed: response.toolsUsed || [],
                                    messages: response.messages || [],
                                    originalPrompt: originalPrompt, // Use originalPrompt
                                    serverCommand: serverCommandToUse,
                                    serverArgs: serverArgsArray,
                                    sessionId: sessionIdToUse,
                                    timestamp: new Date().toISOString()
                                }
                            };
                            
                            node.send(outputMsg);
                        } else {
                            // Erro na resposta
                            node.status({fill: "red", shape: "ring", text: "error in response"});
                            node.error(`MCP Server Error: ${response.error}`, msg);
                        }
                    } catch (parseError) {
                        node.status({fill: "red", shape: "ring", text: "parsing error"});
                        node.error(`Error parsing response: ${parseError.message}`, msg);
                    }
                });
            });

            req.on('error', (error) => {
                node.status({fill: "red", shape: "ring", text: "connection error"});
                node.error(`Connection error: ${error.message}`, msg);
            });

            req.on('timeout', () => {
                node.status({fill: "red", shape: "ring", text: "timeout"});
                node.error("Request timed out", msg);
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

