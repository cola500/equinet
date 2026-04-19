import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    providerCustomer: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    provider: { findUnique: vi.fn() },
    customerInviteToken: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-server", () => ({ auth: mockAuth }))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/email", () => ({
  sendCustomerInviteNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

import { POST } from "./route"
import { isFeatureEnabled } from "@/lib/feature-flags"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = "a0000000-0000-4000-a000-000000000001"
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000002"
const CUSTOMER_ID = "a0000000-0000-4000-a000-000000000003"

function makeRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/provider/customers/${CUSTOMER_ID}/invite`,
    { method: "POST" }
  )
}

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

function makeManualCustomer(overrides?: Partial<{ isManualCustomer: boolean; email: string }>) {
  return {
    id: CUSTOMER_ID,
    email: overrides?.email ?? "kund@example.com",
    firstName: "Test",
    isManualCustomer: overrides?.isManualCustomer ?? true,
  }
}

describe("POST /api/provider/customers/[customerId]/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.providerCustomer.findUnique.mockResolvedValue({
      providerId: PROVIDER_ID,
      customerId: CUSTOMER_ID,
    })
    mockPrisma.user.findUnique.mockResolvedValue(makeManualCustomer())
    mockPrisma.provider.findUnique.mockResolvedValue({
      id: PROVIDER_ID,
      businessName: "Test Stall AB",
    })
    mockPrisma.customerInviteToken.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.customerInviteToken.create.mockResolvedValue({ id: "token-id" })
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag customer_invite is disabled", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 when customer is not in provider's register (IDOR-check)", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.providerCustomer.findUnique.mockResolvedValue(null)
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/kundregister/i)
  })

  it("returns 409 when customer already has an active account", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.user.findUnique.mockResolvedValue(makeManualCustomer({ isManualCustomer: false }))
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(409)
  })

  it("returns 400 when customer has sentinel email (@ghost.equinet.se)", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.user.findUnique.mockResolvedValue(
      makeManualCustomer({ email: "sentinel@ghost.equinet.se" })
    )
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/e-postadress/i)
  })

  it("returns 200 and creates invite token on happy path", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toMatch(/inbjudan/i)
    expect(mockPrisma.customerInviteToken.create).toHaveBeenCalledOnce()
    // Old tokens invalidated
    expect(mockPrisma.customerInviteToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: CUSTOMER_ID, usedAt: null }),
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    )
  })

  it("sends invite email on happy path (fire-and-forget)", async () => {
    mockAuth.mockResolvedValue(makeProviderSession())
    const { sendCustomerInviteNotification } = await import("@/lib/email")
    await POST(makeRequest(), {
      params: Promise.resolve({ customerId: CUSTOMER_ID }),
    })
    expect(sendCustomerInviteNotification).toHaveBeenCalledWith(
      "kund@example.com",
      "Test",
      "Test Stall AB",
      expect.any(String)
    )
  })
})
