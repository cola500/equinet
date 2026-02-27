import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

// Mock service factory
const mockService = {
  getTimeline: vi.fn(),
}

vi.mock("@/domain/horse/HorseService", () => ({
  createHorseService: () => mockService,
}))

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

const routeContext = { params: Promise.resolve({ id: "horse-1" }) }

describe("GET /api/horses/[id]/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return merged timeline for horse owner", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getTimeline.mockResolvedValue(Result.ok([
      {
        type: "booking",
        id: "b1",
        date: "2026-01-20T00:00:00.000Z",
        title: "Massage",
        providerName: "Sara Hästmassage",
        status: "completed",
        notes: "Stel i ryggen",
      },
      {
        type: "note",
        id: "n1",
        date: "2026-01-15T00:00:00.000Z",
        title: "Vaccination",
        category: "veterinary",
        content: "Influensa",
        authorName: "Anna Svensson",
      },
    ]))

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline"
    )
    const response = await GET(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    // Most recent first
    expect(data[0].type).toBe("booking")
    expect(data[0].title).toBe("Massage")
    expect(data[1].type).toBe("note")
    expect(data[1].title).toBe("Vaccination")
  })

  it("should return empty timeline for horse with no history", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getTimeline.mockResolvedValue(Result.ok([]))

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline"
    )
    const response = await GET(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it("should pass category filter to service", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getTimeline.mockResolvedValue(Result.ok([]))

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline?category=veterinary"
    )
    await GET(request, routeContext)

    expect(mockService.getTimeline).toHaveBeenCalledWith(
      "horse-1",
      "customer-1",
      "veterinary"
    )
  })

  it("should return 404 if horse not found or not accessible", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    mockService.getTimeline.mockResolvedValue(
      Result.fail({ type: "HORSE_NOT_FOUND", message: "Hasten hittades inte" })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-999/timeline"
    )
    const response = await GET(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline"
    )
    const response = await GET(request, routeContext)

    expect(response.status).toBe(401)
  })
})
