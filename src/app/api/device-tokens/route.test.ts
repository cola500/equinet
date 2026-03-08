// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deviceToken: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => {
  class RateLimitServiceError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "RateLimitServiceError"
    }
  }
  return {
    rateLimiters: {
      api: vi.fn().mockResolvedValue(true),
    },
    getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
    RateLimitServiceError,
  }
})

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { POST, DELETE } from "./route"
import { prisma } from "@/lib/prisma"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockAuth = vi.mocked(authFromMobileToken)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function makeRequest(body: unknown, method = "POST") {
  return new NextRequest("http://localhost:3000/api/device-tokens", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-jwt",
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/device-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "tok-1" })
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("saves device token with upsert", async () => {
    vi.mocked(prisma.deviceToken.upsert).mockResolvedValue({
      id: "dt-1",
      userId: "user-1",
      token: "abc123hex",
      platform: "ios",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await POST(makeRequest({ token: "abc123hex", platform: "ios" }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toEqual({ ok: true })

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "abc123hex" },
        create: expect.objectContaining({
          userId: "user-1",
          token: "abc123hex",
          platform: "ios",
        }),
        update: expect.objectContaining({ userId: "user-1" }),
      })
    )
  })

  it("defaults platform to ios", async () => {
    vi.mocked(prisma.deviceToken.upsert).mockResolvedValue({} as never)

    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(200)

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ platform: "ios" }),
      })
    )
  })

  it("returns 401 without valid mobile token", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for missing token", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/device-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-jwt",
      },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for unknown fields (strict)", async () => {
    const res = await POST(
      makeRequest({ token: "abc123hex", platform: "ios", extra: "field" })
    )
    expect(res.status).toBe(400)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(429)
  })

  it("limits to 20 device tokens per user", async () => {
    vi.mocked(prisma.deviceToken.count).mockResolvedValueOnce(20)
    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(429)

    const json = await res.json()
    expect(json.error).toContain("Maximalt")
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("push_notifications")
  })

  it("returns 503 when rate limiter throws", async () => {
    vi.mocked(rateLimiters.api).mockRejectedValueOnce(
      new RateLimitServiceError("Redis down")
    )
    const res = await POST(makeRequest({ token: "abc123hex" }))
    expect(res.status).toBe(503)
  })
})

describe("DELETE /api/device-tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "tok-1" })
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("deletes device token by token + userId", async () => {
    vi.mocked(prisma.deviceToken.deleteMany).mockResolvedValue({ count: 1 })

    const res = await DELETE(makeRequest({ token: "abc123hex" }, "DELETE"))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toEqual({ ok: true })

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: "abc123hex", userId: "user-1" },
    })
  })

  it("returns 401 without valid mobile token", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(makeRequest({ token: "abc123hex" }, "DELETE"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for missing token", async () => {
    const res = await DELETE(makeRequest({}, "DELETE"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const res = await DELETE(makeRequest({ token: "abc123hex" }, "DELETE"))
    expect(res.status).toBe(404)
  })
})
