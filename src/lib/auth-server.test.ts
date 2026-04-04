import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock Supabase server client
const mockGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}))

// Mock Prisma
const mockFindUnique = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}))

describe("auth-server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe("auth()", () => {
    it("should return session when authenticated via Supabase", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      })
      mockFindUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        userType: "provider",
        isAdmin: false,
        provider: { id: "prov-1" },
        stable: null,
      })

      const { auth } = await import("./auth-server")
      const session = await auth()

      expect(session.user.id).toBe("user-1")
      expect(session.user.email).toBe("test@example.com")
      expect(session.user.userType).toBe("provider")
      expect(session.user.isAdmin).toBe(false)
      expect(session.user.providerId).toBe("prov-1")
      expect(session.user.stableId).toBeNull()
    })

    it("should throw 401 Response when no Supabase session", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const { auth } = await import("./auth-server")

      try {
        await auth()
        expect.fail("Should have thrown")
      } catch (err: unknown) {
        const response = err as Response
        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toBe("Unauthorized")
      }
    })

    it("should throw 401 when Supabase user exists but not in DB", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-orphan", email: "orphan@test.com" } },
        error: null,
      })
      mockFindUnique.mockResolvedValue(null)

      const { auth } = await import("./auth-server")

      try {
        await auth()
        expect.fail("Should have thrown")
      } catch (err: unknown) {
        const response = err as Response
        expect(response.status).toBe(401)
      }
    })

    it("should return full session shape with all user properties", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "provider@example.com" } },
        error: null,
      })
      mockFindUnique.mockResolvedValue({
        id: "user-123",
        email: "provider@example.com",
        firstName: "Provider",
        lastName: "User",
        userType: "provider",
        isAdmin: true,
        provider: { id: "prov-99" },
        stable: { id: "stable-1" },
      })

      const { auth } = await import("./auth-server")
      const session = await auth()

      expect(session.user).toEqual({
        id: "user-123",
        email: "provider@example.com",
        name: "Provider User",
        userType: "provider",
        isAdmin: true,
        providerId: "prov-99",
        stableId: "stable-1",
      })
    })
  })

  describe("getSession()", () => {
    it("should return session when authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      })
      mockFindUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        userType: "customer",
        isAdmin: false,
        provider: null,
        stable: null,
      })

      const { getSession } = await import("./auth-server")
      const session = await getSession()

      expect(session).not.toBeNull()
      expect(session!.user.id).toBe("user-1")
    })

    it("should return null when not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const { getSession } = await import("./auth-server")
      const session = await getSession()

      expect(session).toBeNull()
    })

    it("should NOT throw when session is null", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const { getSession } = await import("./auth-server")
      const session = await getSession()
      expect(session).toBeNull()
    })
  })
})
