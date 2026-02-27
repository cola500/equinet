import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fortnoxConnection: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

const mockProviderSession = {
  user: {
    id: "provider-user-1",
    email: "magnus@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

describe("POST /api/integrations/fortnox/disconnect", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should disconnect Fortnox for provider", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.fortnoxConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      providerId: "provider-1",
    } as never)
    vi.mocked(prisma.fortnoxConnection.delete).mockResolvedValue({} as never)

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/disconnect",
      { method: "POST" }
    )
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.fortnoxConnection.delete).toHaveBeenCalledWith({
      where: { providerId: "provider-1" },
    })
  })

  it("should return 403 for non-provider users", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/disconnect",
      { method: "POST" }
    )
    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it("should return 404 when no connection exists", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.fortnoxConnection.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/disconnect",
      { method: "POST" }
    )
    const response = await POST(request)

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/integrations/fortnox/disconnect",
      { method: "POST" }
    )
    const response = await POST(request)

    expect(response.status).toBe(401)
  })
})
