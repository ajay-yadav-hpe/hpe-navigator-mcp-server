import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const searchDashboardsSchema = z.object({
  tag: z
    .string()
    .describe("Dashboard tag to search (e.g., 'arcus', 'heartbeats', 'stats', 'logs')"),
})

export async function searchDashboards(
  client: NavigatorClient,
  params: z.infer<typeof searchDashboardsSchema>,
) {
  try {
    const result = await client.searchDashboards(params.tag)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to search dashboards')
  }
}

export const searchDashboardsTool = {
  name: 'navigator_search_dashboards',
  description:
    'Search analytics dashboards by tag. Returns dashboard metadata including URLs for direct access to Grafana-style dashboards.',
  inputSchema: searchDashboardsSchema,
  handler: searchDashboards,
}
