import { describe, it, expect } from "vitest"
import {
  ROLES,
  requireAuth,
  requireProvider,
  requireCustomer,
} from "./roles"

// Helper: create a mock session
function mockSession(overrides: {
  id?: string
  userType?: string
  isAdmin?: boolean
  providerId?: string | null
  stableId?: string | null
} = {}) {
  return {
    user: {
      id: overrides.id ?? "user-1",
      email: "test@example.com",
      name: "Test User",
      userType: overrides.userType ?? "provider",
      isAdmin: overrides.isAdmin ?? false,
      providerId: overrides.providerId ?? null,
      stableId: overrides.stableId ?? null,
    },
  }
}

// Helper: extract JSON + status from thrown Response
async function catchResponse(fn: () => unknown) {
  try {
    fn()
    throw new Error("Expected function to throw")
  } catch (error) {
    if (error instanceof Response) {
      const body = await error.json()
      return { status: error.status, body }
    }
    throw error
  }
}

// --- ROLES constants ---

describe("ROLES", () => {
  it("should define provider and customer roles", () => {
    expect(ROLES.PROVIDER).toBe("provider")
    expect(ROLES.CUSTOMER).toBe("customer")
  })
})

// --- requireAuth ---

describe("requireAuth", () => {
  it("should throw 401 for null session", async () => {
    const res = await catchResponse(() => requireAuth(null))
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Ej inloggad")
  })

  it("should throw 401 for session without user", async () => {
    const res = await catchResponse(() => requireAuth({ user: undefined } as never))
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Ej inloggad")
  })

  it("should throw 401 for session without user.id", async () => {
    const res = await catchResponse(() =>
      requireAuth({ user: { id: undefined } } as never)
    )
    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Ej inloggad")
  })

  it("should return AuthenticatedUser for valid provider session", () => {
    const session = mockSession({ id: "u1", userType: "provider", isAdmin: false })
    const result = requireAuth(session)

    expect(result).toEqual({
      userId: "u1",
      email: "test@example.com",
      userType: "provider",
      isAdmin: false,
    })
  })

  it("should return AuthenticatedUser for valid customer session", () => {
    const session = mockSession({ id: "u2", userType: "customer", isAdmin: false })
    const result = requireAuth(session)

    expect(result).toEqual({
      userId: "u2",
      email: "test@example.com",
      userType: "customer",
      isAdmin: false,
    })
  })

  it("should detect admin flag", () => {
    const session = mockSession({ isAdmin: true })
    const result = requireAuth(session)
    expect(result.isAdmin).toBe(true)
  })
})

// --- requireProvider ---

describe("requireProvider", () => {
  it("should throw 401 for null session", async () => {
    const res = await catchResponse(() => requireProvider(null))
    expect(res.status).toBe(401)
  })

  it("should throw 403 for customer session", async () => {
    const session = mockSession({ userType: "customer" })
    const res = await catchResponse(() => requireProvider(session))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Åtkomst nekad")
  })

  it("should throw 403 for provider without providerId", async () => {
    const session = mockSession({ userType: "provider", providerId: null })
    const res = await catchResponse(() => requireProvider(session))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Leverantörsprofil saknas")
  })

  it("should return ProviderUser for valid provider session", () => {
    const session = mockSession({
      id: "u1",
      userType: "provider",
      providerId: "prov-1",
    })
    const result = requireProvider(session)

    expect(result.userId).toBe("u1")
    expect(result.providerId).toBe("prov-1")
    expect(result.userType).toBe("provider")
  })
})

// --- requireCustomer ---

describe("requireCustomer", () => {
  it("should throw 401 for null session", async () => {
    const res = await catchResponse(() => requireCustomer(null))
    expect(res.status).toBe(401)
  })

  it("should throw 403 for provider session", async () => {
    const session = mockSession({ userType: "provider" })
    const res = await catchResponse(() => requireCustomer(session))
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Åtkomst nekad")
  })

  it("should return CustomerUser for valid customer session", () => {
    const session = mockSession({ id: "u2", userType: "customer" })
    const result = requireCustomer(session)

    expect(result.userId).toBe("u2")
    expect(result.userType).toBe("customer")
  })
})
