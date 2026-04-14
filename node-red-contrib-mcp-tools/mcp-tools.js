module.exports = function (RED) {
    const fs = require('fs');
    const path = require('path');

    // Default models per provider
    const DEFAULT_MODELS = {
        openai: "gpt-4o",
        openrouter: "openai/gpt-4o",
        anthropic: "claude-sonnet-4-6",
        gemini: "gemini-2.5-pro"
    };

    // Provider-specific env var names for API key fallback
    const PROVIDER_ENV_VARS = {
        openai: "OPENAI_API_KEY",
        openrouter: "OPENROUTER_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
        gemini: "GOOGLE_API_KEY"
    };

    // ---------------------------------------------------------------------------
    // Adapter interface (implemented per provider):
    //   formatTools(mcpTools)                    → formattedTools array
    //   initialMessage(prompt)                   → first user message
    //   complete(model, messages, formattedTools) → Promise<rawResponse>
    //   parseResponse(rawResponse)               → { text, toolCalls: [{id,name,args}] }
    //   buildAssistantMessage(rawResponse)       → message to append
    //   buildToolResultMessages(toolCalls, results) → messages[] to append
    // ---------------------------------------------------------------------------

    function createOpenAIAdapter(OpenAI, apiKey, baseURL) {
        const clientOptions = { apiKey };
        if (baseURL) clientOptions.baseURL = baseURL;
        const client = new OpenAI(clientOptions);
        let nameMapping = new Map();

        return {
            formatTools(mcpTools) {
                nameMapping = new Map();
                return mcpTools.map(tool => {
                    const norm = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                    nameMapping.set(norm, tool.name);
                    return {
                        type: "function",
                        function: {
                            name: norm,
                            description: tool.description,
                            parameters: {
                                type: "object",
                                properties: tool.inputSchema?.properties || {},
                                required: tool.inputSchema?.required || []
                            }
                        }
                    };
                });
            },
            initialMessage(prompt) {
                return { role: "user", content: prompt };
            },
            async complete(model, messages, formattedTools) {
                const opts = { model, messages, max_tokens: 1000 };
                if (formattedTools.length > 0) {
                    opts.tools = formattedTools;
                    opts.tool_choice = "auto";
                }
                return client.chat.completions.create(opts);
            },
            parseResponse(response) {
                const message = response.choices[0].message;
                const toolCalls = (message.tool_calls || []).map(tc => ({
                    id: tc.id,
                    name: nameMapping.get(tc.function.name) || tc.function.name,
                    args: JSON.parse(tc.function.arguments)
                }));
                return { text: message.content, toolCalls };
            },
            buildAssistantMessage(response) {
                return response.choices[0].message;
            },
            buildToolResultMessages(toolCalls, results) {
                return toolCalls.map((tc, i) => ({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify(results[i])
                }));
            }
        };
    }

    function createOpenRouterAdapter(OpenAI, apiKey) {
        return createOpenAIAdapter(OpenAI, apiKey, "https://openrouter.ai/api/v1");
    }

    function createAnthropicAdapter(Anthropic, apiKey) {
        const client = new Anthropic({ apiKey });

        return {
            formatTools(mcpTools) {
                return mcpTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    input_schema: {
                        type: "object",
                        properties: tool.inputSchema?.properties || {},
                        required: tool.inputSchema?.required || []
                    }
                }));
            },
            initialMessage(prompt) {
                return { role: "user", content: prompt };
            },
            async complete(model, messages, formattedTools) {
                const opts = { model, max_tokens: 1000, messages };
                if (formattedTools.length > 0) opts.tools = formattedTools;
                return client.messages.create(opts);
            },
            parseResponse(response) {
                const toolCalls = [];
                let text = null;
                for (const block of response.content) {
                    if (block.type === "text") text = block.text;
                    else if (block.type === "tool_use") {
                        toolCalls.push({ id: block.id, name: block.name, args: block.input });
                    }
                }
                return { text, toolCalls };
            },
            buildAssistantMessage(response) {
                return { role: "assistant", content: response.content };
            },
            buildToolResultMessages(toolCalls, results) {
                return [{
                    role: "user",
                    content: toolCalls.map((tc, i) => ({
                        type: "tool_result",
                        tool_use_id: tc.id,
                        content: JSON.stringify(results[i])
                    }))
                }];
            }
        };
    }

    function createGeminiAdapter(GoogleGenerativeAI, apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);

        return {
            formatTools(mcpTools) {
                if (mcpTools.length === 0) return [];
                return [{
                    functionDeclarations: mcpTools.map(tool => ({
                        name: tool.name,
                        description: tool.description,
                        parameters: {
                            type: "object",
                            properties: tool.inputSchema?.properties || {},
                            required: tool.inputSchema?.required || []
                        }
                    }))
                }];
            },
            initialMessage(prompt) {
                return { role: "user", parts: [{ text: prompt }] };
            },
            async complete(model, messages, formattedTools) {
                const modelOptions = { model };
                if (formattedTools.length > 0) modelOptions.tools = formattedTools;
                const geminiModel = genAI.getGenerativeModel(modelOptions);
                return geminiModel.generateContent({ contents: messages });
            },
            parseResponse(response) {
                const parts = response.response.candidates[0].content.parts;
                const toolCalls = [];
                let text = null;
                for (const part of parts) {
                    if (part.text) text = part.text;
                    else if (part.functionCall) {
                        toolCalls.push({
                            id: part.functionCall.name,
                            name: part.functionCall.name,
                            args: part.functionCall.args
                        });
                    }
                }
                return { text, toolCalls };
            },
            buildAssistantMessage(response) {
                return { role: "model", parts: response.response.candidates[0].content.parts };
            },
            buildToolResultMessages(toolCalls, results) {
                return [{
                    role: "user",
                    parts: toolCalls.map((tc, i) => ({
                        functionResponse: {
                            name: tc.name,
                            response: { result: JSON.stringify(results[i]) }
                        }
                    }))
                }];
            }
        };
    }

    async function createAdapter(provider, apiKey) {
        switch (provider) {
            case "openai": {
                const { default: OpenAI } = await import("openai");
                return createOpenAIAdapter(OpenAI, apiKey);
            }
            case "openrouter": {
                const { default: OpenAI } = await import("openai");
                return createOpenRouterAdapter(OpenAI, apiKey);
            }
            case "anthropic": {
                const { default: Anthropic } = await import("@anthropic-ai/sdk");
                return createAnthropicAdapter(Anthropic, apiKey);
            }
            case "gemini": {
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                return createGeminiAdapter(GoogleGenerativeAI, apiKey);
            }
            default:
                throw new Error(`Unsupported LLM provider: "${provider}". Supported: openai, openrouter, anthropic, gemini`);
        }
    }

    // ---------------------------------------------------------------------------
    // MCPClient — manages MCP connection and LLM execution via provider adapter
    // ---------------------------------------------------------------------------
    class MCPClient {
        constructor(apiKey, provider = "openai", model = null) {
            this.apiKey = apiKey;
            this.provider = provider;
            this.model = model || DEFAULT_MODELS[provider] || "gpt-4o";
            this.isConnected = false;
            this.client = null;
            this.transport = null;
            this.adapter = null;
            this.ClientClass = null;
            this.StdioClientTransportClass = null;
            this.SSEClientTransportClass = null;
            this.StreamableHTTPClientTransportClass = null;
            this.EventSourceClass = null;
        }

        async init() {
            if (this.client) return;

            try {
                // Dynamic imports to support ESM modules
                const sdkClient = await import("@modelcontextprotocol/sdk/client/index.js");
                const sdkStdio = await import("@modelcontextprotocol/sdk/client/stdio.js");
                const sdkSSE = await import("@modelcontextprotocol/sdk/client/sse.js");
                const sdkStreamable = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

                // EventSource polyfill for Node.js
                if (!global.EventSource) {
                    const EventSource = (await import("eventsource")).default;
                    global.EventSource = EventSource;
                }

                this.ClientClass = sdkClient.Client;
                this.StdioClientTransportClass = sdkStdio.StdioClientTransport;
                this.SSEClientTransportClass = sdkSSE.SSEClientTransport;
                this.StreamableHTTPClientTransportClass = sdkStreamable.StreamableHTTPClientTransport;

                this.client = new this.ClientClass({
                    name: "mcp-client",
                    version: "1.0.0"
                }, {
                    capabilities: {
                        prompts: {},
                        resources: {},
                        tools: {}
                    }
                });
            } catch (error) {
                console.error("Failed to initialize MCP dependencies:", error);
                throw error;
            }
        }

        async initAdapter() {
            if (this.adapter) return;
            this.adapter = await createAdapter(this.provider, this.apiKey);
        }

        async connect(serverCommand, serverArgs = [], envVars = {}) {
            if (!this.client) await this.init();

            const finalEnvVars = { ...process.env, ...envVars };

            if (this.isConnected) {
                await this.disconnect();
            }

            if (serverCommand && (serverCommand.startsWith('http://') || serverCommand.startsWith('https://'))) {
                const token = envVars.__SERVER_TOKEN__ || finalEnvVars.SMITHERY_KEY || envVars.token;
const transportOptions = {};
                if (token) {
                    transportOptions.fetch = (url, init) => {
                        const headers = new Headers(init?.headers);
                        headers.set("Authorization", `Bearer ${token}`);
                        return fetch(url, { ...init, headers });
                    };
                }
                this.transport = new this.StreamableHTTPClientTransportClass(serverCommand, transportOptions);
            } else {
                this.transport = new this.StdioClientTransportClass({
                    command: serverCommand,
                    args: serverArgs,
                    env: Object.fromEntries(Object.entries(finalEnvVars).filter(([, v]) => v !== undefined))
                });
            }

            try {
                await this.client.connect(this.transport);
                this.isConnected = true;
            } catch (error) {
                console.error("Error connecting to MCP server:", error);
                throw error;
            }
        }

        async disconnect() {
            if (this.isConnected && this.client) {
                try {
                    await this.client.close();
                } catch (error) {
                    console.error("Error disconnecting from MCP server:", error);
                }
            }
            this.isConnected = false;
            this.transport = null;
        }

        async listTools() {
            if (!this.isConnected) {
                throw new Error("MCP client is not connected");
            }
            try {
                const toolsResult = await this.client.listTools();
                return toolsResult.tools;
            } catch (error) {
                console.error("Error listing tools:", error);
                throw error;
            }
        }

        async listResources() {
            if (!this.isConnected) {
                throw new Error("MCP client is not connected");
            }
            try {
                const resourcesResult = await this.client.listResources();
                return resourcesResult.resources;
            } catch (error) {
                console.error("Error listing resources:", error);
                throw error;
            }
        }

        async executePrompt(prompt) {
            if (!this.isConnected) {
                throw new Error("MCP client is not connected");
            }

            try {
                await this.initAdapter();

                const mcpTools = await this.listTools();
                const formattedTools = this.adapter.formatTools(mcpTools);
                const messages = [this.adapter.initialMessage(prompt)];
                const toolsUsed = [];
                const MAX_ITERATIONS = 10;

                for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
                    const response = await this.adapter.complete(this.model, messages, formattedTools);
                    const { text, toolCalls } = this.adapter.parseResponse(response);

                    if (toolCalls.length === 0) {
                        return {
                            success: true,
                            response: text,
                            toolsUsed,
                            messages
                        };
                    }

                    // Append assistant message with tool calls
                    messages.push(this.adapter.buildAssistantMessage(response));

                    // Execute all tool calls
                    const results = [];
                    for (const toolCall of toolCalls) {
                        try {
                            const result = await this.client.callTool({
                                name: toolCall.name,
                                arguments: toolCall.args
                            });
                            results.push(result);
                            toolsUsed.push(result);
                        } catch (toolError) {
                            const errResult = { error: toolError.message };
                            results.push(errResult);
                            toolsUsed.push(errResult);
                        }
                    }

                    // Append tool result messages
                    const toolMsgs = this.adapter.buildToolResultMessages(toolCalls, results);
                    messages.push(...toolMsgs);
                }

                // Reached iteration cap — make one final call without tools
                console.warn(`MCP agentic loop reached max iterations (${MAX_ITERATIONS}) for provider: ${this.provider}`);
                const finalResponse = await this.adapter.complete(this.model, messages, []);
                const { text: finalText } = this.adapter.parseResponse(finalResponse);
                return {
                    success: true,
                    response: finalText || "Max iterations reached",
                    toolsUsed,
                    messages
                };

            } catch (error) {
                console.error("Error executing prompt:", error);
                return {
                    success: false,
                    error: error.message,
                    response: null
                };
            }
        }
    }

    function MCPAgentNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Node configuration
        node.prompt = config.prompt || '';
        node.apiKey = config.apiKey || '';
        node.provider = config.provider || 'openai';
        node.model = config.model || DEFAULT_MODELS[node.provider] || 'gpt-4o';
        node.transportType = config.transportType || 'stdio';
        node.mcpServerUrl = config.mcpServerUrl || '';
        node.mcpServerToken = config.mcpServerToken || '';
        node.mcpServers = config.mcpServers || '{"mcpServers": {"default": {"command": "node", "args": ["/data/mcp-server-demo/build/index.js"]}}}';
        node.mcpServerEnvs = config.mcpServerEnvs || '';
        node.mcpServerEnvsFile = config.mcpServerEnvsFile || '';
        node.timeout = parseInt(config.timeout) || 30000;
        node.sessionId = config.sessionId || 'default';

        // Increase timeout for remote servers (npx)
        try {
            const serversConfig = JSON.parse(node.mcpServers);
            const mcpServers = serversConfig.mcpServers || serversConfig;
            for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
                if (serverConfig.command && serverConfig.command.includes('npx')) {
                    node.timeout = Math.max(node.timeout, 300000);
                    break;
                }
            }
        } catch (parseError) {
            node.warn(`Error parsing MCP servers configuration: ${parseError.message}`);
        }

        // Provider-aware API key resolution
        function getSecureApiKey() {
            if (node.apiKey && typeof node.apiKey === 'string' && node.apiKey.startsWith('{{') && node.apiKey.endsWith('}}')) {
                const envVarName = node.apiKey.slice(2, -2);
                const envValue = process.env[envVarName];
                if (envValue) return envValue;
            }

            if (node.credentials && node.credentials.apiKey) {
                return node.credentials.apiKey;
            }

            // Provider-specific env var fallback
            const providerEnvVar = PROVIDER_ENV_VARS[node.provider];
            if (providerEnvVar && process.env[providerEnvVar]) {
                return process.env[providerEnvVar];
            }

            // Legacy fallback for backward compatibility
            const legacyKey = process.env.OPENAI_API_KEY || process.env.ENV_OPENAI_API_KEY;
            if (legacyKey) return legacyKey;

            return node.apiKey;
        }

        function getSecureMCPEnvs() {
            const allEnvVars = {};

            // 1. Check for {{VAR}} format
            if (node.mcpServerEnvs && typeof node.mcpServerEnvs === 'string' && node.mcpServerEnvs.startsWith('{{') && node.mcpServerEnvs.endsWith('}}')) {
                const envVarName = node.mcpServerEnvs.slice(2, -2);
                const envValue = process.env[envVarName];
                if (envValue) {
                    try {
                        const envVars = JSON.parse(envValue);
                        if (typeof envVars === 'object' && envVars !== null) {
                            Object.assign(allEnvVars, envVars);
                        }
                    } catch (parseError) {
                        node.warn(`Error parsing environment variable ${envVarName}: ${parseError.message}`);
                    }
                }
            }

            // 2. Try env file
            if (node.mcpServerEnvsFile && node.mcpServerEnvsFile.trim()) {
                try {
                    const envFilePath = path.resolve(node.mcpServerEnvsFile);
                    if (fs.existsSync(envFilePath)) {
                        const envContent = fs.readFileSync(envFilePath, 'utf8');
                        const envVars = {};
                        envContent.split('\n').forEach(line => {
                            line = line.trim();
                            if (line && !line.startsWith('#') && line.includes('=')) {
                                const [key, ...valueParts] = line.split('=');
                                const value = valueParts.join('=').trim();
                                if (key && value) {
                                    envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
                                }
                            }
                        });
                        if (Object.keys(envVars).length > 0) {
                            Object.assign(allEnvVars, envVars);
                        }
                    }
                } catch (fileError) {
                    node.warn(`Error reading environment file: ${fileError.message}`);
                }
            }

            // 3. Global ENV_MCP_VARIABLES
            const envMCPVars = process.env.ENV_MCP_VARIABLES;
            if (envMCPVars && envMCPVars.trim()) {
                try {
                    const envVars = JSON.parse(envMCPVars);
                    if (typeof envVars === 'object' && envVars !== null) {
                        Object.assign(allEnvVars, envVars);
                    }
                } catch (parseError) {
                    node.warn(`Error parsing ENV_MCP_VARIABLES: ${parseError.message}`);
                }
            }

            // 4. Individual system env vars (Smithery, MCP, OpenAI)
            for (const [key, value] of Object.entries(process.env)) {
                if (key.startsWith('SMITHERY_') || key.startsWith('MCP_') || key.startsWith('OPENAI_')) {
                    allEnvVars[key] = value;
                }
            }

            // 5. Node config fallback
            if (node.mcpServerEnvs && node.mcpServerEnvs.trim()) {
                try {
                    if (typeof node.mcpServerEnvs === 'string') {
                        const envVars = JSON.parse(node.mcpServerEnvs);
                        if (typeof envVars === 'object' && envVars !== null) {
                            Object.assign(allEnvVars, envVars);
                        }
                    } else if (typeof node.mcpServerEnvs === 'object' && node.mcpServerEnvs !== null) {
                        Object.assign(allEnvVars, node.mcpServerEnvs);
                    }
                } catch (parseError) {
                    const envPairs = node.mcpServerEnvs.split(',').map(pair => pair.trim());
                    const envVars = {};
                    for (const pair of envPairs) {
                        const [key, value] = pair.split('=').map(s => s.trim());
                        if (key && value) {
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

            return allEnvVars;
        }

        function substituteEnvironmentVariables(text, envVars) {
            if (!text || typeof text !== 'string') return text;
            return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
                const value = envVars[varName.trim()];
                return value !== undefined ? value : match;
            });
        }

        async function discoverSingleServer(serverName, serverConfig, serverEnvsObject) {
            const client = new MCPClient(getSecureApiKey());
            try {
                await client.init();
                const command = (serverConfig.url || serverConfig.command || '').trim();
                const discoverEnvs = { ...serverEnvsObject };
                if (serverConfig.token) discoverEnvs.__SERVER_TOKEN__ = substituteEnvironmentVariables(serverConfig.token, { ...process.env, ...serverEnvsObject });
                await client.connect(command, serverConfig.args, discoverEnvs);

                const tools = await client.listTools();
                const resources = await client.listResources();

                await client.disconnect();

                return {
                    config: serverConfig,
                    available: true,
                    toolsCount: tools.length,
                    resourcesCount: resources.length,
                    message: "Connected successfully",
                    validForExecution: true
                };
            } catch (error) {
                try { await client.disconnect(); } catch (e) { }
                return {
                    config: serverConfig,
                    available: false,
                    error: error.message,
                    message: `Discovery failed: ${error.message}`
                };
            }
        }

        async function discoverAllMCPServers(mcpServersConfig, serverEnvsObject) {
            const serverDiscoveryResults = {};
            const discoveryPromises = [];

            for (const [serverName, serverConfig] of Object.entries(mcpServersConfig)) {
                discoveryPromises.push(discoverSingleServer(serverName, serverConfig, serverEnvsObject));
            }

            const results = await Promise.allSettled(discoveryPromises);
            results.forEach((result, index) => {
                const serverName = Object.keys(mcpServersConfig)[index];
                if (result.status === 'fulfilled') {
                    serverDiscoveryResults[serverName] = result.value;
                } else {
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

        async function selectBestMCPServer(prompt, mcpServersConfig, serverEnvsObject, existingDiscovery = null) {
            try {
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

                const allServersDiscovery = existingDiscovery || await discoverAllMCPServers(mcpServersConfig, serverEnvsObject);

                const promptLower = prompt.toLowerCase();
                const taskKeywords = {
                    'web_search': ['search', 'buscar', 'encontrar', 'notícias', 'news', 'futebol', 'esportes'],
                    'file_management': ['arquivo', 'file', 'documento', 'drive', 'google', 'upload', 'download'],
                    'database': ['banco', 'database', 'query', 'sql', 'influxdb', 'dados'],
                    'code_analysis': ['código', 'code', 'análise', 'review', 'debug'],
                    'general': ['geral', 'general', 'ajuda', 'help', 'o que você pode fazer']
                };

                let detectedTask = 'general';
                for (const [taskType, keywords] of Object.entries(taskKeywords)) {
                    if (keywords.some(keyword => promptLower.includes(keyword))) {
                        detectedTask = taskType;
                        break;
                    }
                }

                const serverPreferences = {
                    'web_search': ['exa', 'smithery', 'search'],
                    'file_management': ['gdrive', 'google', 'file'],
                    'database': ['influxdb', 'database', 'db'],
                    'code_analysis': ['code', 'analysis', 'review'],
                    'general': ['default', 'general']
                };

                const preferredServers = serverPreferences[detectedTask] || ['default'];

                for (const preferredServer of preferredServers) {
                    for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                        if ((serverName.toLowerCase().includes(preferredServer) ||
                            preferredServer === 'default' && serverName === 'default') &&
                            (serverInfo.available && (serverInfo.validForExecution !== false))) {
                            return {
                                serverName,
                                serverConfig: serverInfo.config,
                                reason: `Selected based on task type '${detectedTask}' and availability`,
                                allServers: allServersDiscovery
                            };
                        }
                    }
                }

                for (const [serverName, serverInfo] of Object.entries(allServersDiscovery)) {
                    if (serverInfo.available && (serverInfo.validForExecution !== false)) {
                        return {
                            serverName,
                            serverConfig: serverInfo.config,
                            reason: `First available server: ${serverName}`,
                            allServers: allServersDiscovery
                        };
                    }
                }

                const firstServerName = Object.keys(mcpServersConfig)[0];
                return {
                    serverName: firstServerName,
                    serverConfig: mcpServersConfig[firstServerName],
                    reason: `Fallback to first server (may not be available): ${firstServerName}`,
                    allServers: allServersDiscovery
                };

            } catch (error) {
                node.warn(`Error selecting MCP server: ${error.message}`);
                const firstServerName = Object.keys(mcpServersConfig)[0];
                return {
                    serverName: firstServerName,
                    serverConfig: mcpServersConfig[firstServerName],
                    reason: `Error in server selection, using fallback: ${firstServerName}`,
                    allServers: {}
                };
            }
        }

        // Persistent connection state
        node.activeClient = null;
        node.activeServerConfig = null;
        node.activeServerEnvs = null;

        node.on('input', async function (msg) {
            let promptToUse = msg.prompt || node.prompt || msg.payload;
            const apiKeyToUse = msg.apiKey || getSecureApiKey();
            const providerToUse = msg.provider || node.provider;
            const modelToUse = msg.model || node.model;
            const transportType = msg.transportType || node.transportType || "stdio";
            const mcpServersToUse = msg.mcpServers || node.mcpServers;
            const serverEnvsToUse = msg.mcpServerEnvs || getSecureMCPEnvs();
            const sessionIdToUse = msg.sessionId || node.sessionId;

            if (!promptToUse) {
                node.error("No prompt provided", msg);
                return;
            }

            if (!apiKeyToUse) {
                node.error(`API Key is required. Please configure it or set ${PROVIDER_ENV_VARS[providerToUse] || 'the provider API key'} environment variable.`, msg);
                return;
            }

            let mcpServersConfig;

            if (transportType === "http") {
                // HTTP mode: build mcpServersConfig from mcpServerUrl + mcpServerToken
                const httpUrl = (msg.mcpServerUrl || node.mcpServerUrl || "").trim();
                if (!httpUrl) {
                    node.error("HTTP transport selected but no MCP Server URL configured.", msg);
                    return;
                }
                const httpToken = msg.mcpServerToken || node.mcpServerToken || "";
                const serverEntry = { url: httpUrl };
                if (httpToken) serverEntry.token = httpToken;
                mcpServersConfig = { "remote": serverEntry };
            } else {
                // Stdio mode: parse mcpServers JSON
                try {
                    if (typeof mcpServersToUse === 'string') {
                        const parsedConfig = JSON.parse(mcpServersToUse);
                        mcpServersConfig = parsedConfig.mcpServers || parsedConfig;
                    } else if (typeof mcpServersToUse === 'object' && mcpServersToUse !== null) {
                        mcpServersConfig = mcpServersToUse.mcpServers || mcpServersToUse;
                    } else {
                        mcpServersConfig = { "default": { "command": "node", "args": ["/data/mcp-server-demo/build/index.js"] } };
                    }
                } catch (parseError) {
                    node.error(`Error parsing MCP servers configuration: ${parseError.message}`, msg);
                    return;
                }
            }

            let serverEnvsObject = {};
            if (typeof serverEnvsToUse === 'string' && serverEnvsToUse.trim()) {
                try {
                    serverEnvsObject = JSON.parse(serverEnvsToUse);
                } catch (parseError) {
                    const envPairs = serverEnvsToUse.split(',').map(pair => pair.trim());
                    for (const pair of envPairs) {
                        const [key, value] = pair.split('=').map(s => s.trim());
                        if (key && value) {
                            serverEnvsObject[key.replace(/^["']|["']$/g, '')] = value.replace(/^["']|["']$/g, '');
                        }
                    }
                }
            } else if (typeof serverEnvsToUse === 'object' && serverEnvsToUse !== null) {
                serverEnvsObject = serverEnvsToUse;
            }

            if (process.env.SMITHERY_KEY) serverEnvsObject.SMITHERY_KEY = process.env.SMITHERY_KEY;
            if (process.env.SMITHERY_PROFILE) serverEnvsObject.SMITHERY_PROFILE = process.env.SMITHERY_PROFILE;

            node.status({ fill: "blue", shape: "dot", text: "discovering servers..." });

            let allServersDiscovery;
            try {
                allServersDiscovery = await discoverAllMCPServers(mcpServersConfig, serverEnvsObject);
            } catch (error) {
                node.warn(`Error discovering MCP servers: ${error.message}`);
                const firstServerName = Object.keys(mcpServersConfig)[0];
                allServersDiscovery = {
                    [firstServerName]: {
                        config: mcpServersConfig[firstServerName],
                        available: true,
                        toolsCount: 0,
                        resourcesCount: 0
                    }
                };
            }

            let selectedServer;
            try {
                selectedServer = await selectBestMCPServer(promptToUse, mcpServersConfig, serverEnvsObject, allServersDiscovery);
            } catch (error) {
                node.warn(`Error in server selection: ${error.message}`);
            }

            if (!selectedServer) {
                node.error("Could not select a server", msg);
                return;
            }

            const serverCommandToUse = (selectedServer.serverConfig.url || selectedServer.serverConfig.command || '').trim();
            let serverArgsArray = selectedServer.serverConfig.args || [];

            const originalPrompt = promptToUse;
            promptToUse = substituteEnvironmentVariables(promptToUse, serverEnvsObject);
            serverArgsArray = serverArgsArray.map(arg => substituteEnvironmentVariables(arg, serverEnvsObject));

            node.log(`Using MCP server: ${selectedServer.serverName} (${selectedServer.reason})`);
            node.status({ fill: "blue", shape: "dot", text: `executing on ${selectedServer.serverName}...` });

            // Check if we can reuse the persistent connection
            let client = node.activeClient;
            let reuseConnection = false;

            if (client && client.isConnected && node.activeServerConfig) {
                const isSameCommand = node.activeServerConfig.command === serverCommandToUse;
                const isSameArgs = JSON.stringify(node.activeServerConfig.args) === JSON.stringify(serverArgsArray);
                const isSameEnvs = JSON.stringify(node.activeServerEnvs) === JSON.stringify(serverEnvsObject);
                const isSameProvider = node.activeServerConfig.provider === providerToUse;
                const isSameModel = node.activeServerConfig.model === modelToUse;

                if (isSameCommand && isSameArgs && isSameEnvs && isSameProvider && isSameModel) {
                    reuseConnection = true;
                    node.log(`Reusing existing connection to ${selectedServer.serverName}`);
                } else {
                    node.log(`Switching server or provider configuration`);
                    try {
                        await client.disconnect();
                    } catch (e) {
                        node.warn(`Error disconnecting previous client: ${e.message}`);
                    }
                    client = null;
                }
            }

            if (!reuseConnection) {
                client = new MCPClient(apiKeyToUse, providerToUse, modelToUse);
                node.activeClient = client;
                node.activeServerConfig = {
                    serverName: selectedServer.serverName,
                    command: serverCommandToUse,
                    args: serverArgsArray,
                    provider: providerToUse,
                    model: modelToUse
                };
                node.activeServerEnvs = serverEnvsObject;
            }

            try {
                if (!reuseConnection) {
                    node.status({ fill: "blue", shape: "dot", text: `connecting to ${selectedServer.serverName}...` });
                    await client.init();
                    const connectEnvs = { ...serverEnvsObject };
                    if (selectedServer.serverConfig.token) connectEnvs.__SERVER_TOKEN__ = substituteEnvironmentVariables(selectedServer.serverConfig.token, { ...process.env, ...serverEnvsObject });
                    await client.connect(serverCommandToUse, serverArgsArray, connectEnvs);
                }

                node.status({ fill: "blue", shape: "dot", text: `executing on ${selectedServer.serverName}...` });
                const result = await client.executePrompt(promptToUse);

                if (result.success) {
                    node.status({ fill: "green", shape: "dot", text: "success" });

                    const outputMsg = {
                        payload: result.response,
                        mcpResult: {
                            success: true,
                            response: result.response,
                            toolsUsed: result.toolsUsed || [],
                            messages: result.messages || [],
                            originalPrompt: originalPrompt,
                            mcpServers: mcpServersConfig,
                            selectedServer: selectedServer.serverName,
                            serverCommand: serverCommandToUse,
                            serverArgs: serverArgsArray,
                            selectionReason: selectedServer.reason,
                            allServersDiscovery: allServersDiscovery,
                            sessionId: sessionIdToUse,
                            provider: providerToUse,
                            model: modelToUse,
                            timestamp: new Date().toISOString()
                        }
                    };

                    node.send(outputMsg);
                } else {
                    node.status({ fill: "red", shape: "ring", text: "error" });
                    node.error(`MCP Execution Error: ${result.error}`, msg);
                }

            } catch (error) {
                node.status({ fill: "red", shape: "ring", text: "connection error" });
                node.error(`Error executing MCP agent: ${error.message}`, msg);

                try {
                    await client.disconnect();
                } catch (e) { }
                node.activeClient = null;
                node.activeServerConfig = null;
                node.activeServerEnvs = null;
            }
        });

        node.on('close', async function (done) {
            if (node.activeClient) {
                try {
                    node.log("Closing persistent MCP connection...");
                    await node.activeClient.disconnect();
                } catch (e) {
                    node.warn(`Error closing MCP connection: ${e.message}`);
                }
                node.activeClient = null;
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("mcp-tools", MCPAgentNode, {
        credentials: {
            apiKey: { type: "text", required: false }
        }
    });
};
