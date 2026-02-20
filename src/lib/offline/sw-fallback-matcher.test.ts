import { describe, it, expect } from "vitest"
import { isDocumentNavigationRequest } from "./sw-fallback-matcher"

describe("isDocumentNavigationRequest", () => {
  it("returns true for document requests (hard navigation)", () => {
    const request = new Request("https://example.com/provider/dashboard")
    Object.defineProperty(request, "destination", { value: "document" })

    expect(isDocumentNavigationRequest(request)).toBe(true)
  })

  it("returns false for RSC requests (must NOT serve HTML fallback for RSC)", () => {
    const request = new Request("https://example.com/provider/bookings", {
      headers: { RSC: "1" },
    })

    expect(isDocumentNavigationRequest(request)).toBe(false)
  })

  it("returns false for RSC prefetch requests", () => {
    const request = new Request("https://example.com/provider/routes", {
      headers: {
        RSC: "1",
        "Next-Router-Prefetch": "1",
      },
    })

    expect(isDocumentNavigationRequest(request)).toBe(false)
  })

  it("returns false for API requests", () => {
    const request = new Request("https://example.com/api/bookings")

    expect(isDocumentNavigationRequest(request)).toBe(false)
  })

  it("returns false for static asset requests", () => {
    const imageRequest = new Request("https://example.com/icon.png")
    Object.defineProperty(imageRequest, "destination", { value: "image" })

    const scriptRequest = new Request("https://example.com/_next/static/chunk.js")
    Object.defineProperty(scriptRequest, "destination", { value: "script" })

    expect(isDocumentNavigationRequest(imageRequest)).toBe(false)
    expect(isDocumentNavigationRequest(scriptRequest)).toBe(false)
  })
})
