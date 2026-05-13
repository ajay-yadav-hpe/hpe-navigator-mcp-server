import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { NavigatorConfig } from './config.js'
import { NavigatorClient } from './client/navigator-client.js'
import { ExtractionClient } from './client/extraction-client.js'
import { findSerialTool } from './tools/find.js'
import { getRelatedTool } from './tools/related.js'
import { getSfdcAssetTool } from './tools/sfdc-assets.js'
import { getFeedTool } from './tools/feed.js'
import { getOverviewTool } from './tools/overview.js'
import { getHeartbeatTool } from './tools/heartbeat.js'
import { listFiletypesTool, listBundlesTool } from './tools/bundles.js'
import { downloadBundleTool } from './tools/download.js'
import { searchDashboardsTool } from './tools/analytics.js'
import { getSystemSummaryTool, getDscvmLogsTool } from './tools/composite.js'

export function createServer(config: NavigatorConfig): McpServer {
  const server = new McpServer({
    name: 'hpe-navigator',
    version: '1.0.0',
  })

  const navClient = new NavigatorClient(config)
  const extractionClient = new ExtractionClient(config)

  // Serial Lookup & Discovery
  server.tool(
    findSerialTool.name,
    findSerialTool.description,
    findSerialTool.inputSchema.shape,
    async (params) => findSerialTool.handler(navClient, params),
  )

  server.tool(
    getRelatedTool.name,
    getRelatedTool.description,
    getRelatedTool.inputSchema.shape,
    async (params) => getRelatedTool.handler(navClient, params),
  )

  // SFDC Asset Management
  server.tool(
    getSfdcAssetTool.name,
    getSfdcAssetTool.description,
    getSfdcAssetTool.inputSchema.shape,
    async (params) => getSfdcAssetTool.handler(navClient, params),
  )

  // System Health & Monitoring
  server.tool(
    getFeedTool.name,
    getFeedTool.description,
    getFeedTool.inputSchema.shape,
    async (params) => getFeedTool.handler(navClient, params),
  )

  server.tool(
    getOverviewTool.name,
    getOverviewTool.description,
    getOverviewTool.inputSchema.shape,
    async (params) => getOverviewTool.handler(navClient, params),
  )

  server.tool(
    getHeartbeatTool.name,
    getHeartbeatTool.description,
    getHeartbeatTool.inputSchema.shape,
    async (params) => getHeartbeatTool.handler(navClient, params),
  )

  // Telemetry Bundles
  server.tool(
    listFiletypesTool.name,
    listFiletypesTool.description,
    listFiletypesTool.inputSchema.shape,
    async (params) => listFiletypesTool.handler(navClient, params),
  )

  server.tool(
    listBundlesTool.name,
    listBundlesTool.description,
    listBundlesTool.inputSchema.shape,
    async (params) => listBundlesTool.handler(navClient, params),
  )

  server.tool(
    downloadBundleTool.name,
    downloadBundleTool.description,
    downloadBundleTool.inputSchema.shape,
    async (params) => downloadBundleTool.handler(extractionClient, params),
  )

  // Analytics & Dashboards
  server.tool(
    searchDashboardsTool.name,
    searchDashboardsTool.description,
    searchDashboardsTool.inputSchema.shape,
    async (params) => searchDashboardsTool.handler(navClient, params),
  )

  // Composite Workflows
  server.tool(
    getSystemSummaryTool.name,
    getSystemSummaryTool.description,
    getSystemSummaryTool.inputSchema.shape,
    async (params) => getSystemSummaryTool.handler(navClient, params),
  )

  server.tool(
    getDscvmLogsTool.name,
    getDscvmLogsTool.description,
    getDscvmLogsTool.inputSchema.shape,
    async (params) => getDscvmLogsTool.handler(navClient, extractionClient, params),
  )

  return server
}
