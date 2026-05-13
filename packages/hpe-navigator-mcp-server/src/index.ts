import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { createServer } from './server.js'

async function main() {
  const config = loadConfig()

  // Apply TLS settings before any network calls
  if (!config.tlsRejectUnauthorized) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    console.error(
      'Warning: TLS certificate verification is disabled (HPE_NAV_TLS_REJECT_UNAUTHORIZED=false)',
    )
  }

  const server = createServer(config)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('HPE Navigator MCP Server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
