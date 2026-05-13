import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('should load defaults when no env vars set', () => {
    const config = loadConfig()
    expect(config.cxoBaseUrl).toBe('https://web.service.cxo.suptools.hpecorp.net')
    expect(config.extractionBaseUrl).toBe('https://extraction.service.cxo.suptools.hpecorp.net')
    expect(config.timeoutMs).toBe(30_000)
    expect(config.downloadTimeoutMs).toBe(600_000)
    expect(config.maxDownloadSizeMb).toBe(500)
    expect(config.tokenRefreshBufferMs).toBe(300_000)
  })

  it('should load from env vars', () => {
    process.env.HPE_NAV_USERNAME = 'test@hpe.com'
    process.env.HPE_NAV_TIMEOUT_MS = '60000'
    try {
      const config = loadConfig()
      expect(config.username).toBe('test@hpe.com')
      expect(config.timeoutMs).toBe(60_000)
    } finally {
      delete process.env.HPE_NAV_USERNAME
      delete process.env.HPE_NAV_TIMEOUT_MS
    }
  })
})
