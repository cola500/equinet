import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

const mockMfaListFactors = vi.fn()
const mockMfaGetAAL = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      mfa: {
        listFactors: () => mockMfaListFactors(),
        getAuthenticatorAssuranceLevel: () => mockMfaGetAAL(),
      },
    },
  }),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

import { GET } from "./route"

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/mfa/status", {
    method: "GET",
  })
}

describe("GET /api/admin/mfa/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [], phone: [], all: [] },
      error: null,
    })
    mockMfaGetAAL.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
      error: null,
    })
  })

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it("returns MFA status when no factors enrolled", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.enrolled).toBe(false)
    expect(data.currentLevel).toBe("aal1")
    expect(data.nextLevel).toBe("aal1")
    expect(data.factors).toEqual([])
  })

  it("returns MFA status when TOTP factor enrolled", async () => {
    const factor = { id: "factor-1", type: "totp", status: "verified" }
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [factor], phone: [], all: [factor] },
      error: null,
    })
    mockMfaGetAAL.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.enrolled).toBe(true)
    expect(data.currentLevel).toBe("aal1")
    expect(data.nextLevel).toBe("aal2")
    expect(data.factors).toEqual([factor])
  })

  it("returns enrolled=true with aal2 when fully verified", async () => {
    const factor = { id: "factor-1", type: "totp", status: "verified" }
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [factor], phone: [], all: [factor] },
      error: null,
    })
    mockMfaGetAAL.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.enrolled).toBe(true)
    expect(data.currentLevel).toBe("aal2")
  })
})
