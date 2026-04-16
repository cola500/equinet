import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/cron-auth", () => ({
  verifyCronAuth: vi.fn(),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockProcessRetention = vi.fn()

vi.mock("@/domain/data-retention/DataRetentionService", () => ({
  DataRetentionService: class {
    processRetention = mockProcessRetention
  },
  createDataRetentionService: () => ({
    processRetention: mockProcessRetention,
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

import { GET } from "./route"
import { verifyCronAuth } from "@/lib/cron-auth"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockVerifyCronAuth = vi.mocked(verifyCronAuth)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/data-retention", {
    method: "GET",
    headers: {
      authorization: "Bearer test-secret",
    },
  })
}

describe("GET /api/cron/data-retention", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCronAuth.mockReturnValue({ ok: true })
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockProcessRetention.mockResolvedValue({
      notified: 0,
      deleted: 0,
      skipped: 0,
      errors: 0,
    })
  })

  it("returns 401 when cron auth fails", async () => {
    mockVerifyCronAuth.mockReturnValue({ ok: false, status: 401 })

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("data_retention")
  })

  it("returns retention results on success", async () => {
    mockProcessRetention.mockResolvedValue({
      notified: 2,
      deleted: 1,
      skipped: 3,
      errors: 0,
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.notified).toBe(2)
    expect(data.deleted).toBe(1)
    expect(data.skipped).toBe(3)
  })

  it("returns 500 on service error", async () => {
    mockProcessRetention.mockRejectedValue(new Error("DB down"))

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
  })
})
