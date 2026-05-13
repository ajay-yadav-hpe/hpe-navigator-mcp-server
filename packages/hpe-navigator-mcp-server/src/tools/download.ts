import { z } from 'zod'
import type { ExtractionClient } from '../client/extraction-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const downloadBundleSchema = z.object({
  bucket: z.string().describe("Storage bucket (e.g., 'stats-2026-05')"),
  path: z
    .string()
    .describe(
      "Full file path from bundle listing (e.g., 'HPE.ARCUS/CZ2D3J050T/config/config.260509.083010.7790')",
    ),
  outputFilename: z
    .string()
    .optional()
    .describe('Custom output filename (defaults to last path segment)'),
})

export async function downloadBundle(
  client: ExtractionClient,
  params: z.infer<typeof downloadBundleSchema>,
) {
  try {
    const result = await client.downloadBundle(params.bucket, params.path, params.outputFilename)
    return formatSuccess({
      success: true,
      localPath: result.localPath,
      size: result.size,
      type: params.path.split('/').slice(-2, -1)[0] ?? 'unknown',
    })
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to download bundle')
  }
}

export const downloadBundleTool = {
  name: 'navigator_download_bundle',
  description:
    'Download a specific telemetry bundle file to a local directory. Supports large files with streaming. Returns the local file path on success.',
  inputSchema: downloadBundleSchema,
  handler: downloadBundle,
}
