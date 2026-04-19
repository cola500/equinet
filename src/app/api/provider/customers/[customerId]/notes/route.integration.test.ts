import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    booking: { count: vi.fn() },
    providerCustomer: { count: vi.fn() },
    providerCustomerNote: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-server", () => ({ auth: mockAuth }))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

import { GET, POST } from "./route"
import { DELETE } from "./[noteId]/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = "a0000000-0000-4000-a000-000000000001"
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000002"
const CUSTOMER_ID = "a0000000-0000-4000-a000-000000000003"
const NOTE_ID = "a0000000-0000-4000-a000-000000000004"

function makeProviderSession() {
  return {
    user: {
      id: PROVIDER_USER_ID,
      userType: "provider" as const,
      isAdmin: false,
      providerId: PROVIDER_ID,
    },
  }
}

function makeGetRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/provider/customers/${CUSTOMER_ID}/notes`,
    { method: "GET" }
  )
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/provider/customers/${CUSTOMER_ID}/notes`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  )
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/provider/customers/${CUSTOMER_ID}/notes/${NOTE_ID}`,
    { method: "DELETE" }
  )
}

const mockNote = {
  id: NOTE_ID,
  providerId: PROVIDER_ID,
  customerId: CUSTOMER_ID,
  content: "Bra kund, alltid i tid",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// ---------------------------------------------------------------------------
// GET /api/provider/customers/[customerId]/notes
// ---------------------------------------------------------------------------

describe("GET /api/provider/customers/[customerId]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.booking.count.mockResolvedValue(1)
    mockPrisma.providerCustomer.count.mockResolvedValue(0)
    mockPrisma.providerCustomerNote.findMany.mockResolvedValue([mockNote])
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 403 when no customer relationship", async () => {
    mockPrisma.booking.count.mockResolvedValue(0)
    mockPrisma.providerCustomer.count.mockResolvedValue(0)
    const res = await GET(makeGetRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/kundrelation/i)
  })

  it("returns 200 with note list", async () => {
    const res = await GET(makeGetRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.notes)).toBe(true)
    expect(body.notes).toHaveLength(1)
    expect(body.notes[0]).toMatchObject({ id: NOTE_ID, content: "Bra kund, alltid i tid" })
  })
})

// ---------------------------------------------------------------------------
// POST /api/provider/customers/[customerId]/notes
// ---------------------------------------------------------------------------

describe("POST /api/provider/customers/[customerId]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.booking.count.mockResolvedValue(1)
    mockPrisma.providerCustomer.count.mockResolvedValue(0)
    mockPrisma.providerCustomerNote.create.mockResolvedValue(mockNote)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest({ content: "En anteckning" }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 403 when no customer relationship", async () => {
    mockPrisma.booking.count.mockResolvedValue(0)
    mockPrisma.providerCustomer.count.mockResolvedValue(0)
    const res = await POST(makePostRequest({ content: "En anteckning" }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 400 when content is missing", async () => {
    const res = await POST(makePostRequest({ content: "" }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 400 when content is whitespace only (sanitized to empty)", async () => {
    const res = await POST(makePostRequest({ content: "   " }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 400 when content exceeds 2000 characters", async () => {
    const res = await POST(makePostRequest({ content: "x".repeat(2001) }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 201 with created note on happy path", async () => {
    const res = await POST(makePostRequest({ content: "Bra kund, alltid i tid" }), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ id: NOTE_ID, content: "Bra kund, alltid i tid" })
    expect(mockPrisma.providerCustomerNote.create).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/provider/customers/[customerId]/notes/[noteId]
// ---------------------------------------------------------------------------

describe("DELETE /api/provider/customers/[customerId]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.providerCustomerNote.delete.mockResolvedValue(mockNote)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID, noteId: NOTE_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 404 when note belongs to another provider (IDOR protection)", async () => {
    // Prisma P2025: "Record to delete does not exist" — thrown when WHERE { id, providerId } finds no match
    mockPrisma.providerCustomerNote.delete.mockRejectedValueOnce(
      Object.assign(new Error("Record not found"), { code: "P2025" })
    )
    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID, noteId: NOTE_ID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/anteckningen/i)
  })

  it("returns 204 on happy path", async () => {
    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID, noteId: NOTE_ID }),
    })
    expect(res.status).toBe(204)
  })
})
