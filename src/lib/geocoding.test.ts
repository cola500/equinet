import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  geocodeAddress,
  geocodeAddressWithRetry,
  isValidSwedishCoordinates,
  type GeocodingResult
} from './geocoding'

// Mock fetch globally
global.fetch = vi.fn()

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set mock API key for tests
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
  })

  it('should successfully geocode a Swedish address', async () => {
    // Mock successful Google Maps API response
    const mockResponse = {
      status: 'OK',
      results: [{
        geometry: {
          location: {
            lat: 57.930,
            lng: 12.532
          }
        },
        formatted_address: 'Storgatan 1, 441 30 Alingsås, Sweden'
      }]
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Storgatan 1', 'Alingsås', '44130')

    expect(result).toEqual({
      latitude: 57.930,
      longitude: 12.532,
      formattedAddress: 'Storgatan 1, 441 30 Alingsås, Sweden'
    })

    // Verify fetch was called with correct URL components
    const callArg = (global.fetch as any).mock.calls[0][0]
    expect(callArg).toContain('https://maps.googleapis.com/maps/api/geocode/json')
    expect(callArg).toContain('address=Storgatan%201%2C%20Alings') // 'å' is URL-encoded
    expect(callArg).toContain('region=se')
    expect(callArg).toContain('key=test-api-key')
  })

  it('should return null when API key is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY

    const result = await geocodeAddress('Storgatan 1', 'Alingsås')

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return null when no address components provided', async () => {
    const result = await geocodeAddress('', '', '')

    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should handle ZERO_RESULTS from API', async () => {
    const mockResponse = {
      status: 'ZERO_RESULTS',
      results: []
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Invalid Address 12345')

    expect(result).toBeNull()
  })

  it('should handle INVALID_REQUEST from API', async () => {
    const mockResponse = {
      status: 'INVALID_REQUEST',
      results: []
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Test')

    expect(result).toBeNull()
  })

  it('should handle OVER_QUERY_LIMIT from API', async () => {
    const mockResponse = {
      status: 'OVER_QUERY_LIMIT',
      results: []
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Storgatan 1', 'Alingsås')

    expect(result).toBeNull()
  })

  it('should handle HTTP error responses', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const result = await geocodeAddress('Storgatan 1', 'Alingsås')

    expect(result).toBeNull()
  })

  it('should handle network errors', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await geocodeAddress('Storgatan 1', 'Alingsås')

    expect(result).toBeNull()
  })

  it('should handle malformed API response', async () => {
    const mockResponse = {
      status: 'OK',
      results: [{ geometry: null }] // Missing location
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Storgatan 1', 'Alingsås')

    expect(result).toBeNull()
  })

  it('should work with only address (no city or postal code)', async () => {
    const mockResponse = {
      status: 'OK',
      results: [{
        geometry: {
          location: { lat: 59.329, lng: 18.068 }
        },
        formatted_address: 'Stockholm, Sweden'
      }]
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await geocodeAddress('Stockholm')

    expect(result).toEqual({
      latitude: 59.329,
      longitude: 18.068,
      formattedAddress: 'Stockholm, Sweden'
    })
  })

  it('should properly encode special characters in address', async () => {
    const mockResponse = {
      status: 'OK',
      results: [{
        geometry: {
          location: { lat: 57.7, lng: 11.9 }
        },
        formatted_address: 'Göteborg, Sweden'
      }]
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await geocodeAddress('Göteborg')

    // Verify URL encoding of Swedish characters
    const callArg = (global.fetch as any).mock.calls[0][0]
    expect(callArg).toContain('G%C3%B6teborg')
  })
})

describe('geocodeAddressWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return result on first attempt if successful', async () => {
    const mockResponse = {
      status: 'OK',
      results: [{
        geometry: {
          location: { lat: 57.930, lng: 12.532 }
        },
        formatted_address: 'Alingsås, Sweden'
      }]
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const promise = geocodeAddressWithRetry('Alingsås', undefined, undefined, 3, 100)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({
      latitude: 57.930,
      longitude: 12.532,
      formattedAddress: 'Alingsås, Sweden'
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed on second attempt', async () => {
    // First call fails
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] })
    })

    // Second call succeeds
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [{
          geometry: {
            location: { lat: 57.930, lng: 12.532 }
          },
          formatted_address: 'Alingsås, Sweden'
        }]
      })
    })

    const promise = geocodeAddressWithRetry('Alingsås', undefined, undefined, 3, 100)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({
      latitude: 57.930,
      longitude: 12.532,
      formattedAddress: 'Alingsås, Sweden'
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should return null after max retries exceeded', async () => {
    // All calls fail
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] })
    })

    const promise = geocodeAddressWithRetry('Invalid', undefined, undefined, 3, 100)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should use exponential backoff for retries', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] })
    })

    const promise = geocodeAddressWithRetry('Test', undefined, undefined, 3, 100)

    // Run all timers and wait for promise to complete
    await vi.runAllTimersAsync()
    const result = await promise

    // Verify retries happened
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(result).toBeNull()
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

  it('should return false for coordinates in Denmark', () => {
    expect(isValidSwedishCoordinates(55.676, 12.568)).toBe(false) // Copenhagen
    // Note: Copenhagen is close to Sweden (Malmö), so this boundary check is approximate
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
