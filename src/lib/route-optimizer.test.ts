import { describe, it, expect, beforeEach, vi } from "vitest"

import { optimizeRoute } from "./route-optimizer"

const start = { lat: 59.27, lon: 15.21 }
const orders = [
  { lat: 59.61, lon: 16.55 },
  { lat: 59.13, lon: 15.14 },
]

describe("optimizeRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("posts the optimizer contract and returns the result", async () => {
    const result = { route: [1, 0], total_distance_km: 200, num_stops: 2, baseline_distance_km: 220, improvement_percent: 9.1 }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) })

    await expect(optimizeRoute(start, orders)).resolves.toEqual(result)

    const [url, init] = vi.mocked(global.fetch).mock.calls[0]
    expect(url).toBe("/api/optimize-route")
    expect(JSON.parse(String(init?.body))).toEqual({ start_location: start, orders })
  })

  it("throws the API's Swedish error message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Optimering misslyckades" }),
    })

    await expect(optimizeRoute(start, orders)).rejects.toThrow("Optimering misslyckades")
  })

  it("shows the specific validation message instead of the generic one", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: "Valideringsfel",
        details: [{ message: "Högst 100 beställningar per optimering" }],
      }),
    })

    await expect(optimizeRoute(start, orders)).rejects.toThrow("Högst 100 beställningar per optimering")
  })

  it("falls back to a Swedish message when the error body is not JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    })

    await expect(optimizeRoute(start, orders)).rejects.toThrow("Optimering misslyckades")
  })
})
