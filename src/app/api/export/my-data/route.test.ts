import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    horse: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    horseNote: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    provider: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

const mockProviderSession = {
  user: {
    id: "provider-user-1",
    email: "magnus@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

const mockUser = {
  id: "customer-1",
  email: "anna@test.se",
  firstName: "Anna",
  lastName: "Svensson",
  phone: "0701234567",
  userType: "customer",
  city: "Stockholm",
  address: "Storgatan 1",
  createdAt: new Date("2026-01-01"),
}

const mockHorses = [
  {
    id: "horse-1",
    name: "Blansen",
    breed: "Svenskt varmblod",
    birthYear: 2018,
    color: "Brun",
    gender: "gelding",
    specialNeeds: null,
    isActive: true,
    createdAt: new Date(),
  },
]

const mockBookings = [
  {
    id: "booking-1",
    bookingDate: new Date("2026-02-15"),
    startTime: "09:00",
    endTime: "09:45",
    status: "completed",
    customerNotes: "Extra care",
    horseName: "Blansen",
    service: { name: "Hovslagning" },
    provider: { businessName: "Magnus Hovslagar" },
    horse: { name: "Blansen" },
  },
]

const mockReviews = [
  {
    id: "review-1",
    rating: 5,
    comment: "Excellent!",
    createdAt: new Date("2026-02-16"),
    provider: { businessName: "Magnus Hovslagar" },
    booking: { bookingDate: new Date("2026-02-15"), service: { name: "Hovslagning" } },
  },
]

describe("GET /api/export/my-data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return JSON export for customer", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.horse.findMany).mockResolvedValue(mockHorses as never)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as never)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue(mockReviews as never)

    const request = new NextRequest("http://localhost:3000/api/export/my-data")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user).toMatchObject({
      email: "anna@test.se",
      firstName: "Anna",
      lastName: "Svensson",
    })
    expect(data.horses).toHaveLength(1)
    expect(data.horses[0].name).toBe("Blansen")
    expect(data.bookings).toHaveLength(1)
    expect(data.reviews).toHaveLength(1)
  })

  it("should use select to avoid exposing passwordHash", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    // Prisma select only returns listed fields - verify select is used
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])

    const request = new NextRequest("http://localhost:3000/api/export/my-data")
    await GET(request)

    // Verify we use select (not include) and don't request passwordHash
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          passwordHash: true,
        }),
      })
    )
  })

  it("should return CSV with all sections when format=csv", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.horse.findMany).mockResolvedValue(mockHorses as never)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as never)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue(mockReviews as never)

    const request = new NextRequest(
      "http://localhost:3000/api/export/my-data?format=csv"
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toContain(
      "attachment; filename="
    )

    const text = await response.text()

    // Verify all sections are present
    expect(text).toContain("# Profil")
    expect(text).toContain("anna@test.se")

    expect(text).toContain("# Hästar")
    expect(text).toContain("Blansen")

    expect(text).toContain("# Bokningar")
    expect(text).toContain("bookingId")
    expect(text).toContain("booking-1")

    expect(text).toContain("# Anteckningar")

    expect(text).toContain("# Recensioner")
    expect(text).toContain("Excellent!")
  })

  it("should include provider sections in CSV for provider users", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      id: "provider-user-1",
      userType: "provider",
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: "provider-1",
      businessName: "Magnus Hovslagar",
      description: "Professionell hovslagare",
      address: null,
      city: null,
      postalCode: null,
      serviceAreaKm: null,
      isVerified: true,
      createdAt: new Date("2026-01-01"),
      services: [
        {
          id: "s-1",
          name: "Hovslagning",
          description: "Skoning",
          price: 500,
          durationMinutes: 45,
          isActive: true,
        },
      ],
    } as never)
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/export/my-data?format=csv"
    )
    const response = await GET(request)
    const text = await response.text()

    expect(text).toContain("# Leverantör")
    expect(text).toContain("Magnus Hovslagar")
    expect(text).toContain("# Tjänster")
    expect(text).toContain("Hovslagning")
  })

  it("should return 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest("http://localhost:3000/api/export/my-data")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should return provider-specific data for provider users", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      id: "provider-user-1",
      userType: "provider",
    } as never)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: "provider-1",
      businessName: "Magnus Hovslagar",
      services: [{ id: "s-1", name: "Hovslagning", price: 500 }],
    } as never)
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])

    const request = new NextRequest("http://localhost:3000/api/export/my-data")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.provider).toBeDefined()
    expect(data.provider.businessName).toBe("Magnus Hovslagar")
  })
})
