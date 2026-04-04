/**
 * auth-dual helper tests
 *
 * Tests the getAuthUser() function which resolves auth from Supabase Auth.
 * Previously supported Bearer (mobile token) and NextAuth -- now Supabase only.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

// --- Mocks ---

const mockSupabaseGetUser = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockSupabaseGetUser(),
    },
  }),
}))

const mockAdminGetUser = vi.fn()
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    auth: {
      getUser: (token: string) => mockAdminGetUser(token),
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

  describe("Supabase Auth", () => {
    it("returns AuthUser when Supabase session is valid", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).not.toBeNull()
      expect(result!.authMethod).toBe("supabase")
      expect(result!.id).toBe(TEST_USER_ID)
      expect(result!.providerId).toBe(TEST_PROVIDER_ID)
    })

    it("returns null when no Supabase session", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })

    it("returns null when Supabase throws", async () => {
      mockSupabaseGetUser.mockRejectedValue(new Error("Supabase fail"))

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })
  })

  describe("DB lookup (never trust JWT claims)", () => {
    it("returns providerId from DB, not from JWT claims", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result!.providerId).toBe(TEST_PROVIDER_ID)
    })

    it("returns null when user not found in DB", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(null)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })

    it("returns null providerId when user has no provider", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserCustomer)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result!.providerId).toBeNull()
      expect(result!.stableId).toBeNull()
      expect(result!.userType).toBe("customer")
    })
  })

  describe("Bearer auth (iOS native)", () => {
    it("resolves user from Bearer token when cookie auth fails", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })
      mockAdminGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer valid-token" })
      const result = await getAuthUser(req)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(TEST_USER_ID)
      expect(result!.providerId).toBe(TEST_PROVIDER_ID)
      expect(result!.authMethod).toBe("supabase")
      expect(mockAdminGetUser).toHaveBeenCalledWith("valid-token")
    })

    it("returns null when Bearer token is invalid", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })
      mockAdminGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "invalid token" },
      })

      const req = makeRequest({ Authorization: "Bearer bad-token" })
      const result = await getAuthUser(req)

      expect(result).toBeNull()
    })

    it("does not try Bearer when cookie auth succeeds", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest({ Authorization: "Bearer some-token" })
      await getAuthUser(req)

      expect(mockAdminGetUser).not.toHaveBeenCalled()
    })

    it("does not try Bearer when no Authorization header", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      })

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toBeNull()
      expect(mockAdminGetUser).not.toHaveBeenCalled()
    })
  })

  describe("AuthUser shape", () => {
    it("returns complete AuthUser with all fields", async () => {
      mockSupabaseGetUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID, email: TEST_EMAIL } },
        error: null,
      })
      mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

      const req = makeRequest()
      const result = await getAuthUser(req)

      expect(result).toEqual({
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        userType: "provider",
        isAdmin: false,
        providerId: TEST_PROVIDER_ID,
        stableId: TEST_STABLE_ID,
        authMethod: "supabase",
      } satisfies AuthUser)
    })
  })
})

describe("enrichFromDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns AuthUser with provider data when user is provider", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    const result = await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "supabase")

    expect(result).toEqual({
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      userType: "provider",
      isAdmin: false,
      providerId: TEST_PROVIDER_ID,
      stableId: TEST_STABLE_ID,
      authMethod: "supabase",
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

    const result = await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "supabase")

    expect(result).toBeNull()
  })

  it("uses email from DB when available", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    const result = await enrichFromDatabase(TEST_USER_ID, "fallback@example.com", "supabase")

    expect(result!.email).toBe(TEST_EMAIL)
  })

  it("uses fallback email when DB email is null", async () => {
    mockPrismaFindUnique.mockResolvedValue({ ...dbUserWithProvider, email: null } as never)

    const result = await enrichFromDatabase(TEST_USER_ID, "fallback@example.com", "supabase")

    expect(result!.email).toBe("fallback@example.com")
  })

  it("queries with correct select fields", async () => {
    mockPrismaFindUnique.mockResolvedValue(dbUserWithProvider)

    await enrichFromDatabase(TEST_USER_ID, TEST_EMAIL, "supabase")

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
