# Node-RED MCP Tools Component

This is a Node-RED component that enables the execution of MCP Servers (Model Context Protocol).

## Installation

### Installation via npm

1. Open the Node-RED user interface in your browser (e.g., `http://localhost:1880`).
2. Click the **menu icon** (three horizontal lines) in the top-right corner.
3. Select **Manage Palette** from the dropdown menu.
4. Go to the **Install** tab.
5. In the search bar, type `node-red-contrib-mcp-tools` and click **Install**.

![Node-RED mcp-tools installation](https://github.com/moises-paschoalick/node-red-mcp-server/blob/main/assets/01.png?raw=true)


## Alternatively, install via the terminal:

```bash
npm install node-red-contrib-mcp-tools
### Installation via npm
```

It will appear in the function category.


![Node-RED mcp-tools](https://github.com/moises-paschoalick/node-red-mcp-server/blob/main/assets/02.png?raw=true)

## Configuration

### 1. First Step: Run the MCP Host

Before starting, you need to have the **MCP Host** running. Use the code available in the [`mcp-host`](https://github.com/moises-paschoalick/node-red-mcp-server/mcp-host) folder.

The **MCP Host** is a Node.js application responsible for mediating communication between **Node-RED** and the **MCP Server**.

You can run an MCP Server in different ways:

- 💻 **Locally** on your machine;
- 🐳 **In a Docker container**,
- 🌐 **Remotely**, connecting to an MCP Host already available on another server.

Running locally:

```bash
cd mcp-host
npm install
npm start
```

The server will run by default on port 3000.

### 2. Component Configuration

- **Server URL**: URL where the MCP service is running (e.g., `http://localhost:3000`) or `http://host.docker.internal:3000` if running with Docker.
- **Default Prompt**: Optional prompt that will be used if not provided in the message.

For more information on running with Docker Compose, see:
https://github.com/moises-paschoalick/node-red-mcp-server

## Usage

### Inputs

- `msg.payload` (string): The prompt to be sent to the MCP tools.
- `msg.prompt` (string): Specific prompt (overrides the default prompt).

### Outputs

- `msg.payload` (string): The response from the MCP tools.
- `msg.mcpResult` (object): Detailed object containing:
  - `success`: Whether the execution was successful.
  - `response`: The tool's response.
  - `toolsUsed`: Array of tools used.
  - `messages`: Complete conversation history.
  - `originalPrompt`: The original prompt sent.

## Example Flow

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Test MCP",
        "props": [
            {
                "p": "payload",
                "v": "display user information",
                "vt": "str"
            }
        ],
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "topic": "",
        "x": 100,
        "y": 100,
        "wires": [["mcp1"]]
    },
    {
        "id": "mcp1",
        "type": "mcp-tools",
        "name": "MCP Tools",
        "serverUrl": "http://localhost:3000",
        "prompt": "",
        "timeout": 30000,
        "x": 300,
        "y": 100,
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Result",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "x": 500,
        "y": 100,
        "wires": []
    }
]
```

## Features

- ✅ Execution of prompts via the MCP tools component.
- ✅ Support for dynamic prompts via message.
- ✅ Flexible server configuration.
- ✅ Visual node status (running, success, error).
- ✅ Detailed output with tools used.

## Troubleshooting

### Connection Error
- Check if the MCP server is running.
- Confirm the server URL in the configuration.
- Ensure no firewall is blocking the connection.

### Timeout
- Increase the timeout value if operations take longer.
- Check the MCP server's performance.

### Parsing Error
- Verify if the server is returning valid JSON.
- Confirm that the MCP server is functioning correctly.

## License

MIT
