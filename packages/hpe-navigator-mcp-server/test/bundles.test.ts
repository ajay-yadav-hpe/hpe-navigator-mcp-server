import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listBundles, listFiletypes } from '../src/tools/bundles.js'
import { bundlesResponse, filetypesResponse } from './fixtures/index.js'

describe('navigator_list_filetypes', () => {
  const mockClient = { listFiletypes: vi.fn() }

  beforeEach(() => vi.clearAllMocks())

  it('should return available filetypes', async () => {
    mockClient.listFiletypes.mockResolvedValue(filetypesResponse)
    const result = await listFiletypes(mockClient as any, { product: 'arcus' })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data).toHaveLength(4)
    expect(parsed.data[0].filetype).toBe('config')
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.listFiletypes.mockRejectedValue('timeout')
    const result = await listFiletypes(mockClient as any, { product: 'arcus' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to list filetypes')
  })
})

describe('navigator_list_bundles', () => {
  const mockClient = { listBundles: vi.fn() }

  beforeEach(() => vi.clearAllMocks())

  it('should return bundles for date range', async () => {
    mockClient.listBundles.mockResolvedValue(bundlesResponse)
    const result = await listBundles(mockClient as any, {
      product: 'arcus',
      serial: 'CZ2D3J050T',
      fromTs: '2026-05-08T00:00:00.000Z',
      toTs: '2026-05-13T23:59:59.000Z',
      type: 'config',
      latest: false,
    })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data[0].type).toBe('config')
    expect(parsed.data[0].bucket).toBe('stats-2026-05')
  })

  it('should handle API errors', async () => {
    mockClient.listBundles.mockRejectedValue(new Error('timeout'))
    const result = await listBundles(mockClient as any, {
      product: 'arcus',
      serial: 'CZ2D3J050T',
      fromTs: '2026-05-08T00:00:00.000Z',
      toTs: '2026-05-13T23:59:59.000Z',
      latest: false,
    })
    expect(result.isError).toBe(true)
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.listBundles.mockRejectedValue('quota exceeded')
    const result = await listBundles(mockClient as any, {
      product: 'arcus',
      serial: 'CZ2D3J050T',
      fromTs: '2026-05-08T00:00:00.000Z',
      toTs: '2026-05-13T23:59:59.000Z',
      latest: false,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to list bundles')
  })
})
