import { describe, it, expect } from "vitest"
import { isNavigationOrRSCRequest } from "./sw-fallback-matcher"

describe("isNavigationOrRSCRequest", () => {
  it("returns true for document requests (hard navigation)", () => {
    const request = new Request("https://example.com/provider/dashboard")
    // Request.destination is read-only in browsers, simulate via defineProperty
    Object.defineProperty(request, "destination", { value: "document" })

    expect(isNavigationOrRSCRequest(request)).toBe(true)
  })

  it("returns true for RSC requests (client-side Link navigation)", () => {
    const request = new Request("https://example.com/provider/bookings", {
      headers: { RSC: "1" },
    })

    expect(isNavigationOrRSCRequest(request)).toBe(true)
  })

  it("returns true for RSC prefetch requests", () => {
    const request = new Request("https://example.com/provider/routes", {
      headers: {
        RSC: "1",
        "Next-Router-Prefetch": "1",
      },
    })

    expect(isNavigationOrRSCRequest(request)).toBe(true)
  })

  it("returns false for API requests", () => {
    const request = new Request("https://example.com/api/bookings")

    expect(isNavigationOrRSCRequest(request)).toBe(false)
  })

  it("returns false for static asset requests", () => {
    const imageRequest = new Request("https://example.com/icon.png")
    Object.defineProperty(imageRequest, "destination", { value: "image" })

    const scriptRequest = new Request("https://example.com/_next/static/chunk.js")
    Object.defineProperty(scriptRequest, "destination", { value: "script" })

    expect(isNavigationOrRSCRequest(imageRequest)).toBe(false)
    expect(isNavigationOrRSCRequest(scriptRequest)).toBe(false)
  })
})
