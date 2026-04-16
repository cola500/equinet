import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  DataRetentionService,
  type DataRetentionServiceDeps,
  type InactiveUser,
} from "./DataRetentionService"

function createMockDeps(
  overrides: Partial<DataRetentionServiceDeps> = {}
): DataRetentionServiceDeps {
  return {
    listAuthUsers: vi.fn().mockResolvedValue([]),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    getAppMetadata: vi.fn().mockResolvedValue({}),
    setAppMetadata: vi.fn().mockResolvedValue(undefined),
    sendRetentionWarning: vi.fn().mockResolvedValue(undefined),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true }),
    ...overrides,
  }
}

const TWO_YEARS_AGO = new Date("2024-01-01T00:00:00Z")
const RECENTLY = new Date("2026-03-01T00:00:00Z")

function makeAuthUser(overrides: Partial<{ id: string; email: string; last_sign_in_at: string }> = {}) {
  return {
    id: overrides.id ?? "auth-1",
    email: overrides.email ?? "inactive@test.se",
    last_sign_in_at: overrides.last_sign_in_at ?? TWO_YEARS_AGO.toISOString(),
  }
}

describe("DataRetentionService", () => {
  let service: DataRetentionService
  let deps: DataRetentionServiceDeps

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("findInactiveUsers", () => {
    it("returns users who have not signed in for 2+ years", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ email: "old@test.se", last_sign_in_at: TWO_YEARS_AGO.toISOString() }),
          makeAuthUser({ email: "recent@test.se", last_sign_in_at: RECENTLY.toISOString() }),
        ]),
        findUserByEmail: vi.fn().mockImplementation(async (email: string) => {
          if (email === "old@test.se") return { id: "user-1", email: "old@test.se", isAdmin: false, isManualCustomer: false }
          return null
        }),
      })
      service = new DataRetentionService(deps)

      const result = await service.findInactiveUsers()

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe("old@test.se")
    })

    it("excludes admin users", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ email: "admin@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-admin",
          email: "admin@test.se",
          isAdmin: true,
          isManualCustomer: false,
        }),
      })
      service = new DataRetentionService(deps)

      const result = await service.findInactiveUsers()

      expect(result).toHaveLength(0)
    })

    it("excludes manual customers (no auth account)", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ email: "manual@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-manual",
          email: "manual@test.se",
          isAdmin: false,
          isManualCustomer: true,
        }),
      })
      service = new DataRetentionService(deps)

      const result = await service.findInactiveUsers()

      expect(result).toHaveLength(0)
    })

    it("excludes users with null last_sign_in_at", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          { id: "auth-1", email: "never@test.se", last_sign_in_at: null },
        ]),
      })
      service = new DataRetentionService(deps)

      const result = await service.findInactiveUsers()

      expect(result).toHaveLength(0)
      expect(deps.findUserByEmail).not.toHaveBeenCalled()
    })

    it("excludes users with no matching public.User record", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ email: "orphan@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue(null),
      })
      service = new DataRetentionService(deps)

      const result = await service.findInactiveUsers()

      expect(result).toHaveLength(0)
    })
  })

  describe("processRetention", () => {
    const inactiveUser: InactiveUser = {
      userId: "user-1",
      authId: "auth-1",
      email: "old@test.se",
      lastSignInAt: TWO_YEARS_AGO,
    }

    it("sends notification to inactive user not yet notified", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ id: "auth-1", email: "old@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "old@test.se",
          isAdmin: false,
          isManualCustomer: false,
        }),
        getAppMetadata: vi.fn().mockResolvedValue({}),
      })
      service = new DataRetentionService(deps)

      const result = await service.processRetention()

      expect(deps.sendRetentionWarning).toHaveBeenCalledWith("old@test.se")
      expect(deps.setAppMetadata).toHaveBeenCalledWith(
        "auth-1",
        expect.objectContaining({ data_retention_notified_at: expect.any(String) })
      )
      expect(result.notified).toBe(1)
      expect(result.deleted).toBe(0)
    })

    it("deletes user after 30-day grace period", async () => {
      const thirtyOneDaysAgo = new Date()
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)

      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ id: "auth-1", email: "old@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "old@test.se",
          isAdmin: false,
          isManualCustomer: false,
        }),
        getAppMetadata: vi.fn().mockResolvedValue({
          data_retention_notified_at: thirtyOneDaysAgo.toISOString(),
        }),
      })
      service = new DataRetentionService(deps)

      const result = await service.processRetention()

      expect(deps.deleteAccount).toHaveBeenCalledWith("user-1")
      expect(result.deleted).toBe(1)
      expect(result.notified).toBe(0)
    })

    it("skips user still within grace period", async () => {
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ id: "auth-1", email: "old@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "old@test.se",
          isAdmin: false,
          isManualCustomer: false,
        }),
        getAppMetadata: vi.fn().mockResolvedValue({
          data_retention_notified_at: tenDaysAgo.toISOString(),
        }),
      })
      service = new DataRetentionService(deps)

      const result = await service.processRetention()

      expect(deps.sendRetentionWarning).not.toHaveBeenCalled()
      expect(deps.deleteAccount).not.toHaveBeenCalled()
      expect(result.notified).toBe(0)
      expect(result.deleted).toBe(0)
      expect(result.skipped).toBe(1)
    })

    it("cancels notice if user has signed in recently", async () => {
      // User was notified, but then signed in again (last_sign_in_at is recent)
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ id: "auth-1", email: "active-again@test.se", last_sign_in_at: RECENTLY.toISOString() }),
        ]),
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "active-again@test.se",
          isAdmin: false,
          isManualCustomer: false,
        }),
        // This user has a notice but logged in recently -- should NOT be in inactive list
      })
      service = new DataRetentionService(deps)

      const result = await service.processRetention()

      // User is not inactive, so nothing happens
      expect(deps.sendRetentionWarning).not.toHaveBeenCalled()
      expect(deps.deleteAccount).not.toHaveBeenCalled()
    })

    it("handles errors gracefully per user without stopping", async () => {
      deps = createMockDeps({
        listAuthUsers: vi.fn().mockResolvedValue([
          makeAuthUser({ id: "auth-1", email: "fail@test.se" }),
          makeAuthUser({ id: "auth-2", email: "ok@test.se" }),
        ]),
        findUserByEmail: vi.fn().mockImplementation(async (email: string) => ({
          id: email === "fail@test.se" ? "user-1" : "user-2",
          email,
          isAdmin: false,
          isManualCustomer: false,
        })),
        getAppMetadata: vi.fn().mockResolvedValue({}),
        sendRetentionWarning: vi.fn()
          .mockRejectedValueOnce(new Error("Email failed"))
          .mockResolvedValueOnce(undefined),
      })
      service = new DataRetentionService(deps)

      const result = await service.processRetention()

      // First user failed, second succeeded
      expect(result.notified).toBe(1)
      expect(result.errors).toBe(1)
    })
  })
})
