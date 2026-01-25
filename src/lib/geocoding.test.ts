import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  geocodeAddress,
  isValidSwedishCoordinates,
} from './geocoding'

// Mock fetch globally
global.fetch = vi.fn()

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully geocode a Swedish address', async () => {
    // Mock successful Nominatim API response
    const mockResponse = [{
      lat: '57.930',
      lon: '12.532',
    }]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Storgatan 1, Alingsås, 44130')

    expect(result).toEqual({
      latitude: 57.930,
      longitude: 12.532,
    })

    // Verify fetch was called with correct URL
    const callArg = (global.fetch as any).mock.calls[0][0]
    expect(callArg).toContain('https://nominatim.openstreetmap.org/search')
    expect(callArg).toContain('format=json')
    expect(callArg).toContain('limit=1')
  })

  it('should return null when no address provided', async () => {
    const result = await geocodeAddress('')

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return null when address is only whitespace', async () => {
    const result = await geocodeAddress('   ')

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle empty results from API', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    const result = await geocodeAddress('Invalid Address 12345')

    expect(result).toBeNull()
  })

  it('should handle HTTP error responses', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await geocodeAddress('Storgatan 1, Alingsås')

    expect(result).toBeNull()
  })

  it('should handle network errors', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await geocodeAddress('Storgatan 1, Alingsås')

    expect(result).toBeNull()
  })

  it('should properly encode special characters in address', async () => {
    const mockResponse = [{
      lat: '57.708',
      lon: '11.974',
    }]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await geocodeAddress('Göteborg')

    // Verify URL encoding of Swedish characters
    const callArg = (global.fetch as any).mock.calls[0][0]
    expect(callArg).toContain('G%C3%B6teborg')
  })

  it('should include User-Agent header', async () => {
    const mockResponse = [{
      lat: '59.329',
      lon: '18.068',
    }]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await geocodeAddress('Stockholm')

    // Verify User-Agent header
    const [, options] = (global.fetch as any).mock.calls[0]
    expect(options.headers['User-Agent']).toContain('Equinet')
  })
})

describe('isValidSwedishCoordinates', () => {
  it('should return true for coordinates in Stockholm', () => {
    expect(isValidSwedishCoordinates(59.329, 18.068)).toBe(true)
  })

  it('should return true for coordinates in Göteborg', () => {
    expect(isValidSwedishCoordinates(57.708, 11.974)).toBe(true)
  })

  it('should return true for coordinates in Malmö', () => {
    expect(isValidSwedishCoordinates(55.604, 13.003)).toBe(true)
  })

  it('should return true for coordinates in Kiruna (north)', () => {
    expect(isValidSwedishCoordinates(67.855, 20.225)).toBe(true)
  })

  it('should return true for coordinates near Smygehuk (south)', () => {
    expect(isValidSwedishCoordinates(55.340, 13.360)).toBe(true)
  })

  it('should return false for coordinates in Norway', () => {
    expect(isValidSwedishCoordinates(59.913, 10.752)).toBe(false) // Oslo
  })

  it('should return false for coordinates in Finland', () => {
    expect(isValidSwedishCoordinates(60.169, 24.938)).toBe(false) // Helsinki
  })

  it('should return false for latitude too far north', () => {
    expect(isValidSwedishCoordinates(70.0, 20.0)).toBe(false)
  })

  it('should return false for latitude too far south', () => {
    expect(isValidSwedishCoordinates(54.0, 13.0)).toBe(false)
  })

  it('should return false for longitude too far west', () => {
    expect(isValidSwedishCoordinates(57.0, 10.0)).toBe(false)
  })

  it('should return false for longitude too far east', () => {
    expect(isValidSwedishCoordinates(65.0, 25.0)).toBe(false)
  })

  it('should return false for coordinates at equator', () => {
    expect(isValidSwedishCoordinates(0, 0)).toBe(false)
  })

  it('should handle edge case at southern boundary', () => {
    expect(isValidSwedishCoordinates(55.3, 13.0)).toBe(true)
  })

  it('should handle edge case at northern boundary', () => {
    expect(isValidSwedishCoordinates(69.2, 20.0)).toBe(true)
  })
})
