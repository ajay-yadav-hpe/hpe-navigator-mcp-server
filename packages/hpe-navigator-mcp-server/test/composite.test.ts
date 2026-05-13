import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSystemSummary } from '../src/tools/composite.js'
import {
  MOCK_SERIAL,
  findResponse,
  overviewResponse,
  feedResponse,
  sfdcAssetResponse,
} from './fixtures/index.js'

describe('navigator_get_system_summary', () => {
  const mockClient = {
    findSerial: vi.fn(),
    getOverview: vi.fn(),
    getFeed: vi.fn(),
    getSfdcAsset: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('should return combined summary from multiple APIs', async () => {
    mockClient.findSerial.mockResolvedValue(findResponse)
    mockClient.getOverview.mockResolvedValue(overviewResponse)
    mockClient.getFeed.mockResolvedValue(feedResponse)
    mockClient.getSfdcAsset.mockResolvedValue(sfdcAssetResponse)

    const result = await getSystemSummary(mockClient as any, { serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.product.serial).toBe(MOCK_SERIAL)
    expect(parsed.overview).not.toBeNull()
    expect(parsed.feed).not.toBeNull()
    expect(parsed.sfdc).not.toBeNull()
  })

  it('should return error if serial not found', async () => {
    mockClient.findSerial.mockResolvedValue({ data: [], total: 0 })
    const result = await getSystemSummary(mockClient as any, { serial: 'INVALID' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })

  it('should handle partial failures gracefully', async () => {
    mockClient.findSerial.mockResolvedValue(findResponse)
    mockClient.getOverview.mockResolvedValue(overviewResponse)
    mockClient.getFeed.mockRejectedValue(new Error('feed service down'))
    mockClient.getSfdcAsset.mockResolvedValue(sfdcAssetResponse)

    const result = await getSystemSummary(mockClient as any, { serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.overview).not.toBeNull()
    expect(parsed.feed).toBeNull()
    expect(parsed.errors).toHaveLength(1)
  })
})
