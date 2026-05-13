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

import { getDscvmLogs } from '../src/tools/composite.js'
import { bundlesResponse, MOCK_DSC_SERIAL } from './fixtures/index.js'

describe('navigator_get_dscvm_logs', () => {
  const mockNavClient = { listBundles: vi.fn() }
  const mockExtClient = { downloadBundle: vi.fn() }

  beforeEach(() => vi.clearAllMocks())

  it('lists dailylog and complog bundles by default', async () => {
    mockNavClient.listBundles.mockResolvedValue(bundlesResponse)
    const result = await getDscvmLogs(mockNavClient as any, mockExtClient as any, {
      serial: MOCK_DSC_SERIAL,
      date: '2026-05-13',
      download: false,
      includeComplog: true,
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0].type).toBe('dailylog')
  })

  it('downloads bundles when download=true', async () => {
    mockNavClient.listBundles.mockResolvedValue(bundlesResponse)
    mockExtClient.downloadBundle.mockResolvedValue({ localPath: '/tmp/file.tar.gz', size: 1024 })
    const result = await getDscvmLogs(mockNavClient as any, mockExtClient as any, {
      serial: MOCK_DSC_SERIAL,
      date: '2026-05-13',
      download: true,
      includeComplog: false,
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.results[0].downloaded).toBeDefined()
  })

  it('returns error on failure', async () => {
    mockNavClient.listBundles.mockRejectedValue(new Error('network error'))
    const result = await getDscvmLogs(mockNavClient as any, mockExtClient as any, {
      serial: MOCK_DSC_SERIAL,
      date: '2026-05-13',
      download: false,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('network error')
  })
})
