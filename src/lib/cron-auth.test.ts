import { describe, it, expect } from "vitest"
import { createHmac } from "crypto"
import { verifyCronAuth } from "./cron-auth"

const SECRET = "test-cron-secret"

describe("verifyCronAuth", () => {
  it("rejects when cronSecret is undefined", () => {
    const result = verifyCronAuth(`Bearer ${SECRET}`, undefined)
    expect(result).toEqual({ ok: false, status: 401 })
  })

  it("rejects when authHeader is missing", () => {
    const result = verifyCronAuth(null, SECRET)
    expect(result).toEqual({ ok: false, status: 401 })
  })

  it("rejects when Bearer token does not match", () => {
    const result = verifyCronAuth("Bearer wrong-secret", SECRET)
    expect(result).toEqual({ ok: false, status: 401 })
  })

  it("accepts valid Bearer token without signature (GET request)", () => {
    const result = verifyCronAuth(`Bearer ${SECRET}`, SECRET)
    expect(result).toEqual({ ok: true })
  })

  it("accepts valid Bearer token + valid HMAC signature", () => {
    const body = '{"key":"value"}'
    const signature = createHmac("sha256", SECRET).update(body).digest("hex")

    const result = verifyCronAuth(`Bearer ${SECRET}`, SECRET, signature, body)
    expect(result).toEqual({ ok: true })
  })

  it("rejects valid Bearer token + invalid HMAC signature", () => {
    const body = '{"key":"value"}'
    const result = verifyCronAuth(`Bearer ${SECRET}`, SECRET, "bad-signature", body)
    expect(result).toEqual({ ok: false, status: 401 })
  })

  it("skips signature check when signatureHeader is null", () => {
    const result = verifyCronAuth(`Bearer ${SECRET}`, SECRET, null, "body")
    expect(result).toEqual({ ok: true })
  })

  it("skips signature check when body is undefined", () => {
    const result = verifyCronAuth(`Bearer ${SECRET}`, SECRET, "some-sig")
    expect(result).toEqual({ ok: true })
  })
})
