import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"

// Hoist mocks
const { mockInterpret, mockFindByUserId, mockFindMany } = vi.hoisted(() => ({
  mockInterpret: vi.fn(),
  mockFindByUserId: vi.fn(),
  mockFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: mockFindMany,
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/infrastructure/persistence/provider/ProviderRepository", () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

vi.mock("@/domain/voice-log/VoiceInterpretationService", () => ({
  createVoiceInterpretationService: vi.fn().mockImplementation(() => ({
    interpret: mockInterpret,
  })),
  mapVoiceLogErrorToStatus: vi.fn().mockReturnValue(500),
}))

import { auth } from "@/lib/auth-server"

function makeRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/voice-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/voice-log", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockFindMany.mockResolvedValue([])
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const response = await POST(makeRequest({ transcript: "test" }))
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)

    const response = await POST(makeRequest({ transcript: "test" }))
    expect(response.status).toBe(403)
  })

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost:3000/api/voice-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 when transcript is missing", async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
  })

  it("returns interpretation result for valid request", async () => {
    const interpretation = {
      bookingId: "booking-1",
      customerName: "Anna Johansson",
      horseName: "Stella",
      markAsCompleted: true,
      workPerformed: "Verkade alla fyra",
      horseObservation: null,
      horseNoteCategory: null,
      nextVisitWeeks: 8,
      confidence: 0.9,
    }

    mockInterpret.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: interpretation,
    })

    mockFindMany.mockResolvedValue([
      {
        id: "booking-1",
        startTime: "09:00",
        status: "confirmed",
        horseName: "Stella",
        horseId: "horse-1",
        customer: { firstName: "Anna", lastName: "Johansson" },
        horse: { id: "horse-1", name: "Stella" },
        service: { name: "Hovvård" },
      },
    ])

    const response = await POST(makeRequest({ transcript: "Klar med Stella" }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.interpretation.bookingId).toBe("booking-1")
    expect(data.interpretation.confidence).toBe(0.9)
    expect(data.bookings).toHaveLength(1)
    expect(data.bookings[0].customerName).toBe("Anna Johansson")
  })

  it("returns error when interpretation fails", async () => {
    mockInterpret.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "INTERPRETATION_FAILED", message: "AI error" },
    })

    const response = await POST(makeRequest({ transcript: "test" }))
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe("AI error")
  })

  it("returns 404 when provider not found", async () => {
    mockFindByUserId.mockResolvedValue(null)

    const response = await POST(makeRequest({ transcript: "test" }))
    expect(response.status).toBe(404)
  })

  it("passes vocabulary prompt to interpretation service", async () => {
    const vocabJson = JSON.stringify({
      corrections: [{ from: "hovbeslag", to: "hovkapning", count: 3 }],
    })
    mockFindByUserId.mockResolvedValue({
      id: "provider-1",
      vocabularyTerms: vocabJson,
    })

    mockInterpret.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        bookingId: null,
        customerName: null,
        horseName: null,
        markAsCompleted: false,
        workPerformed: "Hovkapning",
        horseObservation: null,
        horseNoteCategory: null,
        nextVisitWeeks: null,
        confidence: 0.5,
      },
    })

    await POST(makeRequest({ transcript: "Gjorde hovbeslag" }))

    expect(mockInterpret).toHaveBeenCalledWith(
      "Gjorde hovbeslag",
      expect.any(Array),
      expect.stringContaining("hovbeslag")
    )
  })

  it("works when provider has no vocabulary", async () => {
    mockFindByUserId.mockResolvedValue({
      id: "provider-1",
      vocabularyTerms: null,
    })

    mockInterpret.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        bookingId: null,
        customerName: null,
        horseName: null,
        markAsCompleted: false,
        workPerformed: "Test",
        horseObservation: null,
        horseNoteCategory: null,
        nextVisitWeeks: null,
        confidence: 0.5,
      },
    })

    await POST(makeRequest({ transcript: "test" }))

    // Should be called without vocabulary (empty string = no vocab)
    expect(mockInterpret).toHaveBeenCalledWith(
      "test",
      expect.any(Array),
      ""
    )
  })
})
