export function decodeJwtExpiry(token: string): number {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  if (typeof payload.exp !== 'number') throw new Error('JWT missing exp claim')
  return payload.exp * 1000
}

export class TokenCache {
  private token: string | null = null
  private expiresAt = 0
  private bufferMs: number

  constructor(bufferMs: number) {
    this.bufferMs = bufferMs
  }

  get(): string | null {
    if (!this.token) return null
    if (Date.now() >= this.expiresAt - this.bufferMs) return null
    return this.token
  }

  set(token: string): void {
    this.token = token
    this.expiresAt = decodeJwtExpiry(token)
  }

  clear(): void {
    this.token = null
    this.expiresAt = 0
  }

  isExpired(): boolean {
    return this.get() === null
  }
}
