import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import type { NavigatorConfig } from '../config.js'
import { TokenCache } from '../utils/token-cache.js'

type CallbackResult = { type: 'token'; token: string } | { type: 'code'; code: string }

export class AuthManager {
  private tokenCache: TokenCache
  private config: NavigatorConfig

  constructor(config: NavigatorConfig) {
    this.config = config
    this.tokenCache = new TokenCache(config.tokenRefreshBufferMs)
    if (config.serviceToken) {
      this.tokenCache.set(config.serviceToken)
    }
  }

  async getToken(): Promise<string> {
    const cached = this.tokenCache.get()
    if (cached) return cached

    const token = await this.authenticate()
    this.tokenCache.set(token)
    return token
  }

  private async authenticate(): Promise<string> {
    if (this.config.username && this.config.password) {
      return this.loginWithPassword()
    }
    return this.loginWithOkta()
  }

  async loginWithPassword(): Promise<string> {
    const url = `${this.config.cxoBaseUrl}/auth/v1/login`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as { token: string }
    return data.token
  }

  /* v8 ignore start */
  private async loginWithOkta(): Promise<string> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const { port, resultPromise, server } = await startCallbackServer()
    const localCallbackUri = `http://localhost:${port}/callback`

    // The registered Okta redirect URI (navigator service OIDC callback).
    // Navigator's /oidc/callback processes the code, obtains the CXO token,
    // then relays back to our local server using the state as the return URL.
    const redirectUri = this.config.oktaRedirectUri

    // Encode local callback URL in state so Navigator OIDC callback can relay back
    const state = localCallbackUri

    const authorizeUrl = new URL(this.config.oktaAuthorizeUrl)
    authorizeUrl.searchParams.set('client_id', this.config.oktaClientId)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', 'openid profile email')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('prompt', 'login')

    console.error(`\nOpening browser for HPE Okta authentication...`)
    console.error(`If browser does not open, visit:\n${authorizeUrl.toString()}\n`)
    const open = getOpenCommand()
    const { exec } = await import('node:child_process')
    exec(`${open} "${authorizeUrl.toString()}"`)

    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Okta login timed out after 2 minutes')), 120_000),
      ),
    ]).finally(() => server.close())

    if (result.type === 'token') {
      // Navigator OIDC callback relayed the CXO token directly
      return result.token
    }

    // Fallback: direct code received (e.g., localhost redirect URI in dev)
    return this.exchangeCodeForCxoToken(result.code, codeVerifier, redirectUri)
  }
  /* v8 ignore end */

  async exchangeCodeForCxoToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<string> {
    const tokenRes = await fetch(this.config.oktaTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id: this.config.oktaClientId,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })

    if (!tokenRes.ok) {
      throw new Error(`Okta token exchange failed: ${tokenRes.status}`)
    }

    const tokenData = (await tokenRes.json()) as { access_token: string }

    const cxoRes = await fetch(`${this.config.cxoBaseUrl}/auth/v1/okta/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenData.access_token,
        username: this.config.username,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })

    if (!cxoRes.ok) {
      throw new Error(`CXO token exchange failed: ${cxoRes.status}`)
    }

    const cxoData = (await cxoRes.json()) as { token: string }
    return cxoData.token
  }

  clearToken(): void {
    this.tokenCache.clear()
  }
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

function getOpenCommand(): string {
  switch (process.platform) {
    case 'darwin':
      return 'open'
    case 'win32':
      return 'start'
    default:
      return 'xdg-open'
  }
}

function startCallbackServer(): Promise<{
  port: number
  resultPromise: Promise<CallbackResult>
  server: ReturnType<typeof createServer>
}> {
  return new Promise((resolve) => {
    let resolveResult: (r: CallbackResult) => void
    let rejectResult: (err: Error) => void
    const resultPromise = new Promise<CallbackResult>((res, rej) => {
      resolveResult = res
      rejectResult = rej
    })

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost`)
      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const error = url.searchParams.get('error')
      if (error) {
        res.writeHead(400)
        res.end(
          `<html><body><h2>Authentication failed</h2><p>${error}</p></body></html>`,
        )
        rejectResult(new Error(`Authentication error: ${error}`))
        return
      }

      // Case 1: Navigator OIDC callback relayed CXO token via state redirect
      const token = url.searchParams.get('token')
      if (token) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h2>Authentication successful!</h2><p>You can close this window.</p></body></html>',
        )
        resolveResult({ type: 'token', token })
        return
      }

      // Case 2: Direct code (when using localhost redirect URI in dev/testing)
      const code = url.searchParams.get('code')
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h2>Authentication successful!</h2><p>You can close this window.</p></body></html>',
        )
        resolveResult({ type: 'code', code })
        return
      }

      res.writeHead(400)
      res.end(
        '<html><body><h2>Authentication failed</h2><p>Missing token or code parameter.</p></body></html>',
      )
      rejectResult(new Error('Missing token or code in callback'))
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, resultPromise, server })
    })
  })
}
