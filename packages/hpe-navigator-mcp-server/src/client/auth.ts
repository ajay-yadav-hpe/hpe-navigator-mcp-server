import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import type { NavigatorConfig } from '../config.js'
import { TokenCache } from '../utils/token-cache.js'

type CallbackResult = { code: string }

export class AuthManager {
  private tokenCache: TokenCache
  private config: NavigatorConfig

  constructor(config: NavigatorConfig) {
    this.config = config
    this.tokenCache = new TokenCache(config.tokenRefreshBufferMs)
    if (config.serviceToken) {
      // Strip "Bearer " prefix — users often copy it verbatim from browser DevTools
      const rawToken = config.serviceToken.replace(/^Bearer\s+/i, '')
      this.tokenCache.set(rawToken)
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
    // v8 ignore next — Okta browser flow, covered by /* v8 ignore start/end */ below
    return this.loginWithOkta()
  }

  async loginWithPassword(): Promise<string> {
    const url = `${this.config.cxoBaseUrl}/auth/v1/login`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      throw wrapFetchError(err, url)
    }

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as { token: string }
    return data.token
  }

  /* v8 ignore start */
  private async loginWithOkta(): Promise<string> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const state = randomBytes(16).toString('hex')
    const { port, resultPromise, server } = await startCallbackServer(state)
    const localCallbackUri = `http://localhost:${port}/callback`

    // Use localhost directly as the OIDC redirect URI.
    // This is the standard pattern for native/CLI OIDC clients using PKCE.
    // Okta redirects the browser straight to our local server with the auth code.
    const redirectUri = localCallbackUri

    const authorizeUrl = new URL(this.config.oktaAuthorizeUrl)
    authorizeUrl.searchParams.set('client_id', this.config.oktaClientId)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', 'openid profile email')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')

    console.error(`\n═══════════════════════════════════════════════════════════`)
    console.error(`  HPE Navigator — Okta Authentication Required`)
    console.error(`═══════════════════════════════════════════════════════════`)
    console.error(`  Waiting for Okta login (port ${port})...`)
    console.error(`  Opening browser...`)
    console.error(`  If browser does not open, visit:`)
    console.error(`  ${authorizeUrl.toString()}`)
    console.error(`═══════════════════════════════════════════════════════════\n`)
    const open = getOpenCommand()
    const { exec } = await import('node:child_process')
    exec(`${open} "${authorizeUrl.toString()}"`, (execErr) => {
      if (execErr) console.error(`  Warning: failed to open browser: ${execErr.message}`)
    })

    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Okta login timed out after 3 minutes.\n' +
                  'Possible causes:\n' +
                  '  1. The Okta app does not allow http://localhost redirect URIs\n' +
                  '  2. The browser failed to open or MFA was not completed in time\n' +
                  'Workaround: Copy the token from Navigator browser DevTools:\n' +
                  '  Network tab → any /query/ request → Authorization header value\n' +
                  '  Set it as HPE_NAV_SERVICE_TOKEN in VS Code settings.',
              ),
            ),
          180_000,
        ),
      ),
    ]).finally(() => server.close())

    // Exchange the authorization code for an Okta access token (PKCE),
    // then exchange the Okta token for a CXO token.
    return this.exchangeCodeForCxoToken(result.code, codeVerifier, redirectUri)
  }
  /* v8 ignore end */

  async exchangeCodeForCxoToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<string> {
    // Step 1: Exchange auth code for Okta access token (PKCE, no client_secret)
    console.error('  Exchanging auth code for Okta token...')
    let tokenRes: Response
    try {
      tokenRes = await fetch(this.config.oktaTokenUrl, {
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
    } catch (err) {
      throw wrapFetchError(err, this.config.oktaTokenUrl)
    }

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '')
      throw new Error(
        `Okta token exchange failed: ${tokenRes.status} ${tokenRes.statusText}` +
          (body ? `\n${body}` : ''),
      )
    }

    const tokenData = (await tokenRes.json()) as { access_token: string }
    console.error('  Okta token obtained, exchanging for CXO token...')

    // Step 2: Exchange Okta access token for CXO token
    const cxoUrl = `${this.config.cxoBaseUrl}/auth/v1/okta/token`
    const cxoBody: Record<string, string> = { token: tokenData.access_token }
    if (this.config.username) {
      cxoBody.username = this.config.username
    }

    let cxoRes: Response
    try {
      cxoRes = await fetch(cxoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cxoBody),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      throw wrapFetchError(err, cxoUrl)
    }

    if (!cxoRes.ok) {
      const body = await cxoRes.text().catch(() => '')
      throw new Error(
        `CXO token exchange failed: ${cxoRes.status} ${cxoRes.statusText}` +
          (body ? `\n${body}` : ''),
      )
    }

    const cxoData = (await cxoRes.json()) as { token: string }
    console.error('  ✓ CXO token obtained successfully')
    return cxoData.token
  }

  clearToken(): void {
    this.tokenCache.clear()
  }
}

function wrapFetchError(err: unknown, url: string): Error {
  const hostname = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined
  const detail = cause instanceof Error ? `: ${cause.message}` : ''
  return new Error(
    `Network error reaching ${hostname}${detail}. ` +
      `Ensure HPE VPN is active. ` +
      `If certificate errors occur, set HPE_NAV_TLS_REJECT_UNAUTHORIZED=false in extension settings.`,
  )
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

function startCallbackServer(expectedState: string): Promise<{
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
      console.error(`  [callback] ${req.method} ${url.pathname}${url.search}`)

      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      // Check for Okta error responses (e.g., redirect_uri mismatch)
      const error = url.searchParams.get('error')
      if (error) {
        const desc = url.searchParams.get('error_description') ?? error
        console.error(`  [callback] Okta error: ${desc}`)
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`<html><body><h2>Authentication failed</h2><p>${desc}</p></body></html>`)
        rejectResult(new Error(`Okta authentication error: ${desc}`))
        return
      }

      // Validate state parameter (CSRF protection)
      const state = url.searchParams.get('state')
      if (state !== expectedState) {
        console.error(`  [callback] State mismatch: expected ${expectedState}, got ${state}`)
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h2>Authentication failed</h2><p>Invalid state parameter.</p></body></html>',
        )
        rejectResult(new Error('OIDC state mismatch — possible CSRF'))
        return
      }

      // Extract the authorization code
      const code = url.searchParams.get('code')
      if (code) {
        console.error('  [callback] Authorization code received')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h2>Authentication successful!</h2><p>You can close this window.</p></body></html>',
        )
        resolveResult({ code })
        return
      }

      console.error('  [callback] Missing code parameter')
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end(
        '<html><body><h2>Authentication failed</h2><p>Missing authorization code.</p></body></html>',
      )
      rejectResult(new Error('Missing authorization code in callback'))
    })

    // Listen on all interfaces so both 127.0.0.1 (IPv4) and ::1 (IPv6) work
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, resultPromise, server })
    })
  })
}
