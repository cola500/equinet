import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }))

import { POST } from "./route"
import { rateLimiters } from "@/lib/rate-limit"

const mockRateLimit = vi.mocked(rateLimiters.api)
const mockFetch = vi.fn()

function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/routing", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function osrmSuccess(coordinates = [[18.07, 59.33], [18.08, 59.34]]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        code: "Ok",
        routes: [
          {
            geometry: { coordinates },
            distance: 1500,
            duration: 120,
          },
        ],
      }),
  }
}

describe("POST /api/routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(true)
    global.fetch = mockFetch
    mockFetch.mockResolvedValue(osrmSuccess())
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce(false)

    const res = await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain("många")
  })

  // --- Validation ---

  it("returns 400 when coordinates missing", async () => {
    const res = await POST(createRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Ogiltiga koordinater")
  })

  it("returns 400 when coordinates not an array", async () => {
    const res = await POST(createRequest({ coordinates: "not-array" }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Ogiltiga koordinater")
  })

  it("returns 400 when less than 2 coordinates", async () => {
    const res = await POST(createRequest({ coordinates: [[59.33, 18.07]] }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Ogiltiga koordinater")
  })

  // --- OSRM errors ---

  it("returns 404 when OSRM returns code !== Ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ code: "NoRoute", routes: [] }),
    })

    const res = await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("Ingen rutt hittades")
  })

  it("returns OSRM status when OSRM response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    })

    const res = await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toContain("503")
  })

  // --- Success ---

  it("returns 200 with converted coordinates on success", async () => {
    const res = await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))
    const data = await res.json()

    expect(res.status).toBe(200)
    // OSRM returns lon,lat -> converted back to lat,lon
    expect(data.coordinates).toEqual([[59.33, 18.07], [59.34, 18.08]])
    expect(data.distance).toBe(1500)
    expect(data.duration).toBe(120)
  })

  it("verifies lat,lon -> lon,lat conversion in OSRM URL", async () => {
    await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))

    expect(mockFetch).toHaveBeenCalledOnce()
    const calledUrl = mockFetch.mock.calls[0][0] as string
    // Input is lat,lon -> OSRM needs lon,lat
    expect(calledUrl).toContain("18.07,59.33;18.08,59.34")
  })

  // --- Internal error ---

  it("returns 500 when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"))

    const res = await POST(createRequest({ coordinates: [[59.33, 18.07], [59.34, 18.08]] }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe("Network failure")
  })
})
