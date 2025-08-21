# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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