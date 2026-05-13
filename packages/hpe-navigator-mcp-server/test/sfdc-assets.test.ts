import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSfdcAsset } from '../src/tools/sfdc-assets.js'
import { MOCK_SERIAL, sfdcAssetResponse } from './fixtures/index.js'

describe('navigator_get_sfdc_asset', () => {
  const mockClient = {
    getSfdcAsset: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return full SFDC asset details', async () => {
    mockClient.getSfdcAsset.mockResolvedValue(sfdcAssetResponse)
    const result = await getSfdcAsset(mockClient as any, { serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data.serial).toBe(MOCK_SERIAL)
    expect(parsed.data.sla).toBe('Premium 4 Hour Onsite')
    expect(parsed.data.open_cases).toHaveLength(1)
    expect(parsed.data.escalations).toHaveLength(1)
  })

  it('should handle API errors gracefully', async () => {
    mockClient.getSfdcAsset.mockRejectedValue(new Error('API error: 404 Not Found'))
    const result = await getSfdcAsset(mockClient as any, { serial: 'UNKNOWN' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('404')
  })
})
