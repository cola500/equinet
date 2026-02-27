import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/geocoding", () => ({ geocodeAddress: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { geocode: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}))

import { GET } from "./route"
import { geocodeAddress } from "@/lib/geocoding"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const BASE_URL = "http://localhost:3000/api/geocode"

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL(BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url, { method: "GET" })
}

describe("GET /api/geocode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.geocode).mockResolvedValue(true)
    vi.mocked(getClientIP).mockReturnValue("127.0.0.1")
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.geocode).mockResolvedValueOnce(false)

    const request = makeRequest({ address: "Storgatan 1" })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toBeDefined()
  })

  it("returns 400 when address param is missing", async () => {
    const request = makeRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Adressparameter krävs")
  })

  it("returns 404 when geocodeAddress returns null", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    const request = makeRequest({ address: "Nonexistent Address 999" })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("Kunde inte geokoda adressen")
  })

  it("returns 200 with result when geocodeAddress succeeds", async () => {
    const mockResult = { lat: 59.3293, lng: 18.0686, displayName: "Stockholm" }
    vi.mocked(geocodeAddress).mockResolvedValue(mockResult)

    const request = makeRequest({ address: "Drottninggatan 1" })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockResult)
  })

  it("passes full address with city and postalCode to geocodeAddress", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 0, lng: 0, displayName: "test" })

    const request = makeRequest({
      address: "Storgatan 1",
      city: "Stockholm",
      postalCode: "111 22",
    })
    await GET(request)

    expect(geocodeAddress).toHaveBeenCalledWith("Storgatan 1, Stockholm, 111 22")
  })

  it("passes address only when city and postalCode are not provided", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 0, lng: 0, displayName: "test" })

    const request = makeRequest({ address: "Kungsgatan 5" })
    await GET(request)

    expect(geocodeAddress).toHaveBeenCalledWith("Kungsgatan 5")
  })

  it("returns 500 when geocodeAddress throws", async () => {
    vi.mocked(geocodeAddress).mockRejectedValue(new Error("Network error"))

    const request = makeRequest({ address: "Storgatan 1" })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("Kunde inte geokoda adressen")
    expect(logger.error).toHaveBeenCalled()
  })

  it("calls getClientIP and rateLimiters.geocode", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: 0, lng: 0, displayName: "test" })

    const request = makeRequest({ address: "Test" })
    await GET(request)

    expect(getClientIP).toHaveBeenCalledWith(request)
    expect(rateLimiters.geocode).toHaveBeenCalledWith("127.0.0.1")
  })
})
