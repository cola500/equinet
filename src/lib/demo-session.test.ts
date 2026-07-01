import { describe, it, expect, beforeEach } from "vitest"
import {
  DEMO_SESSION_COOKIE,
  setDemoSessionCookie,
  clearDemoSessionCookie,
} from "./demo-session"

function readRawCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1]
}

describe("demo-session cookie helpers", () => {
  beforeEach(() => {
    // Reset the jsdom cookie jar between tests.
    clearDemoSessionCookie()
  })

  it("setDemoSessionCookie writes equinet-demo=true", () => {
    setDemoSessionCookie()
    expect(readRawCookie(DEMO_SESSION_COOKIE)).toBe("true")
  })

  it("clearDemoSessionCookie removes the cookie", () => {
    setDemoSessionCookie()
    expect(readRawCookie(DEMO_SESSION_COOKIE)).toBe("true")

    clearDemoSessionCookie()
    expect(readRawCookie(DEMO_SESSION_COOKIE)).toBeUndefined()
  })

  it("exposes a stable cookie name", () => {
    expect(DEMO_SESSION_COOKIE).toBe("equinet-demo")
  })
})
