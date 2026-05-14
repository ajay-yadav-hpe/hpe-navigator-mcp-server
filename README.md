<p align="center">
  <img src="logo.png" alt="HPE Navigator MCP" width="300" height="300" />
</p>

<h1 align="center">HPE Navigator MCP Server</h1>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="Node.js >= 20" />
  <img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible" />
  <img src="https://img.shields.io/badge/tools-12-orange.svg" alt="12 Tools" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage-91%25%2B-brightgreen.svg" alt="Coverage 91%+" />
  <img src="https://img.shields.io/badge/CI-passing-brightgreen.svg" alt="CI passing" />
</p>

A **Model Context Protocol (MCP) server** that enables AI assistants (Claude, GitHub Copilot, etc.) to interact with **HPE Navigator** — HPE's internal support operations platform for storage hardware triage.

## Features

- **12 MCP Tools** for serial lookup, system health, SFDC assets, telemetry bundles, and dashboards
- **Three auth strategies**: service token, username/password, or Okta browser SSO
- **VS Code extension** for seamless integration with GitHub Copilot
- **Streaming downloads** for large telemetry bundles (100+ MB)
- **Composite workflows** for common support triage patterns

## Quick Start

### Option 1: VS Code Extension (Recommended)

1. Install the `hpe-navigator-mcp` extension
2. Configure in VS Code settings:
   ```json
   {
     "hpeNavigator.username": "you@hpe.com",
     "hpeNavigator.password": "your-password"
   }
   ```
3. The MCP server auto-registers with GitHub Copilot

### Option 2: Standalone MCP Server

```bash
# Install
npm install -g hpe-navigator-mcp-server

# Configure
export HPE_NAV_USERNAME="you@hpe.com"
export HPE_NAV_PASSWORD="your-password"

# Run
hpe-navigator-mcp-server
```

### Option 3: Claude Desktop / MCP Client

Add to your MCP client config:

```json
{
  "mcpServers": {
    "hpe-navigator": {
      "command": "node",
      "args": ["/path/to/hpe-navigator-mcp-server/dist/index.js"],
      "env": {
        "HPE_NAV_USERNAME": "you@hpe.com",
        "HPE_NAV_PASSWORD": "your-password"
      }
    }
  }
}
```

## Tools

| Tool                           | Description                        |
| ------------------------------ | ---------------------------------- |
| `navigator_find_serial`        | Find product by serial number      |
| `navigator_get_related`        | Get related products in a solution |
| `navigator_get_sfdc_asset`     | Get Salesforce asset details       |
| `navigator_get_feed`           | Get system status alerts           |
| `navigator_get_overview`       | Get system overview                |
| `navigator_get_heartbeat`      | Get heartbeat telemetry            |
| `navigator_list_filetypes`     | List available file types          |
| `navigator_list_bundles`       | List bundles by date range         |
| `navigator_download_bundle`    | Download telemetry bundle          |
| `navigator_search_dashboards`  | Search analytics dashboards        |
| `navigator_get_system_summary` | Composite triage summary           |
| `navigator_get_dscvm_logs`     | DSCVM log retrieval workflow       |

## Common Workflows

### Triage a Serial Number

```
"What's the status of CZ2D3J050T?"
→ find_serial → overview → feed → AI summarizes health & alerts
```

### Pull Support Case Info

```
"Show me open cases for CZ2D3J050T"
→ get_sfdc_asset → lists cases with priority & escalation status
```

### Download DSCVM Logs

```
"Get yesterday's DSCVM logs for 3TKFTAPMJ4XZ23G3"
→ get_dscvm_logs (download=true) → confirms download location
```

## Configuration

| Variable                       | Required | Description        | Default                                               |
| ------------------------------ | -------- | ------------------ | ----------------------------------------------------- |
| `HPE_NAV_USERNAME`             | Yes\*    | HPE email          | —                                                     |
| `HPE_NAV_PASSWORD`             | Yes\*    | HPE password       | —                                                     |
| `HPE_NAV_SERVICE_TOKEN`        | Alt      | Pre-obtained JWT   | —                                                     |
| `HPE_NAV_CXO_BASE_URL`         | No       | CXO API URL        | `https://web.service.cxo.suptools.hpecorp.net`        |
| `HPE_NAV_EXTRACTION_BASE_URL`  | No       | Extraction URL     | `https://extraction.service.cxo.suptools.hpecorp.net` |
| `HPE_NAV_TIMEOUT_MS`           | No       | API timeout        | `30000`                                               |
| `HPE_NAV_DOWNLOAD_DIR`         | No       | Download directory | `./downloads`                                         |
| `HPE_NAV_MAX_DOWNLOAD_SIZE_MB` | No       | Max file size      | `500`                                                 |

---

## Architecture

```
┌──────────────┐     MCP (stdio)      ┌───────────────────────┐
│  AI Client   │ ◄──────────────────► │  HPE Navigator MCP    │
│  (Copilot)   │                      │  Server (Node.js)     │
└──────────────┘                      └────────┬──────────────┘
                                               │ HTTPS
                                    ┌──────────┼──────────┐
                                    ▼          ▼          ▼
                             ┌──────────┐ ┌────────┐ ┌────────────┐
                             │ CXO API  │ │ Okta   │ │ Extraction │
                             └──────────┘ └────────┘ └────────────┘
```
