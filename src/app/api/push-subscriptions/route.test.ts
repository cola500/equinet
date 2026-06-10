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
      findUnique: vi.fn().mockResolvedValue(null),
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

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(401)
  })

  it("should create subscription with 201", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValue({
      id: "ps-1",
      userId: "u1",
      endpoint: validSubscription.endpoint,
      p256dh: validSubscription.keys.p256dh,
      auth: validSubscription.keys.auth,
      createdAt: new Date(),
    } as never)

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(201)
  })

  it("should upsert on duplicate endpoint (200)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValue({
      id: "ps-1",
      userId: "u1",
      endpoint: validSubscription.endpoint,
      p256dh: validSubscription.keys.p256dh,
      auth: validSubscription.keys.auth,
      createdAt: new Date(),
    } as never)

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

// C4 invariant: endpoint ownership cannot be hijacked via upsert.
// If the endpoint already belongs to another user, the request must fail
// closed (409) instead of silently re-pointing the row.
describe("POST /api/push-subscriptions — C4 endpoint-ownership invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("user A registering a fresh endpoint succeeds (201)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-A", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValueOnce({
      id: "ps-1",
      endpoint: validSubscription.endpoint,
      createdAt: new Date(),
    } as never)

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(201)
    expect(prisma.pushSubscription.upsert).toHaveBeenCalled()
  })

  it("user B registering an endpoint already owned by user A fails (409)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-B", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValueOnce({
      id: "ps-1",
      userId: "user-A",
      endpoint: validSubscription.endpoint,
      p256dh: "x",
      auth: "y",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(409)
    expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it("user A re-registering their own endpoint succeeds (idempotent refresh, 201)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-A", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.findUnique).mockResolvedValueOnce({
      id: "ps-1",
      userId: "user-A",
      endpoint: validSubscription.endpoint,
      p256dh: "old",
      auth: "old",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    vi.mocked(prisma.pushSubscription.upsert).mockResolvedValueOnce({
      id: "ps-1",
      endpoint: validSubscription.endpoint,
      createdAt: new Date(),
    } as never)

    const response = await POST(makeRequest("POST", validSubscription))
    expect(response.status).toBe(201)
    expect(prisma.pushSubscription.upsert).toHaveBeenCalled()
  })
})

describe("DELETE /api/push-subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const response = await DELETE(
      makeRequest("DELETE", { endpoint: validSubscription.endpoint })
    )
    expect(response.status).toBe(401)
  })

  it("should delete subscription and return 200", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as never)
    vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValue({ count: 1 })

    const response = await DELETE(
      makeRequest("DELETE", { endpoint: validSubscription.endpoint })
    )
    expect(response.status).toBe(200)
  })
})
