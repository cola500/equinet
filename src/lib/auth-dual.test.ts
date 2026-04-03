/**
 * auth-dual helper tests -- BDD dual-loop
 *
 * Tests the getAuthUser() function which resolves auth from three sources:
 * Bearer (mobile token) > NextAuth (session cookie) > Supabase Auth (cookie)
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

// --- Mocks ---

const mockAuthFromMobileToken = vi.fn()
vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: (...args: unknown[]) => mockAuthFromMobileToken(...args),
}))

const mockNextAuth = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockNextAuth(...args),
}))

const mockSupabaseGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockSupabaseGetUser(),
    },
  }),
}))

const mockPrismaFindUnique = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
  },
}))

import { getAuthUser, enrichFromDatabase, type AuthUser } from "./auth-dual"

// --- Test data ---

const TEST_USER_ID = "a0000000-0000-4000-a000-000000000001"
const TEST_PROVIDER_ID = "b0000000-0000-4000-b000-000000000001"
const TEST_STABLE_ID = "c0000000-0000-4000-c000-000000000001"
const TEST_EMAIL = "test@example.com"

const dbUserWithProvider = {
  id: TEST_USER_ID,
  email: TEST_EMAIL,
  userType: "provider",
  isAdmin: false,
  provider: { id: TEST_PROVIDER_ID },
  stable: { id: TEST_STABLE_ID },
}

const dbUserCustomer = {
  id: TEST_USER_ID,
  email: TEST_EMAIL,
  userType: "customer",
  isAdmin: false,
  provider: null,
  stable: null,
}

function makeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/test", {
    headers: headers ?? {},
  })
}

// --- Tests ---

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("priority order: Bearer > NextAuth > Supabase", () => {
    it("uses Bearer token when Authorization header present", async () => {
      mockAuthFromMobileToken.mockResolvedValue({
        userId: TEST_USER_ID,
        tokenId: "token-1",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer valid-jwt" })
      const result = await getAuthUser(req)

      expect(result).not.toBeNull()
      expect(result!.authMethod).toBe("bearer")
      expect(result!.id).toBe(TEST_USER_ID)
      expect(result!.providerId).toBe(TEST_PROVIDER_ID)
      // NextAuth and Supabase should NOT be called
      expect(mockNextAuth).not.toHaveBeenCalled()
      expect(mockSupabaseGetUser).not.toHaveBeenCalled()
    })

    it("falls back to NextAuth when Bearer is absent", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
        expires: "2026-12-31",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).not.toBeNull()
      expect(result!.authMethod).toBe("nextauth")
      expect(mockSupabaseGetUser).not.toHaveBeenCalled()
    })

    it("falls back to Supabase when Bearer and NextAuth are absent", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockResolvedValue(null)
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).not.toBeNull()
      expect(result!.authMethod).toBe("supabase")
    })

    it("returns null when no auth source succeeds", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockResolvedValue(null)
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })

    it("Bearer wins over NextAuth when both present", async () => {
      mockAuthFromMobileToken.mockResolvedValue({
        userId: TEST_USER_ID,
        tokenId: "token-1",
      })
      mockNextAuth.mockResolvedValue({
        user: { id: "other-user", email: "other@example.com" },
        expires: "2026-12-31",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer valid-jwt" })
      const result = await getAuthUser(req)

      expect(result!.authMethod).toBe("bearer")
      expect(mockNextAuth).not.toHaveBeenCalled()
    })
  })

  describe("DB lookup (never trust JWT claims)", () => {
    it("returns providerId from DB, not from JWT claims", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          email: TEST_EMAIL,
          providerId: "stale-provider-id", // stale claim
        },
        expires: "2026-12-31",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result!.providerId).toBe(TEST_PROVIDER_ID) // from DB, not claim
    })

    it("returns null when user not found in DB", async () => {
      mockAuthFromMobileToken.mockResolvedValue({
        userId: TEST_USER_ID,
        tokenId: "token-1",
      })
      mockPrismaFindUnique.mockResolvedValue(null)

      const req = makeRequest({ Authorization: "Bearer valid-jwt" })
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })

    it("returns null providerId when user has no provider", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
        expires: "2026-12-31",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserCustomer)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result!.providerId).toBeNull()
      expect(result!.stableId).toBeNull()
      expect(result!.userType).toBe("customer")
    })
  })

  describe("AuthUser shape", () => {
    it("returns complete AuthUser with all fields", async () => {
      mockAuthFromMobileToken.mockResolvedValue({
        userId: TEST_USER_ID,
        tokenId: "token-1",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer valid-jwt" })
      const result = await getAuthUser(req)

      expect(result).toEqual({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        userType: "provider",
        isAdmin: false,
        providerId: TEST_PROVIDER_ID,
        stableId: TEST_STABLE_ID,
        authMethod: "bearer",
      } satisfies AuthUser)
    })
  })

  describe("error handling", () => {
    it("continues to next auth source when Bearer throws", async () => {
      mockAuthFromMobileToken.mockRejectedValue(new Error("Token service down"))
      mockNextAuth.mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_EMAIL },
        expires: "2026-12-31",
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer bad" })
      const result = await getAuthUser(req)

      expect(result!.authMethod).toBe("nextauth")
    })

    it("continues to Supabase when NextAuth throws", async () => {
      mockAuthFromMobileToken.mockResolvedValue(null)
      mockNextAuth.mockRejectedValue(new Error("NextAuth error"))
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result!.authMethod).toBe("supabase")
    })

    it("returns null when all auth sources throw", async () => {
      mockAuthFromMobileToken.mockRejectedValue(new Error("Bearer fail"))
      mockNextAuth.mockRejectedValue(new Error("NextAuth fail"))
      mockSupabaseGetUser.mockRejectedValue(new Error("Supabase fail"))

      const req = makeRequest({ Authorization: "Bearer bad" })
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })
  })
})

describe("enrichFromDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns AuthUser with provider data when user is provider", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    const result = await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "nextauth")

    expect(result).toEqual({
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      userType: "provider",
      isAdmin: false,
      providerId: TEST_PROVIDER_ID,
      stableId: TEST_STABLE_ID,
      authMethod: "nextauth",
    })
  })

  it("returns AuthUser without provider data for customers", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserCustomer)

    const result = await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "supabase")

    expect(result!.providerId).toBeNull()
    expect(result!.stableId).toBeNull()
    expect(result!.userType).toBe("customer")
    expect(result!.authMethod).toBe("supabase")
  })

  it("returns null when user not in database", async () => {
    mockPrismaFindUnique.mockResolvedValue(null)

    const result = await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "bearer")

    expect(result).toBeNull()
  })

  it("uses email from DB when available", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    const result = await enrichFromDatabase(TEST_USER_ID, "fallback@example.com", "bearer")

    expect(result!.email).toBe(TEST_EMAIL) // DB email, not fallback
  })

  it("uses fallback email when DB email is null", async () => {
    mockPrismaFindUnique.mockResolvedValue({ ...dbUserWithProvider, email: null } as never)

    const result = await enrichFromDatabase(TEST_USER_ID, "fallback@example.com", "bearer")

    expect(result!.email).toBe("fallback@example.com")
  })

  it("queries with correct select fields", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "bearer")

    expect(mockPrismaFindUnique).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      select: {
        id: true,
        email: true,
        userType: true,
        isAdmin: true,
        provider: { select: { id: true } },
        stable: { select: { id: true } },
      },
    })
  })
})
