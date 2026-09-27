import { describe, it, expect, vi } from "vitest"
import {
  reconcileCustomerAuth,
  type AuthAdminClient,
  type AuthAdminUserRecord,
  type PublicUserStore,
} from "./demo-customer-auth"

const EMAIL = "lisa.andersson@gmail.com"
const FIRST = "Lisa"
const LAST = "Andersson"
const PASSWORD = "DemoCustomer123!"

function emailExistsError() {
  return { code: "email_exists", message: "Email already registered" }
}

/** In-memory fake standing in for Supabase's auth.admin API. */
function makeFakeAuthAdmin(initialUsers: AuthAdminUserRecord[] = []) {
  let users = [...initialUsers]
  let nextId = 100

  const admin: AuthAdminClient = {
    createUser: vi.fn(async ({ email }) => {
      if (users.some((u) => u.email === email)) {
        return { data: null, error: emailExistsError() }
      }
      const user: AuthAdminUserRecord = { id: `auth-${nextId++}`, email }
      users.push(user)
      return { data: { user }, error: null }
    }),
    listUsers: vi.fn(async () => ({ data: { users: [...users] } })),
    deleteUser: vi.fn(async (id: string) => {
      users = users.filter((u) => u.id !== id)
      return { data: null, error: null }
    }),
  }
  return admin
}

/** In-memory fake standing in for the public.User table + trigger linkage. */
function makeFakePublicUsers(initial: Record<string, string> = {}) {
  // email -> id
  const byEmail = new Map(Object.entries(initial))
  const deletedIds: string[] = []

  const store: PublicUserStore = {
    findByEmail: vi.fn(async (email: string) => {
      const id = byEmail.get(email)
      return id ? { id } : null
    }),
    // Simulates the DB trigger: linking an auth id to this email's public.User row.
    waitForLinked: vi.fn(async (id: string, email: string) => {
      byEmail.set(email, id)
    }),
    deleteWithDependents: vi.fn(async (id: string) => {
      deletedIds.push(id)
      for (const [email, existingId] of byEmail) {
        if (existingId === id) byEmail.delete(email)
      }
    }),
  }
  return { store, byEmail, deletedIds }
}

describe("reconcileCustomerAuth", () => {
  it("creates a fresh auth+public pair when neither exists", async () => {
    const admin = makeFakeAuthAdmin()
    const { store, byEmail } = makeFakePublicUsers()

    const id = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

    expect(id).toMatch(/^auth-/)
    expect(byEmail.get(EMAIL)).toBe(id)
    expect(admin.deleteUser).not.toHaveBeenCalled()
    expect(store.deleteWithDependents).not.toHaveBeenCalled()
  })

  it("reuses the existing pair when auth and public.User are already correctly linked", async () => {
    const admin = makeFakeAuthAdmin([{ id: "auth-1", email: EMAIL }])
    const { store } = makeFakePublicUsers({ [EMAIL]: "auth-1" })

    const id = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

    expect(id).toBe("auth-1")
    expect(admin.deleteUser).not.toHaveBeenCalled()
    expect(store.deleteWithDependents).not.toHaveBeenCalled()
  })

  it("heals an orphaned auth user (auth exists, public.User was reset away)", async () => {
    const admin = makeFakeAuthAdmin([{ id: "auth-old", email: EMAIL }])
    const { store, byEmail } = makeFakePublicUsers() // no public.User for this email

    const id = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

    expect(id).not.toBe("auth-old")
    expect(byEmail.get(EMAIL)).toBe(id)
    expect(admin.deleteUser).toHaveBeenCalledWith("auth-old")
    expect(store.deleteWithDependents).not.toHaveBeenCalled()
  })

  // Regression: public.User exists with the right email but the WRONG id (a
  // plain --reset created it fresh, unaware of an older, still-present
  // auth.users row for the same email under a different id). Reusing the
  // public.User's id would authenticate real logins as the orphaned auth
  // account, which has no matching public.User — the exact "Supabase user
  // not found in DB" / 401 failure seen in the demo customer login.
  describe("mismatched public.User (wrong id for the current auth account)", () => {
    it("repairs the situation deterministically", async () => {
      const admin = makeFakeAuthAdmin([{ id: "auth-old", email: EMAIL }])
      const { store, byEmail, deletedIds } = makeFakePublicUsers({ [EMAIL]: "public-stale-id" })

      const id = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

      // The stale public.User row is removed, not reused.
      expect(deletedIds).toEqual(["public-stale-id"])
      // The orphaned/mismatched auth account is removed too.
      expect(admin.deleteUser).toHaveBeenCalledWith("auth-old")
      // A fresh pair is created and linked.
      expect(id).not.toBe("public-stale-id")
      expect(id).not.toBe("auth-old")
      expect(byEmail.get(EMAIL)).toBe(id)
    })

    it("is idempotent: a repeated run makes no further changes and creates no duplicates", async () => {
      const admin = makeFakeAuthAdmin([{ id: "auth-old", email: EMAIL }])
      const { store, byEmail } = makeFakePublicUsers({ [EMAIL]: "public-stale-id" })

      const first = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

      // Second run, same inputs (auth+public now correctly linked from the first run).
      vi.mocked(admin.deleteUser).mockClear()
      vi.mocked(store.deleteWithDependents).mockClear()
      const second = await reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)

      expect(second).toBe(first)
      expect(admin.deleteUser).not.toHaveBeenCalled()
      expect(store.deleteWithDependents).not.toHaveBeenCalled()
      expect(byEmail.size).toBe(1)
      expect(byEmail.get(EMAIL)).toBe(first)
    })
  })

  it("throws a clear error if account creation still fails after cleanup", async () => {
    const admin = makeFakeAuthAdmin([{ id: "auth-old", email: EMAIL }])
    admin.deleteUser = vi.fn(async () => ({ data: null, error: null })) // deletes nothing for real
    const { store } = makeFakePublicUsers({ [EMAIL]: "public-stale-id" })

    await expect(reconcileCustomerAuth(admin, store, EMAIL, FIRST, LAST, PASSWORD)).rejects.toThrow(
      /Failed to create customer auth/
    )
  })
})
