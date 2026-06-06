import { describe, it, expect } from "vitest"
import { stripeMatcher } from "./sw-matchers"

/** Helper: build the matcher arg shape Serwist passes (only `url` is used here). */
function arg(href: string) {
  return { url: new URL(href) }
}

describe("stripeMatcher", () => {
  it("matches the Stripe.js CDN script", () => {
    expect(stripeMatcher(arg("https://js.stripe.com/dahlia/stripe.js"))).toBe(true)
  })

  it("matches the Stripe API origin", () => {
    expect(stripeMatcher(arg("https://api.stripe.com/v1/payment_intents"))).toBe(true)
  })

  it("matches Stripe 3DS/hooks subdomain", () => {
    expect(stripeMatcher(arg("https://hooks.stripe.com/3d_secure/authenticate"))).toBe(true)
  })

  it("matches the stripe.network telemetry/iframe host", () => {
    expect(stripeMatcher(arg("https://m.stripe.network/inner.html"))).toBe(true)
  })

  it("matches the apex stripe.com", () => {
    expect(stripeMatcher(arg("https://stripe.com/"))).toBe(true)
  })

  it("does NOT match the app's own origin", () => {
    expect(stripeMatcher(arg("https://equinet-staging.johanlindengard.com/customer/bookings"))).toBe(false)
  })

  it("does NOT match Supabase", () => {
    expect(stripeMatcher(arg("https://zzdamokfeenencuggjjp.supabase.co/storage/v1/object/x.png"))).toBe(false)
  })

  it("does NOT match a look-alike domain (suffix spoofing)", () => {
    expect(stripeMatcher(arg("https://evilstripe.com/x.js"))).toBe(false)
    expect(stripeMatcher(arg("https://notstripe.network/x"))).toBe(false)
  })
})
