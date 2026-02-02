import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn() },
    payment: { update: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({
      payment: { update: vi.fn().mockResolvedValue({}) },
    })),
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))
vi.mock("@/domain/accounting/AccountingGateway", () => ({
  getAccountingGateway: vi.fn().mockReturnValue({
    createInvoice: vi.fn().mockResolvedValue({
      success: true,
      externalId: "MOCK-INV-123",
      status: "draft",
    }),
  }),
}))

const mockProviderSession = {
  user: {
    id: "provider-user-1",
    email: "magnus@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as any

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

describe("POST /api/integrations/fortnox/sync", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should sync unsynced bookings", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "booking-1",
        bookingDate: new Date("2026-02-15"),
        customer: { firstName: "Anna", lastName: "Svensson", email: "anna@test.se" },
        provider: { businessName: "Magnus Hovslagar" },
        service: { name: "Hovslagning", price: 1500 },
        payment: { id: "pay-1", amount: 1500, currency: "SEK" },
      },
    ] as any)
    vi.mocked(prisma.payment.update).mockResolvedValue({} as any)

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/sync",
      { method: "POST" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synced).toBe(1)
    expect(data.failed).toBe(0)
    expect(data.total).toBe(1)
  })

  it("should return 0 synced when nothing to sync", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/sync",
      { method: "POST" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synced).toBe(0)
  })

  it("should return 403 for customer users", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/sync",
      { method: "POST" }
    )
    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/sync",
      { method: "POST" }
    )
    const response = await POST(request)

    expect(response.status).toBe(401)
  })
})
