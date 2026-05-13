# hpe-navigator-mcp-server

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
