import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NavigatorClient } from '../src/client/navigator-client.js'
import {
  MOCK_SERIAL,
  findResponse,
  relatedResponse,
  sfdcAssetResponse,
  feedResponse,
  overviewResponse,
  heartbeatResponse,
  filetypesResponse,
  bundlesResponse,
  dashboardsResponse,
  createMockJwt,
} from './fixtures/index.js'

// Mock AuthManager so no real HTTP calls for tokens
vi.mock('../src/client/auth.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    getToken: vi.fn().mockResolvedValue(createMockJwt(3600)),
    clearToken: vi.fn(),
  })),
}))

function mockRes(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as Response
}

describe('NavigatorClient', () => {
  let client: NavigatorClient
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    client = new NavigatorClient({
      username: 'test@hpe.com',
      password: 'pass',
      serviceToken: undefined,
      cxoBaseUrl: 'https://cxo.example.com',
      extractionBaseUrl: 'https://ext.example.com',
      oktaClientId: 'clientId',
      oktaAuthorizeUrl: 'https://okta.example.com/authorize',
      oktaTokenUrl: 'https://okta.example.com/token',
      oktaRedirectUri: 'https://nav.example.com/oidc/callback',
      callbackPort: 0,
      tokenRefreshBufferMs: 300_000,
      timeoutMs: 30_000,
      downloadTimeoutMs: 600_000,
      downloadDir: './downloads',
      maxDownloadSizeMb: 500,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('findSerial returns product data', async () => {
    fetchMock.mockResolvedValue(mockRes(findResponse))
    const result = await client.findSerial(MOCK_SERIAL)
    expect(result.data[0].product).toBe('arcus')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/nav/v1/find/${MOCK_SERIAL}`),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }) }),
    )
  })

  it('getRelated returns solution data', async () => {
    fetchMock.mockResolvedValue(mockRes(relatedResponse))
    const result = await client.getRelated('arcus', MOCK_SERIAL)
    expect(result.data.solution).toBe('PCBE')
  })

  it('getSfdcAsset returns asset details', async () => {
    fetchMock.mockResolvedValue(mockRes(sfdcAssetResponse))
    const result = await client.getSfdcAsset(MOCK_SERIAL)
    expect(result.data.sla).toBe('Premium 4 Hour Onsite')
  })

  it('getFeed returns alert data', async () => {
    fetchMock.mockResolvedValue(mockRes(feedResponse))
    const result = await client.getFeed('arcus', MOCK_SERIAL)
    expect(result.data).toHaveLength(2)
  })

  it('getOverview returns system overview', async () => {
    fetchMock.mockResolvedValue(mockRes(overviewResponse))
    const result = await client.getOverview('arcus', MOCK_SERIAL)
    expect(result.data.display_name).toBe('System gar-storage-alletra')
  })

  it('getHeartbeat returns heartbeat data', async () => {
    fetchMock.mockResolvedValue(mockRes(heartbeatResponse))
    const result = await client.getHeartbeat('arcus', MOCK_SERIAL, 42567)
    expect((result.data as any).id).toBe(42567)
  })

  it('listFiletypes returns available types', async () => {
    fetchMock.mockResolvedValue(mockRes(filetypesResponse))
    const result = await client.listFiletypes('arcus')
    expect(result.data).toHaveLength(4)
  })

  it('listBundles returns bundles for date range', async () => {
    fetchMock.mockResolvedValue(mockRes(bundlesResponse))
    const result = await client.listBundles(
      'arcus',
      MOCK_SERIAL,
      '2026-05-08T00:00:00Z',
      '2026-05-13T23:59:59Z',
      'config',
      false,
    )
    expect(result.data[0].type).toBe('config')
  })

  it('listBundles passes latest param', async () => {
    fetchMock.mockResolvedValue(mockRes(bundlesResponse))
    await client.listBundles('arcus', MOCK_SERIAL, '2026-05-08T00:00:00Z', '2026-05-13T23:59:59Z', undefined, true)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('latest=true'), expect.any(Object))
  })

  it('searchDashboards returns dashboards', async () => {
    fetchMock.mockResolvedValue(mockRes(dashboardsResponse))
    const result = await client.searchDashboards('arcus')
    expect(result).toHaveLength(2)
  })

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue(mockRes({}, 500))
    await expect(client.findSerial(MOCK_SERIAL)).rejects.toThrow('API error: 500')
  })

  it('retries on 429 rate limit', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests', headers: { get: () => '0' } } as unknown as Response)
      .mockResolvedValueOnce(mockRes(findResponse))
    const result = await client.findSerial(MOCK_SERIAL)
    expect(result.data[0].product).toBe('arcus')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('re-authenticates on 401 and retries', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}), headers: { get: () => null } } as unknown as Response)
      .mockResolvedValueOnce(mockRes(findResponse))
    const result = await client.findSerial(MOCK_SERIAL)
    expect(result.data[0].product).toBe('arcus')
  })
})
