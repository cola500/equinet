import { describe, it, expect, beforeEach, vi } from "vitest"
import { DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    upload: { findFirst: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))
vi.mock("@/lib/supabase-storage", () => ({
  deleteFile: vi.fn().mockResolvedValue(true),
}))

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) })

describe("DELETE /api/upload/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should delete upload owned by user", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.upload.findFirst).mockResolvedValue({
      id: "upload-1",
      userId: "customer-1",
      path: "horses/photo.jpg",
    } as any)
    vi.mocked(prisma.upload.delete).mockResolvedValue({} as any)

    const request = new NextRequest(
      "http://localhost:3000/api/upload/upload-1",
      { method: "DELETE" }
    )
    const response = await DELETE(request, makeContext("upload-1"))

    expect(response.status).toBe(200)
  })

  it("should return 404 for non-owned upload (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.upload.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/upload/other-upload",
      { method: "DELETE" }
    )
    const response = await DELETE(request, makeContext("other-upload"))

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
      "http://localhost:3000/api/upload/upload-1",
      { method: "DELETE" }
    )
    const response = await DELETE(request, makeContext("upload-1"))

    expect(response.status).toBe(401)
  })
})
