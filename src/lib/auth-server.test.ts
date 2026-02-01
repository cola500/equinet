import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock the underlying NextAuth auth function
const mockNextAuth = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: (...args: any[]) => mockNextAuth(...args),
}))

describe("auth-server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module cache so each test gets fresh imports
    vi.resetModules()
  })

  describe("auth()", () => {
    it("should return session when authenticated", async () => {
      const mockSession = {
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
        expires: "2026-12-31T00:00:00.000Z",
      }
      mockNextAuth.mockResolvedValue(mockSession)

      const { auth } = await import("./auth-server")
      const session = await auth()

      expect(session).toEqual(mockSession)
      expect(session.user.id).toBe("user-1")
    })

    it("should throw 401 Response when session is null", async () => {
      mockNextAuth.mockResolvedValue(null)

      const { auth } = await import("./auth-server")

      try {
        await auth()
        expect.fail("Should have thrown")
      } catch (response: any) {
        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toBe("Unauthorized")
      }
    })

    it("should throw 401 when session.user is undefined", async () => {
      mockNextAuth.mockResolvedValue({ expires: "2026-12-31" })

      const { auth } = await import("./auth-server")

      try {
        await auth()
        expect.fail("Should have thrown")
      } catch (response: any) {
        expect(response.status).toBe(401)
        const data = await response.json()
        expect(data.error).toBe("Unauthorized")
      }
    })

    it("should throw 401 when session.user is null", async () => {
      mockNextAuth.mockResolvedValue({ user: null, expires: "2026-12-31" })

      const { auth } = await import("./auth-server")

      try {
        await auth()
        expect.fail("Should have thrown")
      } catch (response: any) {
        expect(response.status).toBe(401)
      }
    })

    it("should return full session object with user properties", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          email: "provider@example.com",
          name: "Provider User",
          userType: "provider",
        },
        expires: "2026-12-31T00:00:00.000Z",
      }
      mockNextAuth.mockResolvedValue(mockSession)

      const { auth } = await import("./auth-server")
      const session = await auth()

      expect(session.user.email).toBe("provider@example.com")
      expect(session.user.name).toBe("Provider User")
      expect(session.expires).toBe("2026-12-31T00:00:00.000Z")
    })
  })

  describe("getSession()", () => {
    it("should return session when authenticated", async () => {
      const mockSession = {
        user: { id: "user-1", email: "test@example.com" },
        expires: "2026-12-31T00:00:00.000Z",
      }
      mockNextAuth.mockResolvedValue(mockSession)

      const { getSession } = await import("./auth-server")
      const session = await getSession()

      expect(session).toEqual(mockSession)
    })

    it("should return null when not authenticated", async () => {
      mockNextAuth.mockResolvedValue(null)

      const { getSession } = await import("./auth-server")
      const session = await getSession()

      expect(session).toBeNull()
    })

    it("should NOT throw when session is null", async () => {
      mockNextAuth.mockResolvedValue(null)

      const { getSession } = await import("./auth-server")

      // Should complete without throwing
      const session = await getSession()
      expect(session).toBeNull()
    })
  })
})
