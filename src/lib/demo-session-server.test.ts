import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGet = vi.fn()

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mockGet })),
}))

import { readDemoSession } from "./demo-session-server"

describe("readDemoSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when the demo cookie is exactly 'true'", async () => {
    mockGet.mockReturnValue({ value: "true" })
    await expect(readDemoSession()).resolves.toBe(true)
    expect(mockGet).toHaveBeenCalledWith("equinet-demo")
  })

  it("returns false when the cookie is absent", async () => {
    mockGet.mockReturnValue(undefined)
    await expect(readDemoSession()).resolves.toBe(false)
  })

  it("returns false for any value other than 'true'", async () => {
    mockGet.mockReturnValue({ value: "false" })
    await expect(readDemoSession()).resolves.toBe(false)
    mockGet.mockReturnValue({ value: "1" })
    await expect(readDemoSession()).resolves.toBe(false)
  })
})
