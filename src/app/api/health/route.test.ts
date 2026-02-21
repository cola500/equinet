import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { GET, HEAD } from "./route"
import { NextRequest } from "next/server"

function makeRequest(method: string = "GET"): NextRequest {
  return new NextRequest("http://localhost:3000/api/health", { method })
}

describe("/api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET", () => {
    it("returns 200 with database status", async () => {
      const res = await GET(makeRequest())
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe("ok")
      expect(body.checks.database).toBe("connected")
      expect(body.timestamp).toBeDefined()
    })

    it("returns 503 when database is down", async () => {
      const { prisma } = await import("@/lib/prisma")
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
        new Error("Connection refused")
      )

      const res = await GET(makeRequest())
      expect(res.status).toBe(503)

      const body = await res.json()
      expect(body.status).toBe("error")
      expect(body.checks.database).toBe("disconnected")
      expect(body.error).toBe("Connection refused")
    })

    it("returns 429 when rate limited", async () => {
      const { rateLimiters } = await import("@/lib/rate-limit")
      vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

      const res = await GET(makeRequest())
      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error).toBeDefined()
    })
  })

  describe("HEAD", () => {
    it("returns 200 with empty body", async () => {
      const res = await HEAD()
      expect(res.status).toBe(200)

      const body = await res.text()
      expect(body).toBe("")
    })

    it("has no rate limiting", async () => {
      const { rateLimiters } = await import("@/lib/rate-limit")

      await HEAD()
      await HEAD()
      await HEAD()

      expect(rateLimiters.api).not.toHaveBeenCalled()
    })
  })
})
