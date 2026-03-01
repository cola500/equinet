import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bugReport: { create: vi.fn() },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { bugReport: vi.fn() },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"

const mockAuth = vi.mocked(auth)
const mockCreate = vi.mocked(prisma.bugReport.create)
const mockRateLimit = vi.mocked(rateLimiters.bugReport)

const mockSession = {
  user: { id: "user-1", email: "test@test.se", userType: "customer" },
} as never

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/bug-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  title: "Knappen fungerar inte",
  description: "När jag klickar på boka-knappen händer inget",
  reproductionSteps: "1. Gå till leverantörssidan\n2. Klicka boka",
  pageUrl: "/providers/123",
  userAgent: "Mozilla/5.0",
  platform: "MacOS",
}

describe("POST /api/bug-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockSession)
    mockRateLimit.mockResolvedValue(true)
    mockCreate.mockResolvedValue({
      id: "bug-1",
      ...validBody,
      userRole: "CUSTOMER",
      userId: "user-1",
      status: "NEW",
      priority: "P2",
      internalNote: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(429)
  })

  it("returns 400 when title is missing", async () => {
    const res = await POST(createRequest({ ...validBody, title: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when description is missing", async () => {
    const res = await POST(createRequest({ ...validBody, description: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/bug-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 201 with bug report ID on success", async () => {
    const res = await POST(createRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.id).toBe("bug-1")
    expect(body.status).toBe("NEW")
  })

  it("derives userRole from session userType", async () => {
    await POST(createRequest(validBody))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userRole: "CUSTOMER",
          userId: "user-1",
        }),
      })
    )
  })

  it("trims title and description", async () => {
    await POST(
      createRequest({
        ...validBody,
        title: "  Trimma mig  ",
        description: "  Trimma mig  ",
      })
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Trimma mig",
          description: "Trimma mig",
        }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockCreate.mockRejectedValue(new Error("DB down"))
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
  })
})
