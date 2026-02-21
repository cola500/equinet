import { describe, it, expect } from "vitest"
import { authSessionMatcher, jsChunkMatcher } from "./sw-matchers"

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

describe("jsChunkMatcher", () => {
  it("should match /_next/static/chunks/*.js", () => {
    const input = createMatcherInput(
      "/_next/static/chunks/app/provider/error-6c48ed33846d0cde.js",
      true
    )
    expect(jsChunkMatcher(input)).toBe(true)
  })

  it("should match /_next/static/css files as false (only .js)", () => {
    const input = createMatcherInput(
      "/_next/static/css/app-abc123.css",
      true
    )
    expect(jsChunkMatcher(input)).toBe(false)
  })

  it("should NOT match cross-origin JS requests", () => {
    const input = createMatcherInput(
      "/_next/static/chunks/main-abc123.js",
      false
    )
    expect(jsChunkMatcher(input)).toBe(false)
  })

  it("should NOT match API routes", () => {
    const input = createMatcherInput("/api/health", true)
    expect(jsChunkMatcher(input)).toBe(false)
  })
})
