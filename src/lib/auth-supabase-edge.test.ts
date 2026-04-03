/**
 * auth-supabase-edge tests
 *
 * Tests the Edge-compatible Supabase cookie helper for middleware.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

const mockGetUser = vi.fn()
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}))

import { getSupabaseUserFromCookie, type SupabaseEdgeUser } from "./auth-supabase-edge"
import { NextRequest } from "next/server"

function makeNextRequest(url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(url)
}

describe("getSupabaseUserFromCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
  })

  it("returns SupabaseEdgeUser when valid Supabase session exists", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
          app_metadata: {
            userType: "provider",
            isAdmin: false,
          },
        },
      },
      error: null,
    })

    const req = makeNextRequest()
    const result = await getSupabaseUserFromCookie(req)

    expect(result).toEqual({
      id: "user-123",
      email: "test@example.com",
      userType: "provider",
      isAdmin: false,
    } satisfies SupabaseEdgeUser)
  })

  it("returns null when no Supabase session", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    })

    const req = makeNextRequest()
    const result = await getSupabaseUserFromCookie(req)

    expect(result).toBeNull()
  })

  it("returns null when Supabase getUser throws", async () => {
    mockGetUser.mockRejectedValue(new Error("Network error"))

    const req = makeNextRequest()
    const result = await getSupabaseUserFromCookie(req)

    expect(result).toBeNull()
  })

  it("defaults userType to 'customer' when not in app_metadata", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
          app_metadata: {},
        },
      },
      error: null,
    })

    const req = makeNextRequest()
    const result = await getSupabaseUserFromCookie(req)

    expect(result!.userType).toBe("customer")
    expect(result!.isAdmin).toBe(false)
  })

  it("handles admin user correctly", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "admin-1",
          email: "admin@example.com",
          app_metadata: {
            userType: "provider",
            isAdmin: true,
          },
        },
      },
      error: null,
    })

    const req = makeNextRequest()
    const result = await getSupabaseUserFromCookie(req)

    expect(result!.isAdmin).toBe(true)
  })
})
