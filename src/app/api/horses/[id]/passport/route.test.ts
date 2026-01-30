import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    horse: { findFirst: vi.fn() },
    horsePassportToken: { create: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

const mockHorse = {
  id: "horse-1",
  name: "Blansen",
  ownerId: "customer-1",
  isActive: true,
}

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) })

describe("POST /api/horses/[id]/passport", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should create passport token for owned horse", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.horsePassportToken.create).mockResolvedValue({
      id: "token-1",
      horseId: "horse-1",
      token: "abc123def456",
      expiresAt: new Date("2026-03-01"),
      createdAt: new Date(),
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/passport",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("horse-1"))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.token).toBeDefined()
    expect(data.url).toContain("/passport/")
    expect(data.expiresAt).toBeDefined()
  })

  it("should set 30 day expiry", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)

    let capturedData: any
    vi.mocked(prisma.horsePassportToken.create).mockImplementation(async (args: any) => {
      capturedData = args.data
      return {
        id: "token-1",
        token: capturedData.token,
        expiresAt: capturedData.expiresAt,
        horseId: "horse-1",
        createdAt: new Date(),
      }
    })

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/passport",
      { method: "POST" }
    )
    await POST(request, makeContext("horse-1"))

    // Check that expiry is approximately 30 days from now
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const expiresAt = new Date(capturedData.expiresAt).getTime()
    expect(expiresAt - now).toBeGreaterThan(thirtyDays - 60000) // Within 1 minute
    expect(expiresAt - now).toBeLessThan(thirtyDays + 60000)
  })

  it("should return 404 for non-owned horse (IDOR protection)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/other-horse/passport",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("other-horse"))

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/passport",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("horse-1"))

    expect(response.status).toBe(401)
  })
})
