import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findFirst: vi.fn(),
    },
    horseNote: {
      findMany: vi.fn(),
      create: vi.fn(),
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

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

const routeContext = { params: Promise.resolve({ id: "horse-1" }) }

describe("GET /api/horses/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return notes for horse owned by authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([
      {
        id: "note-1",
        horseId: "horse-1",
        authorId: "customer-1",
        category: "veterinary",
        title: "Vaccination - influensa",
        content: "Årlig vaccination genomförd",
        noteDate: new Date("2026-01-15"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes"
    )
    const response = await GET(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: "note-1",
      category: "veterinary",
      title: "Vaccination - influensa",
    })
  })

  it("should filter notes by category when query param provided", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes?category=veterinary"
    )
    await GET(request, routeContext)

    expect(prisma.horseNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          horseId: "horse-1",
          category: "veterinary",
        }),
      })
    )
  })

  it("should return 404 if horse not found or not owned", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-999/notes"
    )
    const response = await GET(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it("should return 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes"
    )
    const response = await GET(request, routeContext)

    expect(response.status).toBe(401)
  })
})

describe("POST /api/horses/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create a note for owned horse", async () => {
    const mockNote = {
      id: "note-new",
      horseId: "horse-1",
      authorId: "customer-1",
      category: "veterinary",
      title: "Vaccination - influensa",
      content: "Årlig vaccination",
      noteDate: new Date("2026-01-15"),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.create).mockResolvedValue(mockNote as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "veterinary",
          title: "Vaccination - influensa",
          content: "Årlig vaccination",
          noteDate: "2026-01-15T00:00:00.000Z",
        }),
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toMatchObject({
      id: "note-new",
      category: "veterinary",
      title: "Vaccination - influensa",
    })
  })

  it("should return 400 for invalid category", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "invalid-category",
          title: "Test",
          noteDate: "2026-01-15T00:00:00.000Z",
        }),
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation error")
  })

  it("should return 400 when title is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "veterinary",
          noteDate: "2026-01-15T00:00:00.000Z",
        }),
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation error")
  })

  it("should return 400 when noteDate is in the future", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "veterinary",
          title: "Framtida event",
          noteDate: futureDate.toISOString(),
        }),
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation error")
  })

  it("should return 404 if horse not owned by user (IDOR protection)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-999/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "general",
          title: "Test",
          noteDate: "2026-01-15T00:00:00.000Z",
        }),
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBeDefined()
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: "not json",
      }
    )

    const response = await POST(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Invalid JSON")
  })

  it("should set authorId from session, not request body", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.create).mockResolvedValue({
      id: "note-new",
      horseId: "horse-1",
      authorId: "customer-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "general",
          title: "Test",
          noteDate: "2026-01-15T00:00:00.000Z",
          authorId: "attacker-id", // Should be ignored
        }),
      }
    )

    await POST(request, routeContext)

    expect(prisma.horseNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: "customer-1", // From session, not body
        }),
      })
    )
  })

  it("should accept note without content (optional)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.create).mockResolvedValue({
      id: "note-new",
      horseId: "horse-1",
      authorId: "customer-1",
      category: "general",
      title: "Kort notering",
      content: null,
      noteDate: new Date("2026-01-15"),
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes",
      {
        method: "POST",
        body: JSON.stringify({
          category: "general",
          title: "Kort notering",
          noteDate: "2026-01-15T00:00:00.000Z",
        }),
      }
    )

    const response = await POST(request, routeContext)

    expect(response.status).toBe(201)
  })
})
