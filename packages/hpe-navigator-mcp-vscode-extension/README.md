<p align="center">
  <img src="logo.png" alt="HPE Navigator MCP" width="300" height="150" />
</p>

<h1 align="center">HPE Navigator MCP — VS Code Extension</h1>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-%3E%3D1.99-007ACC.svg" alt="VS Code >= 1.99" />
  <img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
</p>

Registers the HPE Navigator MCP server with VS Code's GitHub Copilot integration via `mcpServerDefinitionProviders`.

## Configuration

All settings are under `hpeNavigator.*` in VS Code settings:

| Setting                     | Type    | Default                                        | Description                   |
| --------------------------- | ------- | ---------------------------------------------- | ----------------------------- |
| `hpeNavigator.enabled`      | boolean | `true`                                         | Enable/disable the MCP server |
| `hpeNavigator.username`     | string  | `""`                                           | HPE email for auth            |
| `hpeNavigator.password`     | string  | `""`                                           | HPE password (headless login) |
| `hpeNavigator.serviceToken` | string  | `""`                                           | Pre-obtained CXO JWT          |
| `hpeNavigator.cxoBaseUrl`   | string  | `https://web.service.cxo.suptools.hpecorp.net` | CXO API URL                   |
| `hpeNavigator.downloadDir`  | string  | `./downloads`                                  | Bundle download directory     |
| `hpeNavigator.timeoutMs`    | number  | `30000`                                        | API timeout                   |

## Usage

1. Install the extension
2. Set credentials in VS Code settings
3. The MCP server automatically registers with Copilot
4. Ask Copilot questions about HPE hardware serials

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