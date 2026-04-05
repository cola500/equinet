import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFlagsFromEdgeConfig, syncFlagsToEdgeConfig } from "./edge-config"

vi.mock("@vercel/edge-config", () => ({
  get: vi.fn(),
}))

vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}))

import { get } from "@vercel/edge-config"
import { logger } from "./logger"

const mockGet = vi.mocked(get)
const mockLoggerWarn = vi.mocked(logger.warn)

describe("readFlagsFromEdgeConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.EDGE_CONFIG
  })

  it("returns flags when Edge Config works", async () => {
    process.env.EDGE_CONFIG = "ecfg_test123"
    const flags = { feature_a: true, feature_b: false }
    mockGet.mockResolvedValueOnce(flags)

    const result = await readFlagsFromEdgeConfig()

    expect(result).toEqual(flags)
    expect(mockGet).toHaveBeenCalledWith("feature_flags")
  })

  it("returns null when EDGE_CONFIG env missing", async () => {
    delete process.env.EDGE_CONFIG

    const result = await readFlagsFromEdgeConfig()

    expect(result).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it("returns null when Edge Config returns undefined", async () => {
    process.env.EDGE_CONFIG = "ecfg_test123"
    mockGet.mockResolvedValueOnce(undefined)

    const result = await readFlagsFromEdgeConfig()

    expect(result).toBeNull()
  })

  it("returns null on Edge Config error", async () => {
    process.env.EDGE_CONFIG = "ecfg_test123"
    mockGet.mockRejectedValueOnce(new Error("Connection failed"))

    const result = await readFlagsFromEdgeConfig()

    expect(result).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Failed to read feature flags from Edge Config, falling back to DB",
      expect.objectContaining({ error: "Connection failed" })
    )
  })
})

describe("syncFlagsToEdgeConfig", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.EDGE_CONFIG_ID
    delete process.env.VERCEL_API_TOKEN
  })

  it("sends flags to Vercel REST API correctly", async () => {
    process.env.EDGE_CONFIG_ID = "ecfg_abc123"
    process.env.VERCEL_API_TOKEN = "vercel_token_xyz"
    const flags = { feature_a: true, feature_b: false }

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await syncFlagsToEdgeConfig(flags)

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.vercel.com/v1/edge-config/ecfg_abc123/items",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer vercel_token_xyz",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "upsert", key: "feature_flags", value: flags }],
        }),
      }
    )
  })

  it("skips silently when EDGE_CONFIG_ID missing", async () => {
    delete process.env.EDGE_CONFIG_ID
    process.env.VERCEL_API_TOKEN = "vercel_token_xyz"

    await syncFlagsToEdgeConfig({ feature_a: true })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("skips silently when VERCEL_API_TOKEN missing", async () => {
    process.env.EDGE_CONFIG_ID = "ecfg_abc123"
    delete process.env.VERCEL_API_TOKEN

    await syncFlagsToEdgeConfig({ feature_a: true })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("logs error but does not throw on API failure", async () => {
    process.env.EDGE_CONFIG_ID = "ecfg_abc123"
    process.env.VERCEL_API_TOKEN = "vercel_token_xyz"

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(syncFlagsToEdgeConfig({ feature_a: true })).resolves.not.toThrow()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Edge Config sync failed",
      expect.objectContaining({ status: 500, edgeConfigId: "ecfg_abc123" })
    )
  })
})
