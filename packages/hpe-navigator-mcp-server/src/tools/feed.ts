import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const getFeedSchema = z.object({
  product: z.string().describe("Product API path (e.g., 'arcus', 'scality/dsc')"),
  serial: z.string().describe('Hardware serial number'),
})

export async function getFeed(client: NavigatorClient, params: z.infer<typeof getFeedSchema>) {
  try {
    const result = await client.getFeed(params.product, params.serial)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get feed')
  }
}

export const getFeedTool = {
  name: 'navigator_get_feed',
  description:
    'Get system status feed/alerts. Returns critical/warning status alerts for a system (security issues, configuration anomalies).',
  inputSchema: getFeedSchema,
  handler: getFeed,
}
