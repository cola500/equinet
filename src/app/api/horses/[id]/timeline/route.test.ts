import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth, getSession } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    horseNote: {
      findMany: vi.fn(),
    },
  },
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

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

const mockProviderSession = {
  user: { id: "provider-user-1", email: "magnus@test.se", userType: "provider" },
} as any

const routeContext = { params: Promise.resolve({ id: "horse-1" }) }

describe("GET /api/horses/[id]/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return merged timeline for horse owner", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "b1",
        bookingDate: new Date("2026-01-20"),
        status: "completed",
        customerNotes: "Stel i ryggen",
        service: { name: "Massage" },
        provider: { businessName: "Sara Hästmassage" },
      },
    ] as any)

    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([
      {
        id: "n1",
        category: "veterinary",
        title: "Vaccination",
        content: "Influensa",
        noteDate: new Date("2026-01-15"),
        author: { firstName: "Anna", lastName: "Svensson" },
      },
    ] as any)

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
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline"
    )
    const response = await GET(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it("should filter by category when query param provided", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline?category=veterinary"
    )
    await GET(request, routeContext)

    expect(prisma.horseNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "veterinary",
        }),
      })
    )
  })

  it("should return 404 if horse not found or not owned", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)
    // Provider booking check also returns nothing
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horse.findUnique).mockResolvedValue(null)

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

  it("should allow provider access if they have a booking for the horse", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    // Not the owner
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)
    // But has a booking for this horse
    vi.mocked(prisma.horse.findUnique).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    // Provider has a booking for this horse
    const bookingFindMany = vi.mocked(prisma.booking.findMany)
    // First call: check provider access
    bookingFindMany.mockResolvedValueOnce([
      { id: "booking-1", providerId: "provider-1" },
    ] as any)
    // Second call: fetch bookings for timeline
    bookingFindMany.mockResolvedValueOnce([
      {
        id: "booking-1",
        bookingDate: new Date("2026-01-20"),
        status: "completed",
        customerNotes: null,
        service: { name: "Hovvård" },
        provider: { businessName: "Magnus Hovslageri" },
      },
    ] as any)

    // Notes should only include provider-visible categories
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/timeline"
    )
    const response = await GET(request, routeContext)

    expect(response.status).toBe(200)
    // Should filter notes to provider-visible categories
    expect(prisma.horseNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { in: ["veterinary", "farrier", "medication"] },
        }),
      })
    )
  })
})
