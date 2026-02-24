import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"
import { _setRepositoryForTesting } from "@/lib/feature-flags"
import { MockFeatureFlagRepository } from "@/infrastructure/persistence/feature-flag"

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

describe("GET /api/feature-flags", () => {
  let mockRepo: MockFeatureFlagRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = new MockFeatureFlagRepository()
    _setRepositoryForTesting(mockRepo)
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FEATURE_")) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    _setRepositoryForTesting(null)
  })

  it("returns all feature flags with default values", async () => {
    const request = new NextRequest("http://localhost:3000/api/feature-flags")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.flags).toEqual({
      voice_logging: true,
      route_planning: true,
      route_announcements: true,
      customer_insights: true,
      due_for_service: true,
      group_bookings: false,
      business_insights: true,
      self_reschedule: true,
      recurring_bookings: false,
      offline_mode: true,
      follow_provider: false,
      municipality_watch: false,
    })
  })

  it("reflects DB overrides", async () => {
    await mockRepo.upsert("group_bookings", true)

    const request = new NextRequest("http://localhost:3000/api/feature-flags")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.flags.group_bookings).toBe(true)
  })

  it("reflects env overrides", async () => {
    process.env.FEATURE_VOICE_LOGGING = "false"

    const request = new NextRequest("http://localhost:3000/api/feature-flags")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.flags.voice_logging).toBe(false)
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/feature-flags")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
