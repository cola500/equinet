import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  CustomerInsightService,
  mapInsightErrorToStatus,
  type CustomerDataContext,
  type CustomerMetrics,
} from "./CustomerInsightService"

// Hoist mock so it's available inside vi.mock factory
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

// Mock Anthropic SDK (class-based mock for `new` calls)
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate }
  }
  return { default: MockAnthropic }
})

const SAMPLE_DATA: CustomerDataContext = {
  bookings: [
    {
      bookingDate: "2026-01-15",
      startTime: "09:00",
      status: "completed",
      serviceName: "Hovvård",
      servicePrice: 1500,
      horseName: "Stella",
      providerNotes: "Verkade alla fyra",
      cancellationMessage: null,
    },
    {
      bookingDate: "2025-11-20",
      startTime: "10:00",
      status: "completed",
      serviceName: "Hovvård",
      servicePrice: 1500,
      horseName: "Stella",
      providerNotes: null,
      cancellationMessage: null,
    },
    {
      bookingDate: "2025-09-10",
      startTime: "09:00",
      status: "cancelled",
      serviceName: "Hovbeslag",
      servicePrice: 2500,
      horseName: "Blansen",
      providerNotes: null,
      cancellationMessage: "Hästen var sjuk",
    },
  ],
  notes: [
    { content: "Bra kund, betalar alltid i tid", createdAt: "2026-01-15" },
  ],
  reviews: [{ rating: 5, comment: "Bästa hovslagaren!" }],
  customerReviews: [{ rating: 4, comment: "Punktlig och trevlig" }],
  horses: [
    { name: "Stella", breed: "Islandshäst", specialNeeds: "Känsliga hovar" },
    { name: "Blansen", breed: "Svenskt halvblod", specialNeeds: null },
  ],
}

const SAMPLE_METRICS: CustomerMetrics = {
  totalBookings: 3,
  completedBookings: 2,
  cancelledBookings: 1,
  noShowBookings: 0,
  totalSpent: 3000,
  avgBookingIntervalDays: 56,
  lastBookingDate: "2026-01-15",
  firstBookingDate: "2025-09-10",
}

const VALID_LLM_RESPONSE = {
  frequency: "Regelbunden (var 8:e vecka)",
  topServices: ["Hovvård", "Hovbeslag"],
  patterns: ["Bokar alltid på förmiddagen"],
  riskFlags: ["1 avbokning senaste 6 månader"],
  vipScore: "medium",
  summary: "Regelbunden kund med två hästar. Bokar hovvård var 8:e vecka.",
  confidence: 0.85,
}

describe("CustomerInsightService", () => {
  let service: CustomerInsightService

  beforeEach(() => {
    mockCreate.mockReset()
    service = new CustomerInsightService({ apiKey: "test-key" })
  })

  it("returns NO_DATA error when completedBookings and noShowBookings are both 0", async () => {
    const emptyMetrics: CustomerMetrics = {
      ...SAMPLE_METRICS,
      completedBookings: 0,
      noShowBookings: 0,
    }

    const result = await service.generateInsight(SAMPLE_DATA, emptyMetrics)
    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("NO_DATA")
  })

  it("returns API_KEY_MISSING when no key", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const serviceNoKey = new CustomerInsightService({ apiKey: undefined })

    const result = await serviceNoKey.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("API_KEY_MISSING")

    process.env.ANTHROPIC_API_KEY = originalKey
  })

  it("calls Anthropic with customer context and metrics", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(VALID_LLM_RESPONSE) }],
    })

    await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    const userMessage = callArgs.messages[0].content

    // Verify context includes key data
    expect(userMessage).toContain("Hovvård")
    expect(userMessage).toContain("Stella")
    expect(userMessage).toContain("3000") // totalSpent
    expect(userMessage).toContain("56") // avgBookingIntervalDays
  })

  it("parses valid LLM response correctly", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(VALID_LLM_RESPONSE) }],
    })

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)

    expect(result.isSuccess).toBe(true)
    expect(result.value.frequency).toBe("Regelbunden (var 8:e vecka)")
    expect(result.value.topServices).toEqual(["Hovvård", "Hovbeslag"])
    expect(result.value.patterns).toEqual(["Bokar alltid på förmiddagen"])
    expect(result.value.riskFlags).toEqual(["1 avbokning senaste 6 månader"])
    expect(result.value.vipScore).toBe("medium")
    expect(result.value.summary).toContain("Regelbunden kund")
    expect(result.value.confidence).toBe(0.85)
  })

  it("sends system prompt with cache_control for prompt caching", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(VALID_LLM_RESPONSE) }],
    })

    await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.system).toEqual([
      expect.objectContaining({
        type: "text",
        cache_control: { type: "ephemeral" },
      }),
    ])
    expect(callArgs.system[0].text).toContain("Du är en dataanalytiker")
  })

  it("handles markdown code block wrapping", async () => {
    const json = JSON.stringify(VALID_LLM_RESPONSE)

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "```json\n" + json + "\n```" }],
    })

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isSuccess).toBe(true)
    expect(result.value.frequency).toBe("Regelbunden (var 8:e vecka)")
  })

  it("handles invalid JSON from LLM", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is not JSON at all" }],
    })

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("INTERPRETATION_FAILED")
  })

  it("handles API error gracefully", async () => {
    mockCreate.mockRejectedValue(new Error("API quota exceeded"))

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("INTERPRETATION_FAILED")
    expect(result.error.message).toContain("API quota exceeded")
  })

  it("clamps confidence to 0-1", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...VALID_LLM_RESPONSE, confidence: 5.0 }),
        },
      ],
    })

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isSuccess).toBe(true)
    expect(result.value.confidence).toBeLessThanOrEqual(1)
  })

  it("limits arrays to max 3 items via Zod transform", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...VALID_LLM_RESPONSE,
            topServices: ["A", "B", "C", "D", "E"],
            patterns: ["1", "2", "3", "4"],
            riskFlags: ["x", "y", "z", "w"],
          }),
        },
      ],
    })

    const result = await service.generateInsight(SAMPLE_DATA, SAMPLE_METRICS)
    expect(result.isSuccess).toBe(true)
    expect(result.value.topServices).toHaveLength(3)
    expect(result.value.patterns).toHaveLength(3)
    expect(result.value.riskFlags).toHaveLength(3)
  })

  it("handles customer with only cancelled bookings (but completedBookings > 0 from metrics)", async () => {
    const cancelledOnlyData: CustomerDataContext = {
      ...SAMPLE_DATA,
      bookings: SAMPLE_DATA.bookings.filter((b) => b.status === "cancelled"),
    }

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...VALID_LLM_RESPONSE,
            riskFlags: ["Hög avbokningsfrekvens"],
            vipScore: "low",
          }),
        },
      ],
    })

    // Even though all visible bookings are cancelled, metrics say completed > 0
    const result = await service.generateInsight(cancelledOnlyData, {
      ...SAMPLE_METRICS,
      completedBookings: 1,
    })
    expect(result.isSuccess).toBe(true)
    expect(result.value.vipScore).toBe("low")
  })

  describe("mapInsightErrorToStatus", () => {
    it("maps NO_DATA to 400", () => {
      expect(mapInsightErrorToStatus({ type: "NO_DATA", message: "" })).toBe(400)
    })

    it("maps API_KEY_MISSING to 503", () => {
      expect(mapInsightErrorToStatus({ type: "API_KEY_MISSING", message: "" })).toBe(503)
    })

    it("maps INTERPRETATION_FAILED to 500", () => {
      expect(mapInsightErrorToStatus({ type: "INTERPRETATION_FAILED", message: "" })).toBe(500)
    })
  })
})
