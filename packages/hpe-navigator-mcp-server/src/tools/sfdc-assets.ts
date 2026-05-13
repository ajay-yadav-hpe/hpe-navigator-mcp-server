import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const getSfdcAssetSchema = z.object({
  serial: z.string().describe('Hardware serial number'),
})

export async function getSfdcAsset(
  client: NavigatorClient,
  params: z.infer<typeof getSfdcAssetSchema>,
) {
  try {
    const result = await client.getSfdcAsset(params.serial)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get SFDC asset')
  }
}

export const getSfdcAssetTool = {
  name: 'navigator_get_sfdc_asset',
  description:
    'Get full Salesforce asset details for a serial number. Returns support dates, SLA, account, contact, open/closed cases, and engineering escalations.',
  inputSchema: getSfdcAssetSchema,
  handler: getSfdcAsset,
}
