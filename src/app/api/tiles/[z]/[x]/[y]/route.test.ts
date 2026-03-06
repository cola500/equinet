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
  logger: { error: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"

const mockAuth = vi.mocked(auth)

const providerSession = {
  user: { id: "user1", role: "provider", providerId: "prov1" },
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/tiles/10/550/300", {
    method: "GET",
  })
}

function makeParams(z: string, x: string, y: string) {
  return { params: Promise.resolve({ z, x, y }) }
}

describe("GET /api/tiles/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(providerSession as never)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await GET(makeRequest(), makeParams("10", "550", "300"))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const res = await GET(makeRequest(), makeParams("10", "550", "300"))
    expect(res.status).toBe(429)
  })

  it("returns 400 for invalid zoom level", async () => {
    const res = await GET(makeRequest(), makeParams("25", "550", "300"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for negative coordinates", async () => {
    const res = await GET(makeRequest(), makeParams("10", "-1", "300"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for non-integer coordinates", async () => {
    const res = await GET(makeRequest(), makeParams("10", "abc", "300"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when x exceeds 2^z", async () => {
    // z=2, max x/y = 3 (2^2 - 1)
    const res = await GET(makeRequest(), makeParams("2", "5", "1"))
    expect(res.status).toBe(400)
  })

  it("returns 200 with image on happy path", async () => {
    const res = await GET(makeRequest(), makeParams("10", "550", "300"))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/png")
  })

  it("returns 404 when upstream tile not found", async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    })
    const res = await GET(makeRequest(), makeParams("10", "550", "300"))
    expect(res.status).toBe(404)
  })
})
