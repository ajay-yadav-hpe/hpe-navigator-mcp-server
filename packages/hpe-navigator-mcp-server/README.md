<p align="center">
  <img src="../../logo.svg" alt="HPE Navigator MCP" width="96" height="96" />
</p>

<h1 align="center">hpe-navigator-mcp-server</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible" />
  <img src="https://img.shields.io/badge/tools-12-orange.svg" alt="12 Tools" />
</p>

MCP server package for HPE Navigator. Exposes 12 tools for hardware serial lookup, system health monitoring, SFDC asset management, telemetry bundle retrieval, and analytics dashboard discovery.

## Installation

```bash
npm install hpe-navigator-mcp-server
```

## Usage

```bash
# As CLI
export HPE_NAV_USERNAME="you@hpe.com"
export HPE_NAV_PASSWORD="your-password"
hpe-navigator-mcp-server
```

## Tools

See the [root README](../../README.md) for full tool documentation.

## Development

```bash
pnpm build     # Build with tsup
pnpm test      # Run tests
pnpm lint      # Run ESLint
```
