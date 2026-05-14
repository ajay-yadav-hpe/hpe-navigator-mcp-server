import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const getRelatedSchema = z.object({
  product: z.string().describe("Product API path (e.g., 'arcus', 'scality/dsc')"),
  serial: z.string().describe('Hardware serial number'),
})

export async function getRelated(
  client: NavigatorClient,
  params: z.infer<typeof getRelatedSchema>,
) {
  try {
    const result = await client.getRelated(params.product, params.serial)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get related products')
  }
}

export const getRelatedTool = {
  name: 'navigator_get_related',
  description:
    'Get related products in a solution. Returns all products associated with a serial number (e.g., DSConnector VMs, storage arrays in same PCBE solution).',
  inputSchema: getRelatedSchema,
  handler: getRelated,
}
