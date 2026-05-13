import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRelated } from '../src/tools/related.js'
import { getFeed } from '../src/tools/feed.js'
import { getHeartbeat } from '../src/tools/heartbeat.js'
import { searchDashboards } from '../src/tools/analytics.js'
import { downloadBundle } from '../src/tools/download.js'
import {
  MOCK_SERIAL,
  relatedResponse,
  feedResponse,
  heartbeatResponse,
  dashboardsResponse,
} from './fixtures/index.js'

// ── navigator_get_related ─────────────────────────────────────────────────────
describe('navigator_get_related', () => {
  const mockClient = { getRelated: vi.fn() }
  beforeEach(() => vi.clearAllMocks())

  it('should return related products', async () => {
    mockClient.getRelated.mockResolvedValue(relatedResponse)
    const result = await getRelated(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data.solution).toBe('PCBE')
    expect(parsed.data.related_products).toHaveLength(2)
  })

  it('should return error on failure', async () => {
    mockClient.getRelated.mockRejectedValue(new Error('service unavailable'))
    const result = await getRelated(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('service unavailable')
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.getRelated.mockRejectedValue('raw error')
    const result = await getRelated(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to get related products')
  })
})

// ── navigator_get_feed ────────────────────────────────────────────────────────
describe('navigator_get_feed', () => {
  const mockClient = { getFeed: vi.fn() }
  beforeEach(() => vi.clearAllMocks())

  it('should return feed alerts', async () => {
    mockClient.getFeed.mockResolvedValue(feedResponse)
    const result = await getFeed(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data).toHaveLength(2)
    expect(parsed.data[0].severity).toBe('critical')
  })

  it('should return error on failure', async () => {
    mockClient.getFeed.mockRejectedValue(new Error('feed error'))
    const result = await getFeed(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBe(true)
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.getFeed.mockRejectedValue(null)
    const result = await getFeed(mockClient as any, { product: 'arcus', serial: MOCK_SERIAL })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to get feed')
  })
})

// ── navigator_get_heartbeat ───────────────────────────────────────────────────
describe('navigator_get_heartbeat', () => {
  const mockClient = { getHeartbeat: vi.fn() }
  beforeEach(() => vi.clearAllMocks())

  it('should return heartbeat data', async () => {
    mockClient.getHeartbeat.mockResolvedValue(heartbeatResponse)
    const result = await getHeartbeat(mockClient as any, {
      product: 'arcus',
      serial: MOCK_SERIAL,
      heartbeatId: 42567,
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data.id).toBe(42567)
  })

  it('should return error on failure', async () => {
    mockClient.getHeartbeat.mockRejectedValue(new Error('not found'))
    const result = await getHeartbeat(mockClient as any, {
      product: 'arcus',
      serial: MOCK_SERIAL,
      heartbeatId: 0,
    })
    expect(result.isError).toBe(true)
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.getHeartbeat.mockRejectedValue(undefined)
    const result = await getHeartbeat(mockClient as any, {
      product: 'arcus',
      serial: MOCK_SERIAL,
      heartbeatId: 0,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to get heartbeat')
  })
})

// ── navigator_search_dashboards ───────────────────────────────────────────────
describe('navigator_search_dashboards', () => {
  const mockClient = { searchDashboards: vi.fn() }
  beforeEach(() => vi.clearAllMocks())

  it('should return dashboards for a tag', async () => {
    mockClient.searchDashboards.mockResolvedValue(dashboardsResponse)
    const result = await searchDashboards(mockClient as any, { tag: 'arcus' })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].title).toBe('Heartbeat Activity')
  })

  it('should return error on failure', async () => {
    mockClient.searchDashboards.mockRejectedValue(new Error('analytics down'))
    const result = await searchDashboards(mockClient as any, { tag: 'arcus' })
    expect(result.isError).toBe(true)
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.searchDashboards.mockRejectedValue('503')
    const result = await searchDashboards(mockClient as any, { tag: 'arcus' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to search dashboards')
  })
})

// ── navigator_download_bundle ─────────────────────────────────────────────────
describe('navigator_download_bundle', () => {
  const mockClient = { downloadBundle: vi.fn() }
  beforeEach(() => vi.clearAllMocks())

  it('should return download success info', async () => {
    mockClient.downloadBundle.mockResolvedValue({
      localPath: './downloads/config.260509.083010.7790',
      size: 1310414,
    })
    const result = await downloadBundle(mockClient as any, {
      bucket: 'stats-2026-05',
      path: 'HPE.ARCUS/CZ2D3J050T/config/config.260509.083010.7790',
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.size).toBe(1310414)
  })

  it('should use custom outputFilename when provided', async () => {
    mockClient.downloadBundle.mockResolvedValue({ localPath: './downloads/my.cfg', size: 100 })
    const result = await downloadBundle(mockClient as any, {
      bucket: 'stats-2026-05',
      path: 'HPE.ARCUS/serial/config/file',
      outputFilename: 'my.cfg',
    })
    expect(result.isError).toBeUndefined()
  })

  it('should return error on failure', async () => {
    mockClient.downloadBundle.mockRejectedValue(new Error('file too large'))
    const result = await downloadBundle(mockClient as any, {
      bucket: 'stats-2026-05',
      path: 'HPE.ARCUS/CZ2D3J050T/config/config.260509.083010.7790',
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('file too large')
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.downloadBundle.mockRejectedValue({ code: 'ENOSPACE' })
    const result = await downloadBundle(mockClient as any, {
      bucket: 'stats-2026-05',
      path: 'HPE.ARCUS/CZ2D3J050T/config/config.260509.083010.7790',
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to download bundle')
  })
})
