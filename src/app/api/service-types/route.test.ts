import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findMany: vi.fn().mockResolvedValue([
        { name: "Hovslagning" },
        { name: "Tandrasp" },
        { name: "Hovslagning" }, // duplicate, should be filtered
      ]),
    },
  },
}))

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/service-types", { method: "GET" })
}

describe("GET /api/service-types", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it("should return distinct service type names", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(["Hovslagning", "Tandrasp"])
  })
})
