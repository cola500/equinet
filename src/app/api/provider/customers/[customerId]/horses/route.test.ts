import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { count: vi.fn() },
    providerCustomer: { count: vi.fn() },
    horse: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn(),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const providerSession = {
  user: { id: "user-1", userType: "provider", providerId: "provider-1" },
} as never

const customerSession = {
  user: { id: "user-1", userType: "customer" },
} as never

const makeParams = (customerId: string) => Promise.resolve({ customerId })

function withRelationship() {
  vi.mocked(prisma.booking.count).mockResolvedValue(1)
}

function withoutRelationship() {
  vi.mocked(prisma.booking.count).mockResolvedValue(0)
  vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)
}

// -----------------------------------------------------------
// GET /api/provider/customers/[customerId]/horses
// -----------------------------------------------------------
describe("GET /api/provider/customers/[customerId]/horses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain("leverantör")
  })

  it("should return 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })

    expect(response.status).toBe(429)
  })

  it("should return 403 when no customer relationship", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withoutRelationship()

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain("relation")
  })

  it("should return horses for valid provider-customer pair", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findMany).mockResolvedValue([
      { id: "h1", name: "Blansen", breed: "Islandshäst", ownerId: "c1" },
    ] as never)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.horses).toHaveLength(1)
    expect(data.horses[0].name).toBe("Blansen")
  })

  it("should return empty array when customer has no horses", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    const response = await GET(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.horses).toEqual([])
  })

  it("should only return active horses", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findMany).mockResolvedValue([])

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses")
    await GET(request, { params: makeParams("c1") })

    expect(prisma.horse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })
})

// -----------------------------------------------------------
// POST /api/provider/customers/[customerId]/horses
// -----------------------------------------------------------
describe("POST /api/provider/customers/[customerId]/horses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen" }),
    })
    const response = await POST(request, { params: makeParams("c1") })
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen" }),
    })
    const response = await POST(request, { params: makeParams("c1") })

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen" }),
    })
    const response = await POST(request, { params: makeParams("c1") })

    expect(response.status).toBe(429)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: "not json",
    })
    const response = await POST(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("should return 400 for missing name", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ breed: "Islandshäst" }),
    })
    const response = await POST(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should reject extra fields (strict mode)", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen", ownerId: "hacked" }),
    })
    const response = await POST(request, { params: makeParams("c1") })

    expect(response.status).toBe(400)
  })

  it("should return 403 when no customer relationship", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withoutRelationship()

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen" }),
    })
    const response = await POST(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain("relation")
  })

  it("should create horse with ownerId = customerId", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.create).mockResolvedValue({
      id: "h1",
      name: "Blansen",
      breed: "Islandshäst",
      ownerId: "c1",
    } as never)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: "Blansen", breed: "Islandshäst" }),
    })
    const response = await POST(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe("Blansen")

    // Verify ownerId is set to customerId, not provider
    expect(prisma.horse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: "c1" }),
      })
    )
  })

  it("should sanitize horse name (strip XSS)", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.create).mockImplementation(async (args: never) => ({
      id: "h1",
      ...args.data,
    }))

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses", {
      method: "POST",
      body: JSON.stringify({ name: '<script>alert("x")</script>Blansen' }),
    })
    const response = await POST(request, { params: makeParams("c1") })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).not.toContain("<script>")
  })
})
