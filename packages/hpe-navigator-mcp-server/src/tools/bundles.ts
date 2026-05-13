import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const listFiletypesSchema = z.object({
  product: z.string().describe("Product type (e.g., 'arcus', 'dsc')"),
})

export async function listFiletypes(
  client: NavigatorClient,
  params: z.infer<typeof listFiletypesSchema>,
) {
  try {
    const result = await client.listFiletypes(params.product)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to list filetypes')
  }
}

export const listBundlesSchema = z.object({
  product: z.string().describe("Product type (e.g., 'arcus', 'dsc')"),
  serial: z.string().describe('Hardware serial number'),
  fromTs: z.string().describe("Start datetime ISO 8601 (e.g., '2026-05-08T00:00:00.000Z')"),
  toTs: z.string().describe("End datetime ISO 8601 (e.g., '2026-05-13T23:59:59.000Z')"),
  type: z
    .string()
    .optional()
    .describe("Filter by file type (e.g., 'config', 'dailylog', 'insplore', 'heartbeat')"),
  latest: z.boolean().optional().default(false).describe('Return only the latest bundle'),
})

export async function listBundles(
  client: NavigatorClient,
  params: z.infer<typeof listBundlesSchema>,
) {
  try {
    const result = await client.listBundles(
      params.product,
      params.serial,
      params.fromTs,
      params.toTs,
      params.type,
      params.latest,
    )
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to list bundles')
  }
}

export const listFiletypesTool = {
  name: 'navigator_list_filetypes',
  description:
    'List available telemetry file types for a product (e.g., config, insplore, heartbeat, alert, dailylog).',
  inputSchema: listFiletypesSchema,
  handler: listFiletypes,
}

export const listBundlesTool = {
  name: 'navigator_list_bundles',
  description:
    'List telemetry bundles by date range. Returns available bundles for a serial number, optionally filtered by file type. Essential for locating config snapshots, logs, and diagnostic data.',
  inputSchema: listBundlesSchema,
  handler: listBundles,
}
