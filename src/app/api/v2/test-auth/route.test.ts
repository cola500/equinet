import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock feature flags
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

// Mock Supabase server client
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { isFeatureEnabled } from "@/lib/feature-flags"
import { GET } from "./route"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function createRequest() {
  return new NextRequest("http://localhost:3000/api/v2/test-auth", {
    method: "GET",
  })
}

describe("GET /api/v2/test-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("supabase_auth_poc")
  })

  it("returns 401 when no Supabase session exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "No session" },
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe("Ej inloggad via Supabase Auth")
  })

  it("returns user data and claims when authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "a0000000-0000-4000-a000-000000000001",
          email: "test@example.com",
          app_metadata: {
            userType: "provider",
            isAdmin: false,
            providerId: "a0000000-0000-4000-a000-000000000002",
          },
          user_metadata: {
            firstName: "Test",
            lastName: "User",
          },
        },
      },
      error: null,
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.user.id).toBe("a0000000-0000-4000-a000-000000000001")
    expect(data.user.email).toBe("test@example.com")
    expect(data.claims.userType).toBe("provider")
    expect(data.claims.providerId).toBe("a0000000-0000-4000-a000-000000000002")
    expect(data.claims.isAdmin).toBe(false)
    expect(data.authMethod).toBe("supabase")
  })

  it("returns claims even without custom app_metadata", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "a0000000-0000-4000-a000-000000000003",
          email: "new@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.user.id).toBe("a0000000-0000-4000-a000-000000000003")
    expect(data.claims.userType).toBeUndefined()
    expect(data.claims.providerId).toBeUndefined()
  })
})
