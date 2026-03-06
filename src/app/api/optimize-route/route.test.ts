import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

const mockAuth = vi.mocked(auth)
const mockRateLimit = vi.mocked(rateLimiters.api)

const BASE_URL = "http://localhost:3000/api/optimize-route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  stops: [
    { lat: 59.33, lng: 18.07, id: "stop1" },
    { lat: 59.34, lng: 18.08, id: "stop2" },
  ],
}

const providerSession = {
  user: { id: "user1", role: "provider", providerId: "prov1" },
}

describe("POST /api/optimize-route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(providerSession as never)
    mockRateLimit.mockResolvedValue(true)
    // Mock global fetch for Modal API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ optimizedRoute: [] }),
    })
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("Ej inloggad")
  })

  it("returns 403 when user is not a provider", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1", role: "customer" },
    } as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce(false)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 when stops is missing", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 when stops has fewer than 2 items", async () => {
    const res = await POST(makeRequest({ stops: [{ lat: 59.33, lng: 18.07, id: "s1" }] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 when stops has invalid coordinates", async () => {
    const res = await POST(makeRequest({
      stops: [
        { lat: 200, lng: 18.07, id: "s1" },
        { lat: 59.34, lng: 18.08, id: "s2" },
      ],
    }))
    expect(res.status).toBe(400)
  })

  it("rejects unknown fields with .strict()", async () => {
    const res = await POST(makeRequest({ ...validBody, hack: true }))
    expect(res.status).toBe(400)
  })

  it("returns 200 on happy path", async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.optimizedRoute).toBeDefined()
  })

  it("calls auth, getClientIP, and rateLimiters.api", async () => {
    const req = makeRequest(validBody)
    await POST(req)
    expect(mockAuth).toHaveBeenCalled()
    expect(getClientIP).toHaveBeenCalledWith(req)
    expect(mockRateLimit).toHaveBeenCalledWith("127.0.0.1")
  })

  it("returns 500 when Modal API fails", async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: () => Promise.resolve("Bad Gateway"),
    })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(502)
  })
})
