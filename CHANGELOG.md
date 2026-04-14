# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.2.0] - 2026-04-13
### Added
- Multi-provider LLM support: OpenAI, Anthropic (Claude), Google Gemini, and OpenRouter — each with a dedicated adapter inside the node
- Provider/model selector and transport type UI (stdio / Streamable HTTP) in the Node-RED editor
- MCP server URL and token fields for remote HTTP connections
- Connection reuse across messages when server, provider, model, and env vars are unchanged
- `LICENSE` file (LGPL-3.0-or-later) and `.npmignore` for cleaner npm publishes
- `railway.toml` at repo root so Railway auto-deploys use the correct Node-RED Dockerfile
- `Dockerfile.nodered` for local standalone Docker Compose
- Root `package.json` for repo-level MCP SDK dev dependencies

### Changed
- **Standalone mode**: `MCPClient` is now embedded directly in `mcp-tools.js` — no `mcp-host` container needed
- `docker-compose.yml`: single Node-RED service, `mcp-host` commented out, `./mcp-server/v1` mounted at `/data/mcp-server/v1`
- `node-red-docker/Dockerfile`: build context widened to repo root; copies and compiles `mcp-server/v1` and `gdrive-mcp` at image build time
- `node-red-docker/deploy.sh`: runs from repo root so Docker context includes `mcp-server/v1`; points Railway to the correct Dockerfile
- All internal MCP server flow paths updated to `/data/mcp-server/v1/build/index.js` and `/data/mcp-server/v1/gdrive-mcp/build/index.js`
- Package version bumped `1.0.2 → 2.2.0`; license changed `MIT → LGPL-3.0-or-later`; Node.js engine requirement `>=18.0.0`
- `.gitignore`: excludes `CLAUDE.md`, `docs/`, `openspec/`, `.claude/`, `*.tgz`, Node-RED runtime cache files, and local dev scripts

### Fixed
- Incorrect gdrive-mcp path in flows (`/data/mcp-server/v1/build/gdrive-mcp/build/index.js` → `/data/mcp-server/v1/gdrive-mcp/build/index.js`)
- `gdrive-mcp` TypeScript source was missing compiled output — now built during Docker image build

### Removed
- `mcp-host` container dependency (standalone mode replaces it)
- `node_red_data/mcp-server-demo/` (duplicate — canonical location is `mcp-server/v1/` at repo root)
- Smithery/gnome-keyring system dependencies (not used)
- Runtime-generated files from git tracking: `.config.nodes.json`, `.flows.json.backup`

---

## [1.1.2] - 2025-08-21
### Added
- Monaco Editor integration for JSON configuration with syntax highlighting
- Automatic path conversion for MCP server configurations
- Cloud deployment guidance in MCP Host URL field
- Enhanced environment variable examples and validation

### Changed
- Restructured `mcp-server-demo` to `mcp-server` with `v1` subfolder
- Updated all internal references to use new folder structure
- Improved timeout handling for NPX-based MCP servers (Smithery)
- Enhanced UI with better validation and error handling
- Removed all emojis from code comments and logs for cleaner appearance

### Fixed
- MCP server path resolution issues in Docker environment
- Smithery NPX server timeout and connection problems
- Automatic path conversion for local Node.js servers
- Performance optimization for faster response times

### Removed
- InfluxDB references (not part of current branch)
- Old test files and unused components
- Portuguese language references (translated to English)

---

## [1.1.1] - 2025-08-19
### Added
- Support for multiple MCP servers and native Google Drive MPC.
- Enhanced security for sensitive data and environment variable management using JSON
- Environment variable substitution in MCP server arguments.
- MCP server configuration to use a structured JSON format.

### Changed
- Improved Google Drive MCP node configuration in `flows.json`.
- Enhanced `clean-sensitive-data.sh` script with generic patterns for stronger security.

### Removed
- Hardcoded sensitive data replaced with environment variable placeholders.
---
## [1.0.2] - 2025-08-05
### Added
- Support for sending environment variables
- Fix the connection between containers and handle timeouts.
---

## [1.0.1] - 2025-07-14
### Added
- Railway deployment template
- Support for password via environment variable

---

## [1.0.0] - 2025-07-13
### Added
- MCP core components
- First MCP tools node

---