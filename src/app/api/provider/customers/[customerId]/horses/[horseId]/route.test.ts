import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT, DELETE } from "./route"
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
      findFirst: vi.fn(),
      update: vi.fn(),
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

const makeParams = (customerId: string, horseId: string) =>
  Promise.resolve({ customerId, horseId })

function withRelationship() {
  vi.mocked(prisma.booking.count).mockResolvedValue(1)
}

function withoutRelationship() {
  vi.mocked(prisma.booking.count).mockResolvedValue(0)
  vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)
}

// -----------------------------------------------------------
// PUT /api/provider/customers/[customerId]/horses/[horseId]
// -----------------------------------------------------------
describe("PUT /api/provider/customers/[customerId]/horses/[horseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Ny Namn" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Ny Namn" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })

    expect(response.status).toBe(403)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: "not json",
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("should reject extra fields (strict mode)", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Test", ownerId: "hacked" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })

    expect(response.status).toBe(400)
  })

  it("should return 403 when no customer relationship", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withoutRelationship()

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Test" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })

    expect(response.status).toBe(403)
  })

  it("should return 404 when horse not found or owned by different customer", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Test" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain("Hästen hittades inte")
  })

  it("should update horse successfully", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "h1",
      ownerId: "c1",
    } as never)
    vi.mocked(prisma.horse.update).mockResolvedValue({
      id: "h1",
      name: "Uppdaterad",
      breed: "Islandshäst",
    } as never)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "PUT",
      body: JSON.stringify({ name: "Uppdaterad" }),
    })
    const response = await PUT(request, { params: makeParams("c1", "h1") })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe("Uppdaterad")
  })
})

// -----------------------------------------------------------
// DELETE /api/provider/customers/[customerId]/horses/[horseId]
// -----------------------------------------------------------
describe("DELETE /api/provider/customers/[customerId]/horses/[horseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "DELETE",
    })
    const response = await DELETE(request, { params: makeParams("c1", "h1") })
    expect(response.status).toBe(401)
  })

  it("should return 403 when no customer relationship", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withoutRelationship()

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "DELETE",
    })
    const response = await DELETE(request, { params: makeParams("c1", "h1") })

    expect(response.status).toBe(403)
  })

  it("should return 404 when horse not found or owned by different customer", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findFirst).mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "DELETE",
    })
    const response = await DELETE(request, { params: makeParams("c1", "h1") })

    expect(response.status).toBe(404)
  })

  it("should soft-delete horse (set isActive=false)", async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    withRelationship()
    vi.mocked(prisma.horse.findFirst).mockResolvedValue({
      id: "h1",
      ownerId: "c1",
    } as never)
    vi.mocked(prisma.horse.update).mockResolvedValue({
      id: "h1",
      isActive: false,
    } as never)

    const request = new NextRequest("http://localhost:3000/api/provider/customers/c1/horses/h1", {
      method: "DELETE",
    })
    const response = await DELETE(request, { params: makeParams("c1", "h1") })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain("tagits bort")

    expect(prisma.horse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "h1" },
        data: { isActive: false },
      })
    )
  })
})
