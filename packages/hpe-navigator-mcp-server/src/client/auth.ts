import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import type { NavigatorConfig } from '../config.js'
import { TokenCache } from '../utils/token-cache.js'

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

  private async loginWithPassword(): Promise<string> {
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

  private async loginWithOkta(): Promise<string> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const state = randomBytes(16).toString('hex')
    const { port, codePromise, server } = await startCallbackServer(state)

    const redirectUri = `http://localhost:${port}/callback`
    const authorizeUrl = new URL(this.config.oktaAuthorizeUrl)
    authorizeUrl.searchParams.set('client_id', this.config.oktaClientId)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', 'openid profile email')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('prompt', 'login')

    // Open user's browser
    const open = await getOpenCommand()
    const { exec } = await import('node:child_process')
    exec(`${open} "${authorizeUrl.toString()}"`)

    // Wait for callback (2 minute timeout)
    const timeoutMs = 120_000
    const code = await Promise.race([
      codePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Okta login timed out after 2 minutes')), timeoutMs),
      ),
    ]).finally(() => server.close())

    // Exchange code for Okta token
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

    // Exchange Okta token for CXO service token
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

async function getOpenCommand(): Promise<string> {
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
  codePromise: Promise<string>
  server: ReturnType<typeof createServer>
}> {
  return new Promise((resolve) => {
    let resolveCode: (code: string) => void
    let rejectCode: (err: Error) => void
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost`)
      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400)
        res.end('Authentication failed')
        rejectCode(new Error(`Okta error: ${error}`))
        return
      }

      if (state !== expectedState) {
        res.writeHead(400)
        res.end('Invalid state')
        rejectCode(new Error('State mismatch in OAuth callback'))
        return
      }

      if (!code) {
        res.writeHead(400)
        res.end('Missing code')
        rejectCode(new Error('Missing authorization code'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<html><body><h2>Authentication successful!</h2><p>You can close this window.</p></body></html>',
      )
      resolveCode(code)
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, codePromise, server })
    })
  })
}
