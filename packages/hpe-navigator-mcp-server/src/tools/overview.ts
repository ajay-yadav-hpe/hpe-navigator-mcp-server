import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const getOverviewSchema = z.object({
  product: z.string().describe("Product API path (e.g., 'arcus', 'scality/dsc')"),
  serial: z.string().describe('Hardware serial number'),
})

export async function getOverview(
  client: NavigatorClient,
  params: z.infer<typeof getOverviewSchema>,
) {
  try {
    const result = await client.getOverview(params.product, params.serial)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get overview')
  }
}

export const getOverviewTool = {
  name: 'navigator_get_overview',
  description:
    'Get comprehensive system overview including heartbeat status, OS version, storage capacity, hardware health (nodes, PDs, PSUs, cages), and space utilization.',
  inputSchema: getOverviewSchema,
  handler: getOverview,
}
