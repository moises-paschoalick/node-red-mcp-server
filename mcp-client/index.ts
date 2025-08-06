import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";

interface ToolResult {
  tool_call_id: string;
  output: any;
}

export class MCPClient {
  private openai: OpenAI;
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      baseURL: "https://api.openai.com/v1/", 
      apiKey: apiKey,
    });

    this.client = new Client({
      name: "mcp-client",
      version: "1.0.0"
    }, {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {}
      }
    });
  }

  
  async connect(serverCommand: string, serverArgs: string[] = [], envVars: Record<string, string> = {}) {
    // 🔍 DEBUG: Adicionar logs aqui
    console.log('🔍 DEBUG - Conectando com variáveis de ambiente:');
    console.log('  - serverCommand:', serverCommand);
    console.log('  - serverArgs:', serverArgs);
    console.log('  - envVars:', envVars);
    console.log('  - Tipo envVars:', typeof envVars);
    console.log('  - Chaves envVars:', Object.keys(envVars));
    
    if (this.isConnected) {
      await this.disconnect();
    }

    this.transport = new StdioClientTransport({
      command: serverCommand,
      args: serverArgs,
      env: Object.fromEntries(Object.entries({ ...process.env, ...envVars }).filter(([, v]) => v !== undefined)) as Record<string, string>
    });

    try {
      // Aumentar timeout para 120 segundos para servidores remotos
      const connectionTimeout = serverCommand.includes('npx') ? 120000 : 30000;
      
      await this.client.connect(this.transport);
      this.isConnected = true;
      console.log("Conectado ao servidor MCP.");
    } catch (error) {
      console.error("Erro ao conectar ao servidor MCP:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected && this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        this.transport = null;
        console.log("Desconectado do servidor MCP.");
      } catch (error) {
        console.error("Erro ao desconectar do servidor MCP:", error);
      }
    }
  }

  async listTools() {
    if (!this.isConnected) {
      throw new Error("Cliente não está conectado ao servidor MCP");
    }

    try {
      const toolsResult = await this.client.listTools();
      return toolsResult.tools;
    } catch (error) {
      console.error("Erro ao listar ferramentas:", error);
      throw error;
    }
  }

  async executePrompt(prompt: string) {
    if (!this.isConnected) {
      throw new Error("Cliente não está conectado ao servidor MCP");
    }

    try {
      // Listar ferramentas disponíveis
      const mcpTools = await this.listTools();

      // Converter ferramentas MCP para formato OpenAI
      const openAiTools = mcpTools.map((tool) => {
        const normalizedName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        return {
          type: "function" as const,
          function: {
            name: normalizedName,
            description: tool.description,
            parameters: {
              type: "object",
              properties: tool.inputSchema?.properties || {},
              required: tool.inputSchema?.required || [],
            },
          },
        };
      });

      const messages: any[] = [
        {
          role: "user",
          content: prompt,
        },
      ];

      console.log("Enviando mensagem ao modelo:", prompt);

      // Criar mapeamento de nomes normalizados para nomes originais
      const nameMapping = new Map();
      mcpTools.forEach(tool => {
        const normalizedName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        nameMapping.set(normalizedName, tool.name);
      });

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: openAiTools,
        tool_choice: "auto",
        max_tokens: 1000,
      });

      const choices = response.choices;
      let toolResults: ToolResult[] = [];

      // Executar chamadas de ferramentas
      await Promise.all(
        choices.map(async (choice) => {
          const message = choice.message;
          if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              const normalizedToolName = toolCall.function.name;
              const originalToolName = nameMapping.get(normalizedToolName) || normalizedToolName;
              const toolArgs = JSON.parse(toolCall.function.arguments);

              console.log(`Chamando ferramenta ${originalToolName} com argumentos:`, toolArgs);

              const result = await this.client.callTool({
                name: originalToolName,
                arguments: toolArgs,
              });

              toolResults.push({
                tool_call_id: toolCall.id,
                output: result,
              });
            }
          }
        })
      );

      // Se houver resultado de tool, enviar nova mensagem para o modelo
      if (toolResults.length > 0) {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: response.choices[0].message.tool_calls,
        });

        for (const toolResult of toolResults) {
          messages.push({
            role: "tool",
            tool_call_id: toolResult.tool_call_id,
            content: JSON.stringify(toolResult.output),
          });
        }

        const finalResponse = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          max_tokens: 1000,
        });

        return {
          success: true,
          response: finalResponse.choices[0].message.content,
          toolsUsed: toolResults.map(tr => tr.output),
          messages: messages
        };
      } else {
        return {
          success: true,
          response: response.choices[0].message.content,
          toolsUsed: [],
          messages: messages
        };
      }

    } catch (error) {
      console.error("Erro ao executar prompt:", error);
      return {
        success: false,
        error: (error as Error).message,
        response: null
      };
    }
  }
}

