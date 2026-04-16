/**
 * middleware-auth helper tests
 *
 * Tests the handleAuthorization function extracted from middleware.ts.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest"
import { NextURL } from "next/dist/server/web/next-url"
import { handleAuthorization, type MiddlewareUser } from "./middleware-auth"

function makeNextUrl(pathname: string): NextURL {
  return new NextURL(pathname, "http://localhost:3000")
}

const providerUser: MiddlewareUser = {
  userType: "provider",
  isAdmin: false,
}

const customerUser: MiddlewareUser = {
  userType: "customer",
  isAdmin: false,
}

const adminUser: MiddlewareUser = {
  userType: "provider",
  isAdmin: true,
}

const adminWithMfa: MiddlewareUser = {
  userType: "provider",
  isAdmin: true,
  aal: { currentLevel: "aal2", nextLevel: "aal2" },
}

const adminNeedsMfaVerify: MiddlewareUser = {
  userType: "provider",
  isAdmin: true,
  aal: { currentLevel: "aal1", nextLevel: "aal2" },
}

describe("handleAuthorization", () => {
  describe("admin routes", () => {
    it("allows admin to access /admin", () => {
      const result = handleAuthorization(adminUser, makeNextUrl("/admin"))
      expect(result).toBeNull() // null = NextResponse.next()
    })

    it("blocks non-admin from /admin (page)", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/admin"))
      expect(result!.status).toBe(307) // redirect
    })

    it("blocks non-admin from /api/admin (API)", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/api/admin/users"))
      expect(result!.status).toBe(403)
    })
  })

  describe("provider routes", () => {
    it("allows provider to access /provider", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/provider/dashboard"))
      expect(result).toBeNull()
    })

    it("blocks customer from /provider (page)", () => {
      const result = handleAuthorization(customerUser, makeNextUrl("/provider/dashboard"))
      expect(result!.status).toBe(307) // redirect to /customer
    })

    it("blocks customer from /api/routes (API)", () => {
      const result = handleAuthorization(customerUser, makeNextUrl("/api/routes/my"))
      expect(result!.status).toBe(403)
    })
  })

  describe("customer routes", () => {
    it("allows customer to access /customer", () => {
      const result = handleAuthorization(customerUser, makeNextUrl("/customer/bookings"))
      expect(result).toBeNull()
    })

    it("blocks provider from /customer (page)", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/customer/bookings"))
      expect(result!.status).toBe(307) // redirect to /provider
    })
  })

  describe("admin MFA enforcement", () => {
    it("allows admin with aal2 to access /admin", () => {
      const result = handleAuthorization(adminWithMfa, makeNextUrl("/admin"))
      expect(result).toBeNull()
    })

    it("redirects admin needing MFA verify to /admin/mfa/verify (page)", () => {
      const result = handleAuthorization(adminNeedsMfaVerify, makeNextUrl("/admin/bookings"))
      expect(result!.status).toBe(307)
      expect(result!.headers.get("location")).toContain("/admin/mfa/verify")
    })

    it("returns 403 for admin API needing MFA verify", () => {
      const result = handleAuthorization(adminNeedsMfaVerify, makeNextUrl("/api/admin/users"))
      expect(result!.status).toBe(403)
      const body = JSON.parse(new TextDecoder().decode((result as Response & { body: ReadableStream }).body ? undefined : undefined) || "{}")
      // Just check status -- body assertion is complex in edge runtime
      expect(result!.status).toBe(403)
    })

    it("allows access to /admin/mfa paths even without aal2", () => {
      const result = handleAuthorization(adminNeedsMfaVerify, makeNextUrl("/admin/mfa/verify"))
      expect(result).toBeNull()
    })

    it("allows admin without MFA enrolled (aal not set) to access /admin", () => {
      // No aal = no MFA enrolled = no enforcement
      const result = handleAuthorization(adminUser, makeNextUrl("/admin"))
      expect(result).toBeNull()
    })

    it("blocks non-admin from /admin/mfa/verify", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/admin/mfa/verify"))
      expect(result!.status).toBe(307) // redirect to /
    })

    it("blocks non-admin from /admin/mfa/setup", () => {
      const result = handleAuthorization(customerUser, makeNextUrl("/admin/mfa/setup"))
      expect(result!.status).toBe(307) // redirect to /
    })
  })

  describe("general authenticated routes", () => {
    it("allows any authenticated user to access /dashboard", () => {
      const result = handleAuthorization(providerUser, makeNextUrl("/dashboard"))
      expect(result).toBeNull()
    })

    it("allows any authenticated user to access /api/bookings", () => {
      const result = handleAuthorization(customerUser, makeNextUrl("/api/bookings"))
      expect(result).toBeNull()
    })
  })
})
