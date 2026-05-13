# HPE Navigator MCP — VS Code Extension

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
2. Set credentials in VS Code settings (or `.env` file)
3. The MCP server automatically registers with Copilot
4. Ask Copilot questions about HPE hardware serials

## Building

```bash
pnpm build
pnpm package  # Creates .vsix
```
