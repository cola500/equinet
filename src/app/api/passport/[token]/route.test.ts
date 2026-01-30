import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    horsePassportToken: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    horseNote: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

const makeContext = (token: string) => ({ params: Promise.resolve({ token }) })

const validToken = {
  id: "pt-1",
  token: "abc123",
  horseId: "horse-1",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date(),
  horse: {
    id: "horse-1",
    name: "Blansen",
    breed: "Svenskt varmblod",
    birthYear: 2018,
    color: "Brun",
    gender: "gelding",
    specialNeeds: null,
    isActive: true,
  },
}

const expiredToken = {
  ...validToken,
  expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
}

const mockBookings = [
  {
    id: "b-1",
    bookingDate: new Date("2026-02-15"),
    status: "completed",
    service: { name: "Hovslagning" },
    provider: { businessName: "Magnus Hovslagar" },
    customerNotes: null,
  },
]

// Only non-private notes should be visible
const mockNotes = [
  {
    id: "n-1",
    category: "veterinary",
    title: "Vaccination",
    content: "Influensa",
    noteDate: new Date("2026-01-10"),
    author: { firstName: "Dr", lastName: "Smith" },
  },
]

describe("GET /api/passport/[token]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should return horse data for valid token (no auth required)", async () => {
    vi.mocked(prisma.horsePassportToken.findUnique).mockResolvedValue(validToken as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue(mockNotes as any)

    const request = new NextRequest("http://localhost:3000/api/passport/abc123")
    const response = await GET(request, makeContext("abc123"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.horse.name).toBe("Blansen")
    expect(data.horse.breed).toBe("Svenskt varmblod")
    expect(data.timeline).toBeDefined()
    expect(data.timeline.length).toBeGreaterThan(0)
  })

  it("should return 404 for expired token", async () => {
    vi.mocked(prisma.horsePassportToken.findUnique).mockResolvedValue(expiredToken as any)

    const request = new NextRequest("http://localhost:3000/api/passport/abc123")
    const response = await GET(request, makeContext("abc123"))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain("utgången")
  })

  it("should return 404 for non-existent token", async () => {
    vi.mocked(prisma.horsePassportToken.findUnique).mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/passport/invalid")
    const response = await GET(request, makeContext("invalid"))

    expect(response.status).toBe(404)
  })

  it("should not expose private notes (general, injury)", async () => {
    vi.mocked(prisma.horsePassportToken.findUnique).mockResolvedValue(validToken as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue(mockNotes as any)

    const request = new NextRequest("http://localhost:3000/api/passport/abc123")
    await GET(request, makeContext("abc123"))

    // Verify notes are fetched with privacy filter
    expect(prisma.horseNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { in: ["veterinary", "farrier", "medication"] },
        }),
      })
    )
  })

  it("should return 404 for inactive horse", async () => {
    const inactiveHorseToken = {
      ...validToken,
      horse: { ...validToken.horse, isActive: false },
    }
    vi.mocked(prisma.horsePassportToken.findUnique).mockResolvedValue(
      inactiveHorseToken as any
    )

    const request = new NextRequest("http://localhost:3000/api/passport/abc123")
    const response = await GET(request, makeContext("abc123"))

    expect(response.status).toBe(404)
  })
})
