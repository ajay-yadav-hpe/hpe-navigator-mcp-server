import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExtractionClient } from '../src/client/extraction-client.js'
import type { NavigatorConfig } from '../src/config.js'
import { createMockJwt } from './fixtures/index.js'

// Mock AuthManager
vi.mock('../src/client/auth.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    getToken: vi.fn().mockResolvedValue(createMockJwt(3600)),
  })),
}))

// Mock node:fs
vi.mock('node:fs', () => ({
  createWriteStream: vi.fn().mockReturnValue({ on: vi.fn(), write: vi.fn(), end: vi.fn() }),
  mkdirSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 1310414 }),
}))

// Mock node:stream/promises
vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}))

const baseConfig: NavigatorConfig = {
  username: 'u@hpe.com',
  password: 'pass',
  serviceToken: undefined,
  cxoBaseUrl: 'https://cxo.example.com',
  extractionBaseUrl: 'https://ext.example.com',
  oktaClientId: 'client',
  oktaAuthorizeUrl: 'https://okta.example.com/authorize',
  oktaTokenUrl: 'https://okta.example.com/token',
  oktaRedirectUri: 'https://nav.example.com/oidc/callback',
  callbackPort: 0,
  tokenRefreshBufferMs: 300_000,
  timeoutMs: 30_000,
  downloadTimeoutMs: 600_000,
  downloadDir: '/tmp/test-downloads',
  maxDownloadSizeMb: 500,
}

function createMockStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

describe('ExtractionClient', () => {
  const fetchMock = vi.fn()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('downloads a bundle successfully', async () => {
    const mockBody = createMockStream()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (k: string) => (k === 'content-length' ? '1310414' : null) },
      body: mockBody,
    })

    const client = new ExtractionClient(baseConfig)
    const result = await client.downloadBundle(
      'stats-2026-05',
      'HPE.ARCUS/CZ2D3J050T/config/file.cfg',
    )
    expect(result.size).toBe(1310414)
    expect(result.localPath).toContain('file.cfg')
  })

  it('uses custom outputFilename', async () => {
    const mockBody = createMockStream()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => '100' },
      body: mockBody,
    })
    const client = new ExtractionClient(baseConfig)
    const result = await client.downloadBundle('bucket', 'path/to/file.cfg', 'custom.cfg')
    expect(result.localPath).toContain('custom.cfg')
  })

  it('throws when download fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
    })
    const client = new ExtractionClient(baseConfig)
    await expect(client.downloadBundle('bucket', 'path/to/file.cfg')).rejects.toThrow(
      'Download failed: 404',
    )
  })

  it('throws when file exceeds size limit', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (k: string) => (k === 'content-length' ? String(600 * 1024 * 1024) : null) },
      body: createMockStream(),
    })
    const client = new ExtractionClient(baseConfig)
    await expect(client.downloadBundle('bucket', 'huge-file')).rejects.toThrow('File too large')
  })

  it('throws when response body is null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => '100' },
      body: null,
    })
    const client = new ExtractionClient(baseConfig)
    await expect(client.downloadBundle('bucket', 'path/file.cfg')).rejects.toThrow(
      'Response body is empty',
    )
  })

  it('rejects path traversal attempts', async () => {
    const mockBody = createMockStream()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => '100' },
      body: mockBody,
    })
    // basename() strips ../ so the path traversal is neutralized — expect success, not throw
    const client = new ExtractionClient(baseConfig)
    const result = await client.downloadBundle('bucket', 'path/file.cfg', '../../../etc/passwd')
    // basename removes traversal, file ends up as 'passwd' inside downloadDir
    expect(result.localPath).toContain('passwd')
    expect(result.localPath).toContain('/tmp/test-downloads')
  })
})
