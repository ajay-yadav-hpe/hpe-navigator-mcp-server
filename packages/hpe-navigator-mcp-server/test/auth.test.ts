import { describe, it, expect } from 'vitest'
import { TokenCache, decodeJwtExpiry } from '../src/utils/token-cache.js'
import { createMockJwt } from './fixtures/index.js'

describe('TokenCache', () => {
  it('should return null when no token is set', () => {
    const cache = new TokenCache(300_000)
    expect(cache.get()).toBeNull()
  })

  it('should return token when valid', () => {
    const cache = new TokenCache(300_000)
    const token = createMockJwt(3600)
    cache.set(token)
    expect(cache.get()).toBe(token)
  })

  it('should return null when token is expired', () => {
    const cache = new TokenCache(300_000)
    const token = createMockJwt(-100) // already expired
    cache.set(token)
    expect(cache.get()).toBeNull()
  })

  it('should return null when within buffer window', () => {
    const cache = new TokenCache(300_000) // 5 min buffer
    const token = createMockJwt(200) // expires in 200s (< 300s buffer)
    cache.set(token)
    expect(cache.get()).toBeNull()
  })

  it('should clear token', () => {
    const cache = new TokenCache(300_000)
    cache.set(createMockJwt(3600))
    cache.clear()
    expect(cache.get()).toBeNull()
  })

  it('isExpired returns true for empty cache', () => {
    const cache = new TokenCache(300_000)
    expect(cache.isExpired()).toBe(true)
  })
})

describe('decodeJwtExpiry', () => {
  it('should decode exp from JWT', () => {
    const token = createMockJwt(3600)
    const expiry = decodeJwtExpiry(token)
    expect(expiry).toBeGreaterThan(Date.now())
    expect(expiry).toBeLessThanOrEqual(Date.now() + 3600 * 1000 + 1000)
  })

  it('should throw for invalid JWT format', () => {
    expect(() => decodeJwtExpiry('not-a-jwt')).toThrow('Invalid JWT format')
  })

  it('should throw for JWT without exp', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'test' })).toString('base64url')
    const token = `${header}.${payload}.signature`
    expect(() => decodeJwtExpiry(token)).toThrow('JWT missing exp claim')
  })
})
