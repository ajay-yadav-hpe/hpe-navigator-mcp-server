import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const findSerialSchema = z.object({
  serial: z
    .string()
    .min(1)
    .describe(
      "Hardware serial number (e.g., 'CZ2D3J050T' for arcus, '3TKFTAPMJ4XZ23G3' for DSCVM)",
    ),
})

export async function findSerial(
  client: NavigatorClient,
  params: z.infer<typeof findSerialSchema>,
) {
  try {
    const result = await client.findSerial(params.serial)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to find serial')
  }
}

export const findSerialTool = {
  name: 'navigator_find_serial',
  description:
    'Find product by hardware serial number. Returns product identification including type, model, customer, and status.',
  inputSchema: findSerialSchema,
  handler: findSerial,
}
