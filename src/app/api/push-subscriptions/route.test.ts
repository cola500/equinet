import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST, DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/push-subscriptions", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BNcR...base64",
    auth: "tBH...base64",
  },
}

describe("POST /api/push-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(401)
  })

  it("should create subscription with 201", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValue({
      id: "ps-1",
      userId: "u1",
      endpoint: validSubscription.endpoint,
      p256dh: validSubscription.keys.p256dh,
      auth: validSubscription.keys.auth,
      createdAt: new Date(),
    } as any)

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(201)
  })

  it("should upsert on duplicate endpoint (200)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValue({
      id: "ps-1",
      userId: "u1",
      endpoint: validSubscription.endpoint,
      p256dh: validSubscription.keys.p256dh,
      auth: validSubscription.keys.auth,
      createdAt: new Date(),
    } as any)

    const response = await POST(makeRequest("POST", validSubscription))
    // Upsert is used so it's always 201
    expect(response.status).toBe(201)
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: validSubscription.endpoint },
      })
    )
  })
})

describe("DELETE /api/push-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should delete subscription and return 200", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValue({ count: 1 })

    const response = await DELETE(
      makeRequest("DELETE", { endpoint: validSubscription.endpoint })
    )
    expect(response.status).toBe(200)
  })
})
