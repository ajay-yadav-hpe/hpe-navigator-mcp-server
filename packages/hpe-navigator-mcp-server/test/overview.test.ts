import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOverview } from '../src/tools/overview.js'
import { MOCK_SERIAL, overviewResponse } from './fixtures/index.js'

describe('navigator_get_overview', () => {
  const mockClient = {
    getOverview: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return system overview', async () => {
    mockClient.getOverview.mockResolvedValue(overviewResponse)
    const result = await getOverview(mockClient as any, {
      product: 'arcus',
      serial: MOCK_SERIAL,
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data.display_name).toBe('System gar-storage-alletra')
    expect(parsed.data.node_count).toBe(2)
    expect(parsed.data.space.free).toBe(13579457.0)
  })

  it('should return error for unknown serial', async () => {
    mockClient.getOverview.mockRejectedValue(new Error('API error: 404 Not Found'))
    const result = await getOverview(mockClient as any, {
      product: 'arcus',
      serial: 'INVALID',
    })
    expect(result.isError).toBe(true)
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.getOverview.mockRejectedValue(42)
    const result = await getOverview(mockClient as any, { product: 'arcus', serial: 'X' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to get overview')
  })
})
