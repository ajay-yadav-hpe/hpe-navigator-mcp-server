import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { NavigatorConfig } from '../config.js'
import { TokenCache } from '../utils/token-cache.js'

type TokenRelayResult = { token: string }

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
    const { port, resultPromise, server } = await startTokenRelayServer()
    const navigatorUrl = 'https://navigator.service.suptools.hpecorp.net'

    console.error(`\n═══════════════════════════════════════════════════════════`)
    console.error(`  HPE Navigator — Okta Authentication`)
    console.error(`═══════════════════════════════════════════════════════════`)
    console.error(`  1. Browser will open Navigator (Okta login required)`)
    console.error(`  2. Complete Okta authentication in the browser`)
    console.error(`  3. A helper page will open to relay the token`)
    console.error(`═══════════════════════════════════════════════════════════\n`)

    const open = getOpenCommand()
    const { exec } = await import('node:child_process')
    exec(`${open} "${navigatorUrl}"`, (execErr) => {
      if (execErr) console.error(`  Warning: failed to open browser: ${execErr.message}`)
    })

    // Open the token relay helper page after a brief delay
    setTimeout(() => {
      exec(`${open} "http://localhost:${port}"`, (execErr) => {
        if (execErr) console.error(`  Warning: failed to open relay page: ${execErr.message}`)
      })
    }, 3000)

    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Okta login timed out after 5 minutes.\n' +
                  'Workaround: Set HPE_NAV_SERVICE_TOKEN in extension settings.\n' +
                  '  In Navigator, open DevTools → Application → Local Storage → auth key → token value.',
              ),
            ),
          300_000,
        ),
      ),
    ]).finally(() => server.close())

    return result.token
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

function startTokenRelayServer(): Promise<{
  port: number
  resultPromise: Promise<TokenRelayResult>
  server: ReturnType<typeof createServer>
}> {
  return new Promise((resolve) => {
    let resolveResult: (r: TokenRelayResult) => void
    const resultPromise = new Promise<TokenRelayResult>((res) => {
      resolveResult = res
    })

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost`)

      if (url.pathname === '/callback' && req.method === 'POST') {
        // Receive token via POST from the relay page
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { token?: string }
            if (data.token) {
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              })
              res.end(JSON.stringify({ ok: true }))
              console.error('  ✓ Token received via relay page')
              resolveResult({ token: data.token })
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing token' }))
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON' }))
          }
        })
        return
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end()
        return
      }

      // Handle bookmarklet redirect: GET /callback?token=...
      if (url.pathname === '/callback' && req.method === 'GET' && url.searchParams.has('token')) {
        const token = url.searchParams.get('token')!
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h2 style="color:#01a982">✓ Token received!</h2><p>You can close this window.</p></body></html>',
        )
        console.error('  ✓ Token received via bookmarklet')
        resolveResult({ token })
        return
      }

      if (url.pathname === '/' && req.method === 'GET') {
        const port = (server.address() as { port: number })?.port ?? 0
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(getTokenRelayHtml(port))
        return
      }

      res.writeHead(404)
      res.end('Not found')
    })

    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, resultPromise, server })
    })
  })
}

/* v8 ignore start */
function getTokenRelayHtml(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>HPE Navigator — Token Relay</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 40px auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #01a982; margin-top: 0; }
    .step { margin: 16px 0; padding: 12px; background: #f8f9fa; border-left: 3px solid #01a982; border-radius: 4px; }
    .step-num { font-weight: bold; color: #01a982; }
    textarea { width: 100%; height: 80px; margin: 8px 0; font-family: monospace; font-size: 12px; padding: 8px; border: 2px solid #ddd; border-radius: 4px; resize: vertical; }
    textarea:focus { border-color: #01a982; outline: none; }
    button { background: #01a982; color: white; border: none; padding: 12px 24px; border-radius: 4px; font-size: 14px; cursor: pointer; }
    button:hover { background: #018a6e; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .success { color: #01a982; font-weight: bold; display: none; }
    .error { color: #c00; display: none; margin-top: 8px; }
    .bookmarklet { display: inline-block; padding: 8px 16px; background: #333; color: #fff; border-radius: 4px; text-decoration: none; font-size: 13px; margin: 8px 0; }
    .bookmarklet:hover { background: #555; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
    .divider { border-top: 1px solid #eee; margin: 20px 0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>HPE Navigator — Token Relay</h1>

    <div class="step">
      <span class="step-num">Option A:</span> Drag this bookmarklet to your bookmark bar, then click it on the Navigator page after logging in:<br>
      <a class="bookmarklet" href="javascript:void((function(){try{var s=localStorage.getItem('auth');if(!s)return alert('No auth data found in localStorage. Make sure you are on Navigator and logged in.');var d=JSON.parse(s);if(!d.token)return alert('No token in auth data.');window.location='http://localhost:${port}/callback?token='+encodeURIComponent(d.token)}catch(e){alert('Error: '+e.message)}})())">📋 Relay Token</a>
    </div>

    <div class="divider">
      <span class="step-num">Option B:</span> Paste the token manually:
    </div>

    <div class="step">
      In Navigator browser tab: <code>DevTools → Application → Local Storage → https://navigator.service.suptools.hpecorp.net</code><br>
      Find key <code>auth</code>, copy the <code>token</code> value from the JSON and paste below:
    </div>

    <textarea id="token" placeholder="Paste your CXO token here (eyJ...)"></textarea>
    <button id="submit" onclick="submitToken()">Submit Token</button>

    <p class="success" id="success">✓ Token received! You can close this window.</p>
    <p class="error" id="error"></p>
  </div>

  <script>
    // Handle bookmarklet redirect with token in URL
    const params = new URLSearchParams(window.location.search);
    if (params.has('token')) {
      document.getElementById('token').value = params.get('token');
      submitToken();
    }

    async function submitToken() {
      const token = document.getElementById('token').value.trim();
      if (!token) return;
      if (!token.startsWith('eyJ')) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Token should start with "eyJ" (JWT format)';
        return;
      }
      try {
        const res = await fetch('http://localhost:${port}/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          document.getElementById('success').style.display = 'block';
          document.getElementById('submit').disabled = true;
          document.getElementById('error').style.display = 'none';
        } else {
          throw new Error('Server rejected token');
        }
      } catch (e) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Failed to relay token: ' + e.message;
      }
    }
  </script>
</body>
</html>`
}
/* v8 ignore end */
