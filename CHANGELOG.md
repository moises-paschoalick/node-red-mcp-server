# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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