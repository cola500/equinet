import { describe, it, expect, beforeEach, vi } from "vitest"
import { DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockRemoveWatch = vi.fn()

vi.mock("@/domain/municipality-watch/MunicipalityWatchServiceFactory", () => ({
  createMunicipalityWatchService: () => ({
    removeWatch: mockRemoveWatch,
  }),
}))

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/municipality-watches/${id}`, {
    method: "DELETE",
  })
}

describe("DELETE /api/municipality-watches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await DELETE(makeRequest("w1"), { params: Promise.resolve({ id: "w1" }) })
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a customer", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "provider" },
    } as any)

    const response = await DELETE(makeRequest("w1"), { params: Promise.resolve({ id: "w1" }) })
    expect(response.status).toBe(403)
  })

  it("should return 404 when watch not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockRemoveWatch.mockResolvedValue(false)

    const response = await DELETE(makeRequest("w1"), { params: Promise.resolve({ id: "w1" }) })
    expect(response.status).toBe(404)
  })

  it("should return 200 on successful deletion", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockRemoveWatch.mockResolvedValue(true)

    const response = await DELETE(makeRequest("w1"), { params: Promise.resolve({ id: "w1" }) })
    expect(response.status).toBe(200)
  })

  it("should use customerId from session for ownership check", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "session-user", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockRemoveWatch.mockResolvedValue(true)

    await DELETE(makeRequest("w1"), { params: Promise.resolve({ id: "w1" }) })

    expect(mockRemoveWatch).toHaveBeenCalledWith("w1", "session-user")
  })
})
