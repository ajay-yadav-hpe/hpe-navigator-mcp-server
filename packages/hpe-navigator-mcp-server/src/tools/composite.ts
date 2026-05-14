import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import type { ExtractionClient } from '../client/extraction-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

/**
 * Maps the product identifier returned by findSerial (e.g., "dsc", "arcus")
 * to the API path prefix the CXO backend expects for query endpoints.
 * Products not in this map are passed through as-is.
 */
const PRODUCT_API_PATHS: Record<string, string> = {
  dsc: 'scality/dsc',
}

function resolveProductPath(product: string): string {
  return PRODUCT_API_PATHS[product] ?? product
}

export const getSystemSummarySchema = z.object({
  serial: z.string().describe('Hardware serial number'),
})

export async function getSystemSummary(
  navClient: NavigatorClient,
  params: z.infer<typeof getSystemSummarySchema>,
) {
  try {
    const findResult = await navClient.findSerial(params.serial)
    if (!findResult.data.length) {
      return formatError(`Serial number '${params.serial}' not found`)
    }

    const product = findResult.data[0]
    const productPath = resolveProductPath(product.product)

    const [overview, feed, sfdc] = await Promise.allSettled([
      navClient.getOverview(productPath, params.serial),
      navClient.getFeed(productPath, params.serial),
      navClient.getSfdcAsset(params.serial),
    ])

    return formatSuccess({
      product,
      overview: overview.status === 'fulfilled' ? overview.value.data : null,
      feed: feed.status === 'fulfilled' ? feed.value.data : null,
      sfdc: sfdc.status === 'fulfilled' ? sfdc.value.data : null,
      errors: [
        overview.status === 'rejected' ? `overview: ${overview.reason}` : null,
        feed.status === 'rejected' ? `feed: ${feed.reason}` : null,
        sfdc.status === 'rejected' ? `sfdc: ${sfdc.reason}` : null,
      ].filter(Boolean),
    })
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get system summary')
  }
}

export const getDscvmLogsSchema = z.object({
  serial: z.string().describe('DSCVM serial number'),
  date: z.string().describe("Target date ISO 8601 (e.g., '2026-05-13')"),
  download: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to download the file(s) locally'),
  includeComplog: z
    .boolean()
    .optional()
    .default(true)
    .describe('Also look for complog bundles (on-demand logs, may not exist)'),
})

export async function getDscvmLogs(
  navClient: NavigatorClient,
  extractionClient: ExtractionClient,
  params: z.infer<typeof getDscvmLogsSchema>,
) {
  try {
    const dateStart = new Date(params.date)
    dateStart.setUTCHours(0, 0, 0, 0)
    const dateEnd = new Date(params.date)
    dateEnd.setUTCHours(23, 59, 59, 999)

    const fromTs = dateStart.toISOString()
    const toTs = dateEnd.toISOString()

    const types = ['dailylog']
    if (params.includeComplog) types.push('complog')

    const results: Array<{
      type: string
      bundles: unknown[]
      downloaded?: Array<{ localPath: string; size: number }>
    }> = []

    for (const type of types) {
      const bundleResult = await navClient.listBundles(
        'scality/dsc',
        params.serial,
        fromTs,
        toTs,
        type,
      )
      const entry: (typeof results)[number] = { type, bundles: bundleResult.data }

      if (params.download && bundleResult.data.length > 0) {
        const downloads = []
        for (const bundle of bundleResult.data) {
          const dl = await extractionClient.downloadBundle(bundle.bucket, bundle.path)
          downloads.push(dl)
        }
        entry.downloaded = downloads
      }

      results.push(entry)
    }

    return formatSuccess({
      serial: params.serial,
      date: params.date,
      results,
    })
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get DSCVM logs')
  }
}

export const getSystemSummaryTool = {
  name: 'navigator_get_system_summary',
  description:
    'Get comprehensive system summary. Calls find → overview → feed → SFDC assets in sequence, returning a unified summary for support triage.',
  inputSchema: getSystemSummarySchema,
  handler: getSystemSummary,
}

export const getDscvmLogsTool = {
  name: 'navigator_get_dscvm_logs',
  description:
    'Get DSCVM daily logs (and complogs) by date. Finds and optionally downloads DSConnector log files for a specific date. Downloads both dailylog (always available) and complog (on-demand, may not exist).',
  inputSchema: getDscvmLogsSchema,
  handler: getDscvmLogs,
}
