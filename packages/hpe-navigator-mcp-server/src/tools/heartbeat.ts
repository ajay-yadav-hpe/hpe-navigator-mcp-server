import { z } from 'zod'
import type { NavigatorClient } from '../client/navigator-client.js'
import { formatSuccess, formatError } from '../utils/formatter.js'

export const getHeartbeatSchema = z.object({
  product: z.string().describe("Product type (e.g., 'arcus')"),
  serial: z.string().describe('Hardware serial number'),
  heartbeatId: z.number().describe("Heartbeat record ID (from overview's latest_heartbeat_id)"),
})

export async function getHeartbeat(
  client: NavigatorClient,
  params: z.infer<typeof getHeartbeatSchema>,
) {
  try {
    const result = await client.getHeartbeat(params.product, params.serial, params.heartbeatId)
    return formatSuccess(result)
  } catch (err) {
    return formatError(err instanceof Error ? err.message : 'Failed to get heartbeat')
  }
}

export const getHeartbeatTool = {
  name: 'navigator_get_heartbeat',
  description:
    'Get detailed heartbeat telemetry for a specific heartbeat ID. Includes network config, capacity, RDA health, alerts, data-on-demand status.',
  inputSchema: getHeartbeatSchema,
  handler: getHeartbeat,
}
