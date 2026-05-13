import * as vscode from 'vscode'
import { join } from 'node:path'

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('hpeNavigator')
  const enabled = config.get<boolean>('enabled', true)

  if (!enabled) {
    return
  }

  const serverPath = join(
    context.extensionPath,
    '..',
    'hpe-navigator-mcp-server',
    'dist',
    'index.js',
  )

  const env: Record<string, string> = {}
  const username = config.get<string>('username', '')
  const password = config.get<string>('password', '')
  const serviceToken = config.get<string>('serviceToken', '')
  const cxoBaseUrl = config.get<string>('cxoBaseUrl', '')
  const extractionBaseUrl = config.get<string>('extractionBaseUrl', '')
  const downloadDir = config.get<string>('downloadDir', '')
  const timeoutMs = config.get<number>('timeoutMs', 30000)
  const downloadTimeoutMs = config.get<number>('downloadTimeoutMs', 600000)
  const maxDownloadSizeMb = config.get<number>('maxDownloadSizeMb', 500)

  if (username) env.HPE_NAV_USERNAME = username
  if (password) env.HPE_NAV_PASSWORD = password
  if (serviceToken) env.HPE_NAV_SERVICE_TOKEN = serviceToken
  if (cxoBaseUrl) env.HPE_NAV_CXO_BASE_URL = cxoBaseUrl
  if (extractionBaseUrl) env.HPE_NAV_EXTRACTION_BASE_URL = extractionBaseUrl
  if (downloadDir) env.HPE_NAV_DOWNLOAD_DIR = downloadDir
  if (timeoutMs) env.HPE_NAV_TIMEOUT_MS = String(timeoutMs)
  if (downloadTimeoutMs) env.HPE_NAV_DOWNLOAD_TIMEOUT_MS = String(downloadTimeoutMs)
  if (maxDownloadSizeMb) env.HPE_NAV_MAX_DOWNLOAD_SIZE_MB = String(maxDownloadSizeMb)

  const serverDefinition: vscode.McpStdioServerDefinition = {
    type: 'stdio',
    label: 'HPE Navigator',
    command: 'node',
    args: [serverPath],
    env,
  }

  const disposable = vscode.lm.registerMcpServerDefinitionProvider('hpe-navigator', {
    provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
      return [serverDefinition]
    },
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {
  // cleanup handled by disposables
}
