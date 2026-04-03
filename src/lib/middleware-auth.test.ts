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
