# node-red-contrib-mcp-tools

A Node-RED node for connecting to [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers and executing AI prompts with tool use — no extra containers or services required.

Supports **OpenAI**, **Anthropic**, **Google Gemini**, and **OpenRouter** as LLM providers. Connects to MCP servers via **Stdio** (local process) or **Streamable HTTP** (remote URL).

---

## Installation

### Via Palette Manager (recommended)

1. Open Node-RED → hamburger menu → **Manage Palette**
2. Go to the **Install** tab
3. Search for `node-red-contrib-mcp-tools` and click **Install**

### Via terminal

```bash
cd ~/.node-red
npm install node-red-contrib-mcp-tools
```

Restart Node-RED after installation. The node appears in the **function** category.

---

## Quick Start

### Streamable HTTP (zero setup)

The simplest way to use the node — connect to a remote MCP server with just a URL:

1. Drag an `mcp-tools` node into your flow
2. Set **Transport Type** → `Streamable HTTP`
3. Enter the **MCP Server URL**, e.g. `https://mcp.exa.ai/mcp`
4. Enter your **Bearer Token** if the server requires auth, e.g. `{{EXA_API_KEY}}`
5. Set your **LLM Provider** and **API Key**
6. Connect an inject node with a prompt string and deploy

### Stdio (local process)

For running a local MCP server process inside the container:

1. Set **Transport Type** → `Stdio`
2. Configure **MCP Servers** with the command and args:

```json
{
  "mcpServers": {
    "demo": {
      "command": "node",
      "args": ["/data/mcp-server-demo/build/index.js"]
    }
  }
}
```

---

## Node Configuration

### LLM Provider

| Field | Description |
|-------|-------------|
| **LLM Provider** | `openai`, `anthropic`, `gemini`, or `openrouter` |
| **Model** | Model name — leave empty to use the provider default |
| **API Key** | Your provider API key. Use `{{ENV_VAR_NAME}}` to reference an environment variable |

**Default models per provider:**

| Provider | Default model |
|----------|--------------|
| OpenAI | `gpt-4o` |
| Anthropic | `claude-sonnet-4-6` |
| Gemini | `gemini-2.5-pro` |
| OpenRouter | `openai/gpt-4o` |

### Transport Type

**Streamable HTTP** — remote MCP server via URL:

| Field | Description |
|-------|-------------|
| **MCP Server URL** | Full HTTPS URL of the MCP endpoint |
| **Bearer Token** | Auth token for the server. Use `{{MY_API_KEY}}` for env var substitution. Leave empty to use `SMITHERY_KEY` automatically. |

**Stdio** — local MCP server process:

| Field | Description |
|-------|-------------|
| **MCP Servers Configuration** | JSON object with server names and their `command`/`args` |
| **MCP Server Environment Variables** | JSON object of env vars to pass to the server process |

### Other fields

| Field | Description |
|-------|-------------|
| **Prompt** | Default prompt. Can be overridden by `msg.prompt` or `msg.payload` |
| **Timeout** | Connection timeout in ms (default: 30000; auto-set to 300000 for `npx` servers) |

---

## `{{VAR_NAME}}` Environment Variable Substitution

Any field that accepts a `{{VAR_NAME}}` token will be substituted at runtime:

```
Priority: MCP Server Envs field > container environment (process.env)
```

**Supported fields:**
- `API Key` → `{{OPENAI_API_KEY}}`
- `Bearer Token` → `{{EXA_API_KEY}}`
- `args[]` entries → `{{MY_SERVER_PATH}}`
- Prompt text → `{{MY_VALUE}}`
- `MCP Server Environment Variables` → `{{ENV_MCP_VARIABLES}}` (must resolve to a JSON object string)

---

## MCP Servers Configuration (Stdio mode)

### Single local server

```json
{
  "mcpServers": {
    "demo": {
      "command": "node",
      "args": ["/data/mcp-server-demo/build/index.js"]
    }
  }
}
```

### NPX-based server (Smithery)

```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": [
        "-y", "@smithery/cli@latest", "run", "exa",
        "--key", "{{SMITHERY_KEY}}",
        "--profile", "{{SMITHERY_PROFILE}}"
      ]
    }
  }
}
```

> **Note:** `npx`-based servers automatically get a 300s connection timeout to allow package download on first run.

### Multiple servers

When multiple servers are configured, the node automatically selects the best one based on keyword matching in the prompt.

```json
{
  "mcpServers": {
    "search": {
      "command": "node",
      "args": ["/data/search-server/index.js"]
    },
    "database": {
      "command": "node",
      "args": ["/data/db-server/index.js"]
    }
  }
}
```

### Remote HTTP server (in Stdio config)

```json
{
  "mcpServers": {
    "remote": {
      "url": "https://mcp.example.com/mcp",
      "token": "{{MY_TOKEN}}"
    }
  }
}
```

---

## Inputs

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | string | Prompt to execute (used if `msg.prompt` is not set) |
| `msg.prompt` | string | Prompt — overrides the node's default prompt |
| `msg.provider` | string | LLM provider override |
| `msg.model` | string | Model override |
| `msg.apiKey` | string | API key override |
| `msg.mcpServers` | string/object | MCP servers config override (Stdio mode) |
| `msg.mcpServerUrl` | string | MCP server URL override (HTTP mode) |
| `msg.mcpServerToken` | string | Bearer token override (HTTP mode) |
| `msg.mcpServerEnvs` | string/object | Server environment variables override |

## Outputs

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | string | Final text response from the LLM |
| `msg.mcpResult` | object | Full result object |
| `msg.mcpResult.success` | boolean | Whether execution succeeded |
| `msg.mcpResult.response` | string | LLM response text |
| `msg.mcpResult.toolsUsed` | array | Names of MCP tools called |
| `msg.mcpResult.messages` | array | Full conversation history |
| `msg.mcpResult.originalPrompt` | string | The prompt that was sent |

---

## Example Flow

```json
[
  {
    "id": "inject1",
    "type": "inject",
    "name": "Ask",
    "props": [{ "p": "payload", "v": "Search for the latest news about MCP protocol", "vt": "str" }],
    "x": 100, "y": 100,
    "wires": [["mcp1"]]
  },
  {
    "id": "mcp1",
    "type": "mcp-tools",
    "name": "MCP Tools",
    "provider": "openai",
    "model": "",
    "apiKey": "{{OPENAI_API_KEY}}",
    "transportType": "http",
    "mcpServerUrl": "https://mcp.exa.ai/mcp",
    "mcpServerToken": "{{EXA_API_KEY}}",
    "prompt": "",
    "timeout": 30000,
    "x": 300, "y": 100,
    "wires": [["debug1"]]
  },
  {
    "id": "debug1",
    "type": "debug",
    "name": "Result",
    "complete": "true",
    "x": 500, "y": 100,
    "wires": []
  }
]
```

---

## Docker Setup

A ready-to-use Docker Compose setup is available at [node-red-mcp-server](https://github.com/moisesfreitas-seven/node-red-mcp-server).

```yaml
services:
  node-red:
    image: nodered/node-red:4.0.0
    ports:
      - "1880:1880"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - EXA_API_KEY=${EXA_API_KEY}
      - SMITHERY_KEY=${SMITHERY_KEY}
```

---

## Troubleshooting

**`invalid_token` error on HTTP transport**
- Check that your Bearer Token field contains the correct env var, e.g. `{{EXA_API_KEY}}`
- Verify the env var is set in your container environment
- Some servers use query-param auth instead: `https://server.smithery.ai/name/mcp?api_key={{SMITHERY_KEY}}`

**`spawn ENOENT` error**
- The MCP server command was not found. Check the `command` and `args` paths.
- For servers inside Docker, paths must be absolute container paths (e.g. `/data/...`)

**`npx` timeout**
- First run downloads the package — this can take 30–60s
- The node auto-sets 300s timeout for `npx` commands

**Provider API key not found**
- Use `{{OPENAI_API_KEY}}` (or the relevant provider env var) in the API Key field
- Or set the env var directly in the container

---

## License

[LGPL-3.0-or-later](https://www.gnu.org/licenses/lgpl-3.0.html)

You may use this node freely in your Node-RED flows, including in commercial and proprietary projects. However, **any modifications to this node's source code must be released under the same LGPL license and contributed back to the project**.
