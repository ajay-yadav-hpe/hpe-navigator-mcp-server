import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findSerial, findSerialSchema } from '../src/tools/find.js'
import { MOCK_SERIAL, findResponse } from './fixtures/index.js'

describe('navigator_find_serial', () => {
  const mockClient = {
    findSerial: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return product data for valid serial', async () => {
    mockClient.findSerial.mockResolvedValue(findResponse)
    const result = await findSerial(mockClient as any, { serial: MOCK_SERIAL })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data[0].serial).toBe(MOCK_SERIAL)
    expect(parsed.data[0].product).toBe('arcus')
  })

  it('should return error on API failure', async () => {
    mockClient.findSerial.mockRejectedValue(new Error('Network timeout'))
    const result = await findSerial(mockClient as any, { serial: 'INVALID' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Network timeout')
  })

  it('uses fallback message when non-Error is thrown', async () => {
    mockClient.findSerial.mockRejectedValue('raw string error')
    const result = await findSerial(mockClient as any, { serial: 'X' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: Failed to find serial')
  })

  it('should validate input schema', () => {
    expect(() => findSerialSchema.parse({ serial: '' })).toThrow()
    expect(findSerialSchema.parse({ serial: 'CZ2D3J050T' })).toEqual({ serial: 'CZ2D3J050T' })
  })
})
