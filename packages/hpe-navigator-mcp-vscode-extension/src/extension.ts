import * as vscode from 'vscode'

// Read version dynamically from package.json so VSIX version stays in sync
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string }

export function activate(context: vscode.ExtensionContext) {
  const serverPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server', 'index.js').fsPath

  // REQUIRED: emitter so VS Code refreshes the MCP panel when settings change
  const emitter = new vscode.EventEmitter<void>()
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('hpeNavigator')) emitter.fire()
    }),
  )

  const disposable = vscode.lm.registerMcpServerDefinitionProvider('hpe-navigator', {
    onDidChangeMcpServerDefinitions: emitter.event,
    provideMcpServerDefinitions(_token: vscode.CancellationToken) {
      const config = vscode.workspace.getConfiguration('hpeNavigator')

      // ALWAYS return the server — NEVER return [] based on config state.
      // Let the server itself handle missing config with a clear error message.
      return [
        new vscode.McpStdioServerDefinition(
          'HPE Navigator',
          process.execPath,
          [serverPath],
          {
            HPE_NAV_USERNAME: config.get<string>('username') ?? '',
            HPE_NAV_PASSWORD: config.get<string>('password') ?? '',
            HPE_NAV_SERVICE_TOKEN: config.get<string>('serviceToken') ?? '',
            HPE_NAV_CXO_BASE_URL:
              config.get<string>('cxoBaseUrl') ?? 'https://web.service.cxo.suptools.hpecorp.net',
            HPE_NAV_EXTRACTION_BASE_URL:
              config.get<string>('extractionBaseUrl') ??
              'https://extraction.service.cxo.suptools.hpecorp.net',
            HPE_NAV_OKTA_REDIRECT_URI:
              config.get<string>('oktaRedirectUri') ??
              'https://navigator.service.suptools.hpecorp.net/oidc/callback',
            HPE_NAV_TLS_REJECT_UNAUTHORIZED: String(
              config.get<boolean>('tlsRejectUnauthorized') !== false,
            ),
            HPE_NAV_DOWNLOAD_DIR: config.get<string>('downloadDir') ?? './downloads',
            HPE_NAV_TIMEOUT_MS: String(config.get<number>('timeoutMs') ?? 30000),
            HPE_NAV_DOWNLOAD_TIMEOUT_MS: String(config.get<number>('downloadTimeoutMs') ?? 600000),
            HPE_NAV_MAX_DOWNLOAD_SIZE_MB: String(config.get<number>('maxDownloadSizeMb') ?? 500),
          },
          version,
        ),
      ]
    },
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
