import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, PATCH } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import {
  setRuntimeSetting,
  clearRuntimeSettings,
  getRuntimeSetting,
} from "@/lib/settings/runtime-settings"
import { setFeatureFlagOverride } from "@/lib/feature-flags"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>()
  return {
    ...actual,
    setFeatureFlagOverride: vi.fn().mockResolvedValue(undefined),
    getFeatureFlags: vi.fn().mockResolvedValue({
      voice_logging: true,
      route_planning: true,
      route_announcements: true,
      customer_insights: true,
      due_for_service: true,
      group_bookings: false,
      business_insights: true,
    }),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se" },
} as any

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/settings", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("GET /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRuntimeSettings()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      isAdmin: false,
    } as any)
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(403)
  })

  it("returns runtime settings and env info", async () => {
    setRuntimeSetting("disable_emails", "true")
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.settings).toEqual({ disable_emails: "true" })
    expect(data.env).toHaveProperty("emailDisabledByEnv")
  })

  it("returns empty settings when none set", async () => {
    const res = await GET(makeRequest("GET"))
    const data = await res.json()
    expect(data.settings).toEqual({})
  })

  it("returns featureFlagStates from Redis/getFeatureFlags", async () => {
    const res = await GET(makeRequest("GET"))
    const data = await res.json()
    expect(data.featureFlagStates).toEqual({
      voice_logging: true,
      route_planning: true,
      route_announcements: true,
      customer_insights: true,
      due_for_service: true,
      group_bookings: false,
      business_insights: true,
    })
  })
})

describe("PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRuntimeSettings()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeRequest("PATCH", { key: "disable_emails", value: "true" }))
    expect(res.status).toBe(401)
  })

  it("sets a runtime setting", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { key: "disable_emails", value: "true" })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.key).toBe("disable_emails")
    expect(data.value).toBe("true")
    expect(getRuntimeSetting("disable_emails")).toBe("true")
  })

  it("rejects unknown keys", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { key: "unknown_key", value: "true" })
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PATCH",
      body: "not-json",
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing fields", async () => {
    const res = await PATCH(makeRequest("PATCH", { key: "disable_emails" }))
    expect(res.status).toBe(400)
  })

  it("routes feature flag keys through setFeatureFlagOverride", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { key: "feature_voice_logging", value: "false" })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.key).toBe("feature_voice_logging")
    expect(data.value).toBe("false")
    expect(setFeatureFlagOverride).toHaveBeenCalledWith("voice_logging", "false")
    // Should NOT use setRuntimeSetting directly for feature flags
    expect(getRuntimeSetting("feature_voice_logging")).toBeUndefined()
  })

  it("uses setRuntimeSetting for non-feature keys", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { key: "disable_emails", value: "true" })
    )
    expect(res.status).toBe(200)
    expect(setFeatureFlagOverride).not.toHaveBeenCalled()
    expect(getRuntimeSetting("disable_emails")).toBe("true")
  })
})
