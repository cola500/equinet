import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT, DELETE } from "./route"
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
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

const routeContext = {
  params: Promise.resolve({ id: "horse-1", noteId: "note-1" }),
}

describe("PUT /api/horses/[id]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should update a note owned by the user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue({
      id: "note-1",
      horseId: "horse-1",
      authorId: "customer-1",
    } as any)
    vi.mocked(prisma.horseNote.update).mockResolvedValue({
      id: "note-1",
      horseId: "horse-1",
      authorId: "customer-1",
      category: "veterinary",
      title: "Uppdaterad titel",
      content: "Nytt innehåll",
      noteDate: new Date("2026-01-15"),
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-1",
      {
        method: "PUT",
        body: JSON.stringify({
          title: "Uppdaterad titel",
          content: "Nytt innehåll",
        }),
      }
    )

    const response = await PUT(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe("Uppdaterad titel")
  })

  it("should return 404 if horse not owned (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-999/notes/note-1",
      {
        method: "PUT",
        body: JSON.stringify({ title: "Hack" }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 404 if note not found on this horse", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-999",
      {
        method: "PUT",
        body: JSON.stringify({ title: "Test" }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid category", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue({
      id: "note-1",
      horseId: "horse-1",
      authorId: "customer-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-1",
      {
        method: "PUT",
        body: JSON.stringify({ category: "bad-category" }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(400)
  })

  it("should return 400 for future noteDate", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue({
      id: "note-1",
      horseId: "horse-1",
      authorId: "customer-1",
    } as any)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-1",
      {
        method: "PUT",
        body: JSON.stringify({ noteDate: futureDate.toISOString() }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(400)
  })
})

describe("DELETE /api/horses/[id]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should hard delete a note", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue({
      id: "note-1",
      horseId: "horse-1",
      authorId: "customer-1",
    } as any)
    vi.mocked(prisma.horseNote.delete).mockResolvedValue({} as any)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-1",
      { method: "DELETE" }
    )

    const response = await DELETE(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBeDefined()
    expect(prisma.horseNote.delete).toHaveBeenCalledWith({
      where: { id: "note-1" },
    })
  })

  it("should return 404 if horse not owned (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-999/notes/note-1",
      { method: "DELETE" }
    )

    const response = await DELETE(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 404 if note not found", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "horse-1",
      ownerId: "customer-1",
      isActive: true,
    } as any)
    vi.mocked(prisma.horseNote.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-999",
      { method: "DELETE" }
    )

    const response = await DELETE(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/notes/note-1",
      { method: "DELETE" }
    )

    const response = await DELETE(request, routeContext)

    expect(response.status).toBe(401)
  })
})
