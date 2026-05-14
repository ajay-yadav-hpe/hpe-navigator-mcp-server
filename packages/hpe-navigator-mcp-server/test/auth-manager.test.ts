import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthManager } from '../src/client/auth.js'
import type { NavigatorConfig } from '../src/config.js'
import { createMockJwt } from './fixtures/index.js'

const baseConfig: NavigatorConfig = {
  username: '',
  password: '',
  serviceToken: undefined,
  cxoBaseUrl: 'https://cxo.example.com',
  extractionBaseUrl: 'https://ext.example.com',
  oktaClientId: 'test-client',
  oktaAuthorizeUrl: 'https://okta.example.com/authorize',
  oktaTokenUrl: 'https://okta.example.com/token',
  oktaRedirectUri: 'https://nav.example.com/oidc/callback',
  callbackPort: 0,
  tokenRefreshBufferMs: 300_000,
  timeoutMs: 30_000,
  downloadTimeoutMs: 600_000,
  downloadDir: './downloads',
  maxDownloadSizeMb: 500,
}

function mockFetchRes(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response
}

describe('AuthManager', () => {
  const fetchMock = vi.fn()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('with serviceToken', () => {
    it('returns cached service token without HTTP calls', async () => {
      const token = createMockJwt(3600)
      const auth = new AuthManager({ ...baseConfig, serviceToken: token })
      const result = await auth.getToken()
      expect(result).toBe(token)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('re-authenticates when service token expires', async () => {
      const expiredToken = createMockJwt(-100)
      const freshToken = createMockJwt(3600)
      fetchMock.mockResolvedValue(mockFetchRes({ token: freshToken }))
      const auth = new AuthManager({
        ...baseConfig,
        serviceToken: expiredToken,
        username: 'u@hpe.com',
        password: 'pass',
      })
      const result = await auth.getToken()
      expect(result).toBe(freshToken)
    })
  })

  describe('loginWithPassword', () => {
    it('returns JWT on success', async () => {
      const token = createMockJwt(3600)
      fetchMock.mockResolvedValue(mockFetchRes({ token }))
      const auth = new AuthManager({ ...baseConfig, username: 'u@hpe.com', password: 'pass' })
      const result = await auth.loginWithPassword()
      expect(result).toBe(token)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/login'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws when HTTP error', async () => {
      fetchMock.mockResolvedValue(mockFetchRes({}, false, 401))
      const auth = new AuthManager({ ...baseConfig, username: 'u@hpe.com', password: 'wrong' })
      await expect(auth.loginWithPassword()).rejects.toThrow('Login failed: 401')
    })

    it('throws with network context when fetch itself throws', async () => {
      const cause = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
      fetchMock.mockRejectedValue(Object.assign(new Error('fetch failed'), { cause }))
      const auth = new AuthManager({ ...baseConfig, username: 'u@hpe.com', password: 'pass' })
      await expect(auth.loginWithPassword()).rejects.toThrow('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
    })

    it('caches token and reuses it', async () => {
      const token = createMockJwt(3600)
      fetchMock.mockResolvedValue(mockFetchRes({ token }))
      const auth = new AuthManager({ ...baseConfig, username: 'u@hpe.com', password: 'pass' })
      const first = await auth.getToken()
      const second = await auth.getToken()
      expect(first).toBe(second)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('re-authenticates after clearToken', async () => {
      const token = createMockJwt(3600)
      fetchMock.mockResolvedValue(mockFetchRes({ token }))
      const auth = new AuthManager({ ...baseConfig, username: 'u@hpe.com', password: 'pass' })
      await auth.getToken()
      auth.clearToken()
      await auth.getToken()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('exchangeCodeForCxoToken', () => {
    it('exchanges code for CXO token', async () => {
      const cxoToken = createMockJwt(3600)
      fetchMock
        .mockResolvedValueOnce(mockFetchRes({ access_token: 'okta-access-token' }))
        .mockResolvedValueOnce(mockFetchRes({ token: cxoToken }))
      const auth = new AuthManager(baseConfig)
      const result = await auth.exchangeCodeForCxoToken(
        'auth-code',
        'code-verifier',
        'https://nav.example.com/oidc/callback',
      )
      expect(result).toBe(cxoToken)
    })

    it('throws when Okta token exchange fails', async () => {
      fetchMock.mockResolvedValue(mockFetchRes({}, false, 400))
      const auth = new AuthManager(baseConfig)
      await expect(
        auth.exchangeCodeForCxoToken('bad-code', 'verifier', 'https://redirect.example.com'),
      ).rejects.toThrow('Okta token exchange failed: 400')
    })

    it('throws when CXO token exchange fails', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchRes({ access_token: 'okta-token' }))
        .mockResolvedValueOnce(mockFetchRes({}, false, 403))
      const auth = new AuthManager(baseConfig)
      await expect(
        auth.exchangeCodeForCxoToken('code', 'verifier', 'https://redirect.example.com'),
      ).rejects.toThrow('CXO token exchange failed: 403')
    })
  })
})
