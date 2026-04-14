import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import FormData from "form-data";
import fs from "fs";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

type WeatherResponse = {
  current_condition: Array<{
    temp_C: string;
    FeelsLikeC: string;
    weatherDesc: Array<{ value: string }>;
  }>;
};

// Initialize server with resource capabilities
const server = new Server(
  {
    name: "hello-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {      
       // Tools visíveis no "tool list"
       tools: {
        "hello://world": {
          name: "Hello Tool",
          description: "Responds with a hello world message",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        "api://users": {
          name: "Users Tool",
          description: "Fetches a list of users from an external API",
          inputSchema: {
            type: "object",
            properties: {},
          },
        }
      },
      resources: {
        "hello://world": {
          name: "Hello World Message",
          description: "A simple greeting message",
          mimeType: "text/plain",
        },
        "api://time": {
          name: "Local Time",
          description: "Displays the current local time using @tool time",
          mimeType: "application/json",
        },
        "api://weather": {
          name: "São Paulo Weather",
          description: "Fetches weather data from wttr.in for São Paulo in JSON format",
          mimeType: "application/json",
        }
      },
    },
  }
);

// Implementação da listagem de tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      uri: "hello://world",
      name: "Hello Tool",
      description: "Responds with a hello world message",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      uri: "api://time",
      name: "Time Tool",
      description: "Returns the current local time",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      uri: "api://weather",
      name: "Weather Tool",
      description: "Fetches current weather data for São Paulo",
      inputSchema: {
        type: "object",
        properties: {},
      },
    }
  ],
}));

// Implementação da execução das tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === "Hello Tool") {
    return {
      content: [
        {
          type: "text",
          text: "Hello, World! This is a tool response!",
        },
      ],
    };
  }

  if (name === "Time Tool") {
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return {
      content: [
        {
          type: "text",
          text: `Current local time (São Paulo): ${now}`,
        },
      ],
    };
  }

if (name === "Weather Tool") {
  try {
    const response = await fetch("https://wttr.in/Sao+Paulo?format=j1");
     const weather = await response.json() as any;
    const current = weather?.current_condition?.[0];

    const text = current
      ? `🌤️ Clima em São Paulo:\nTemperatura: ${current.temp_C}°C\nSensação térmica: ${current.FeelsLikeC}°C\nCondição: ${current.weatherDesc?.[0]?.value}`
      : "Não foi possível obter os dados do clima.";

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  } catch (error: any) {
    throw new Error(`Error getting the weather: ${error?.message || "Unknown error"}`);
  }
}

  throw new Error("Tool not found");
});


// List available resources when clients request them
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "hello://world",
        name: "Hello World Message",
        description: "A simple greeting message",
        mimeType: "text/plain",
      },
      {
        uri: "api://time",
        name: "Local Time",
        description: "Current local time for São Paulo",
        mimeType: "application/json",
      },
      {
        uri: "api://weather",
        name: "São Paulo Weather",
        description: "Weather data from wttr.in",
        mimeType: "application/json",
      },
    ],
  };
});

// Return resource content when clients request it
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "hello://world") {
    return {
      contents: [
        {
          uri: "hello://world",
          text: "Hello, World! This is my first MCP resource.",
        },
      ],
    };
  }
  
  if (request.params.uri === "api://time") {
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return {
      contents: [
        {
          uri: "api://time",
          text: `Current local time (São Paulo): ${now}`,
        },
      ],
    };
  }

if (request.params.uri === "api://weather") {
    try {
      const response = await fetch("https://wttr.in/Sao+Paulo?format=j1");
      const weather = await response.json();
      return {
        contents: [
          {
            uri: "api://weather",
            text: JSON.stringify(weather, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Error getting the weather: ${error?.message || "Unknown error"}`);
    }
  }

  
  throw new Error("Resource not found");
});

// Start server using stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.info('{"jsonrpc": "2.0", "method": "log", "params": { "message": "Server running..." }}');