import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    horse: { findFirst: vi.fn() },
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

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

const mockHorse = {
  id: "horse-1",
  name: "Blansen",
  breed: "Svenskt varmblod",
  birthYear: 2018,
  color: "Brun",
  gender: "gelding",
  specialNeeds: null,
  ownerId: "customer-1",
}

const mockBookings = [
  {
    id: "b-1",
    bookingDate: new Date("2026-02-15"),
    startTime: "09:00",
    endTime: "09:45",
    status: "completed",
    customerNotes: null,
    service: { name: "Hovslagning" },
    provider: { businessName: "Magnus Hovslagar" },
    horse: { name: "Blansen" },
  },
]

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

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/horses/[id]/export", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should export horse data as JSON for owner", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue(mockNotes as any)

    const request = new NextRequest("http://localhost:3000/api/horses/horse-1/export")
    const response = await GET(request, makeContext("horse-1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.horse.name).toBe("Blansen")
    expect(data.bookings).toHaveLength(1)
    expect(data.notes).toHaveLength(1)
    expect(data.timeline).toBeDefined()
  })

  it("should export as CSV when format=csv", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(mockHorse as any)
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue(mockNotes as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/export?format=csv"
    )
    const response = await GET(request, makeContext("horse-1"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toContain("Blansen")
  })

  it("should return 404 for non-owned horse (IDOR protection)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/horses/other-horse/export")
    const response = await GET(request, makeContext("other-horse"))

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest("http://localhost:3000/api/horses/horse-1/export")
    const response = await GET(request, makeContext("horse-1"))

    expect(response.status).toBe(401)
  })
})
