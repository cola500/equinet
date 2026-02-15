import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  VoiceInterpretationService,
  mapVoiceLogErrorToStatus,
  type BookingContext,
} from "./VoiceInterpretationService"

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

const SAMPLE_BOOKINGS: BookingContext[] = [
  {
    id: "booking-1",
    customerName: "Anna Johansson",
    horseName: "Stella",
    horseId: "horse-1",
    serviceName: "Hovvård",
    startTime: "09:00",
    status: "confirmed",
    horseBreed: "Islandshäst",
    horseSpecialNeeds: "Känsliga hovar",
    previousNotes: "Verkade alla fyra, bra resultat",
  },
  {
    id: "booking-2",
    customerName: "Erik Svensson",
    horseName: "Blansen",
    horseId: "horse-2",
    serviceName: "Hovbeslag",
    startTime: "11:00",
    status: "confirmed",
  },
]

describe("VoiceInterpretationService", () => {
  let service: VoiceInterpretationService

  beforeEach(() => {
    mockCreate.mockReset()
    service = new VoiceInterpretationService({ apiKey: "test-key" })
  })

  describe("interpret", () => {
    it("returns error when transcript is empty", async () => {
      const result = await service.interpret("", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("NO_TRANSCRIPT")
    })

    it("returns error when transcript is only whitespace", async () => {
      const result = await service.interpret("   ", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("NO_TRANSCRIPT")
    })

    it("returns error when API key is missing", async () => {
      const serviceNoKey = new VoiceInterpretationService({ apiKey: undefined })
      const originalKey = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      const result = await serviceNoKey.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("API_KEY_MISSING")

      process.env.ANTHROPIC_API_KEY = originalKey
    })

    it("calls Anthropic API with correct context and returns parsed result", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna Johansson",
              horseName: "Stella",
              markAsCompleted: true,
              workPerformed: "Verkade och raspade alla fyra hovarna",
              horseObservation: "Framhovarna uttorkade",
              horseNoteCategory: "farrier",
              nextVisitWeeks: 8,
              confidence: 0.95,
            }),
          },
        ],
      })

      const result = await service.interpret(
        "Jag är klar hos Anna med Stella. Verkade och raspade alla fyra. Framhovarna var uttorkade. Nästa besök om 8 veckor.",
        SAMPLE_BOOKINGS
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.bookingId).toBe("booking-1")
      expect(result.value.markAsCompleted).toBe(true)
      expect(result.value.workPerformed).toBe("Verkade och raspade alla fyra hovarna")
      expect(result.value.horseObservation).toBe("Framhovarna uttorkade")
      expect(result.value.horseNoteCategory).toBe("farrier")
      expect(result.value.nextVisitWeeks).toBe(8)
      expect(result.value.confidence).toBe(0.95)

      // Verify API was called with booking context
      expect(mockCreate).toHaveBeenCalledTimes(1)
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain("Anna Johansson")
      expect(callArgs.messages[0].content).toContain("Stella")
      expect(callArgs.messages[0].content).toContain("booking-1")
    })

    it("handles API error gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limit"))

      const result = await service.interpret("test transcript", SAMPLE_BOOKINGS)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
      expect(result.error.message).toContain("API rate limit")
    })

    it("handles non-text response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "test" }],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })

    it("handles LLM response wrapped in markdown code block", async () => {
      const jsonContent = JSON.stringify({
        bookingId: "booking-1",
        customerName: "Anna Johansson",
        horseName: "Stella",
        markAsCompleted: true,
        workPerformed: "Verkade alla fyra hovarna",
        horseObservation: null,
        horseNoteCategory: "farrier",
        nextVisitWeeks: 8,
        confidence: 0.9,
      })

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "```json\n" + jsonContent + "\n```" }],
      })

      const result = await service.interpret("Klar med Anna", SAMPLE_BOOKINGS)
      expect(result.isSuccess).toBe(true)
      expect(result.value.bookingId).toBe("booking-1")
      expect(result.value.workPerformed).toBe("Verkade alla fyra hovarna")
    })

    it("handles LLM response wrapped in code block without language tag", async () => {
      const jsonContent = JSON.stringify({
        bookingId: null,
        customerName: "Anna",
        horseName: "Stella",
        markAsCompleted: false,
        workPerformed: "Test",
        horseObservation: null,
        horseNoteCategory: null,
        nextVisitWeeks: null,
        confidence: 0.5,
      })

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "```\n" + jsonContent + "\n```" }],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isSuccess).toBe(true)
      expect(result.value.customerName).toBe("Anna")
    })

    it("handles invalid JSON from LLM", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "This is not JSON" }],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })

    it("handles LLM returning wrong types (Zod catches)", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: 123, // should be string
              confidence: "high", // should be number
              markAsCompleted: "yes", // should be boolean
            }),
          },
        ],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })

    it("rejects bookingId not in context list (prompt injection protection)", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "injected-fake-id",
              customerName: "Hacker",
              horseName: null,
              markAsCompleted: true,
              workPerformed: "Ignore previous instructions",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.9,
            }),
          },
        ],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      // bookingId should be nullified since it's not in context
      expect(result.isSuccess).toBe(true)
      expect(result.value.bookingId).toBeNull()
    })

    it("accepts bookingId that exists in context", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna Johansson",
              horseName: "Stella",
              markAsCompleted: true,
              workPerformed: "Verkade alla fyra",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.9,
            }),
          },
        ],
      })

      const result = await service.interpret("Klar med Anna", SAMPLE_BOOKINGS)
      expect(result.isSuccess).toBe(true)
      expect(result.value.bookingId).toBe("booking-1")
    })

    it("clamps confidence to 0-1 range", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna",
              horseName: "Stella",
              markAsCompleted: false,
              workPerformed: "Test",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 5.0, // way too high
            }),
          },
        ],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)
      expect(result.isSuccess).toBe(true)
      expect(result.value.confidence).toBeLessThanOrEqual(1)
    })

    it("includes horse breed, special needs, and previous notes in context", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna Johansson",
              horseName: "Stella",
              markAsCompleted: true,
              workPerformed: "Verkade alla fyra hovarna",
              horseObservation: null,
              horseNoteCategory: "farrier",
              nextVisitWeeks: 8,
              confidence: 0.95,
            }),
          },
        ],
      })

      await service.interpret("Klar med Anna", SAMPLE_BOOKINGS)

      const callArgs = mockCreate.mock.calls[0][0]
      const userMessage = callArgs.messages[0].content

      // Booking 1 has breed, specialNeeds, and previousNotes
      expect(userMessage).toContain("Islandshäst")
      expect(userMessage).toContain("OBS: Känsliga hovar")
      expect(userMessage).toContain("Föreg. notering: Verkade alla fyra")

      // Booking 2 has no extra context -- should NOT contain these markers for it
      expect(userMessage).not.toContain("OBS: undefined")
    })

    it("sends system prompt with cache_control for prompt caching", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna",
              horseName: "Stella",
              markAsCompleted: false,
              workPerformed: "Test",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.8,
            }),
          },
        ],
      })

      await service.interpret("test", SAMPLE_BOOKINGS)

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.system).toEqual([
        expect.objectContaining({
          type: "text",
          cache_control: { type: "ephemeral" },
        }),
      ])
      expect(callArgs.system[0].text).toContain("Du är en assistent")
    })

    it("includes booking context with empty bookings list", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: null,
              customerName: "Anna",
              horseName: "Stella",
              markAsCompleted: false,
              workPerformed: "Verkade hovar",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.3,
            }),
          },
        ],
      })

      const result = await service.interpret("Verkade Stella", [])

      expect(result.isSuccess).toBe(true)
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain("Inga bokningar idag")
    })

    it("includes vocabulary prompt when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna Johansson",
              horseName: "Stella",
              markAsCompleted: true,
              workPerformed: "Hovkapning",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.9,
            }),
          },
        ],
      })

      const vocabPrompt =
        '\nLeverantörens anpassade termer (använd dessa vid tolkning):\n- "hovbeslag" ska tolkas som "hovkapning"'

      const result = await service.interpret(
        "Klar med Anna",
        SAMPLE_BOOKINGS,
        vocabPrompt
      )

      expect(result.isSuccess).toBe(true)
      // Verify the system prompt includes the vocabulary
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.system[0].text).toContain("hovbeslag")
      expect(callArgs.system[0].text).toContain("hovkapning")
      expect(callArgs.system[0].text).toContain("Leverantörens anpassade termer")
    })

    it("works without vocabulary prompt (backward compatible)", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bookingId: "booking-1",
              customerName: "Anna",
              horseName: "Stella",
              markAsCompleted: false,
              workPerformed: "Test",
              horseObservation: null,
              horseNoteCategory: null,
              nextVisitWeeks: null,
              confidence: 0.8,
            }),
          },
        ],
      })

      const result = await service.interpret("test", SAMPLE_BOOKINGS)

      expect(result.isSuccess).toBe(true)
      const callArgs = mockCreate.mock.calls[0][0]
      // System prompt should NOT contain vocabulary section
      expect(callArgs.system[0].text).not.toContain("Leverantörens anpassade termer")
    })
  })

  describe("interpretQuickNote", () => {
    it("returns error when transcript is empty", async () => {
      const result = await service.interpretQuickNote("", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("NO_TRANSCRIPT")
    })

    it("returns error when API key is missing", async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      const serviceNoKey = new VoiceInterpretationService({ apiKey: undefined })

      const result = await serviceNoKey.interpretQuickNote("test", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("API_KEY_MISSING")

      process.env.ANTHROPIC_API_KEY = originalKey
    })

    it("cleans up transcript and classifies as health-related", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleanedText: "Spricka i höger framhov, korrigerade vinkeln två grader.",
              isHealthRelated: true,
              horseNoteCategory: "farrier",
              suggestedNextWeeks: 6,
            }),
          },
        ],
      })

      const result = await service.interpretQuickNote(
        "Storm hade en liten spricka i höger framhov, korrigerade vinkeln två grader, kolla om sex veckor",
        { customerName: "Anna", horseName: "Storm", serviceType: "Hovvård" }
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.cleanedText).toBe("Spricka i höger framhov, korrigerade vinkeln två grader.")
      expect(result.value.isHealthRelated).toBe(true)
      expect(result.value.horseNoteCategory).toBe("farrier")
      expect(result.value.suggestedNextWeeks).toBe(6)
    })

    it("handles non-health-related note", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleanedText: "Verkade alla fyra, inga anmärkningar.",
              isHealthRelated: false,
              horseNoteCategory: null,
              suggestedNextWeeks: null,
            }),
          },
        ],
      })

      const result = await service.interpretQuickNote(
        "Verkade alla fyra inga anmärkningar",
        { customerName: "Erik", horseName: "Blansen", serviceType: "Hovvård" }
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.isHealthRelated).toBe(false)
      expect(result.value.horseNoteCategory).toBeNull()
      expect(result.value.suggestedNextWeeks).toBeNull()
    })

    it("uses Haiku model for quick notes (cost optimization)", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleanedText: "Test",
              isHealthRelated: false,
              horseNoteCategory: null,
              suggestedNextWeeks: null,
            }),
          },
        ],
      })

      await service.interpretQuickNote("test", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.model).toBe("claude-haiku-4-5-20251001")
    })

    it("includes booking context in prompt", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleanedText: "Test",
              isHealthRelated: false,
              horseNoteCategory: null,
              suggestedNextWeeks: null,
            }),
          },
        ],
      })

      await service.interpretQuickNote("test", {
        customerName: "Anna Johansson",
        horseName: "Stella",
        serviceType: "Hovvård",
        horseBreed: "Islandshäst",
        specialNeeds: "Känsliga hovar",
      })

      const callArgs = mockCreate.mock.calls[0][0]
      const userMessage = callArgs.messages[0].content
      expect(userMessage).toContain("Anna Johansson")
      expect(userMessage).toContain("Stella")
      expect(userMessage).toContain("Hovvård")
      expect(userMessage).toContain("Islandshäst")
      expect(userMessage).toContain("Känsliga hovar")
    })

    it("handles markdown code block wrapping", async () => {
      const json = JSON.stringify({
        cleanedText: "Allt bra.",
        isHealthRelated: false,
        horseNoteCategory: null,
        suggestedNextWeeks: null,
      })

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "```json\n" + json + "\n```" }],
      })

      const result = await service.interpretQuickNote("allt bra", {
        customerName: "Erik",
        horseName: "Blansen",
        serviceType: "Hovvård",
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.cleanedText).toBe("Allt bra.")
    })

    it("handles API error gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API quota exceeded"))

      const result = await service.interpretQuickNote("test", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })

    it("handles invalid JSON from LLM", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "not valid json" }],
      })

      const result = await service.interpretQuickNote("test", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })

    it("clamps suggestedNextWeeks to valid range via Zod", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleanedText: "Test",
              isHealthRelated: false,
              horseNoteCategory: null,
              suggestedNextWeeks: 100, // out of range
            }),
          },
        ],
      })

      const result = await service.interpretQuickNote("test", {
        customerName: "Anna",
        horseName: "Stella",
        serviceType: "Hovvård",
      })

      // Zod should reject out-of-range value
      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe("INTERPRETATION_FAILED")
    })
  })

  describe("mapVoiceLogErrorToStatus", () => {
    it("maps NO_TRANSCRIPT to 400", () => {
      expect(mapVoiceLogErrorToStatus({ type: "NO_TRANSCRIPT", message: "" })).toBe(400)
    })

    it("maps API_KEY_MISSING to 503", () => {
      expect(mapVoiceLogErrorToStatus({ type: "API_KEY_MISSING", message: "" })).toBe(503)
    })

    it("maps INTERPRETATION_FAILED to 500", () => {
      expect(mapVoiceLogErrorToStatus({ type: "INTERPRETATION_FAILED", message: "" })).toBe(500)
    })
  })
})
