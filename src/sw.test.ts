import { describe, it, expect } from "vitest"
import { authSessionMatcher } from "./sw-matchers"

// Helper to create a minimal matcher input
function createMatcherInput(
  pathname: string,
  sameOrigin: boolean
): { url: { pathname: string }; sameOrigin: boolean } {
  return { url: { pathname }, sameOrigin }
}

describe("authSessionMatcher", () => {
  it("should match /api/auth/session from same origin", () => {
    const input = createMatcherInput("/api/auth/session", true)
    expect(authSessionMatcher(input)).toBe(true)
  })

  it("should NOT match /api/auth/signin", () => {
    const input = createMatcherInput("/api/auth/signin", true)
    expect(authSessionMatcher(input)).toBe(false)
  })

  it("should NOT match /api/bookings", () => {
    const input = createMatcherInput("/api/bookings", true)
    expect(authSessionMatcher(input)).toBe(false)
  })

  it("should NOT match /api/auth/session from different origin", () => {
    const input = createMatcherInput("/api/auth/session", false)
    expect(authSessionMatcher(input)).toBe(false)
  })
})
