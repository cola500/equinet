import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"

// Hoist mocks
const {
  mockFindByUserId,
  mockUpdateProviderNotesWithAuth,
  mockUpdateStatus,
  mockBookingFindUnique,
  mockHorseNoteCreate,
  mockProviderUpdate,
} = vi.hoisted(() => ({
  mockFindByUserId: vi.fn(),
  mockUpdateProviderNotesWithAuth: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockBookingFindUnique: vi.fn(),
  mockHorseNoteCreate: vi.fn(),
  mockProviderUpdate: vi.fn(),
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: mockBookingFindUnique,
    },
    horseNote: {
      create: mockHorseNoteCreate,
    },
    provider: {
      update: mockProviderUpdate,
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/infrastructure/persistence/provider/ProviderRepository", () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

vi.mock("@/infrastructure/persistence/booking/PrismaBookingRepository", () => ({
  PrismaBookingRepository: class {
    updateProviderNotesWithAuth = mockUpdateProviderNotesWithAuth
  },
}))

vi.mock("@/domain/booking", () => ({
  createBookingService: vi.fn().mockImplementation(() => ({
    updateStatus: mockUpdateStatus,
  })),
  mapBookingErrorToStatus: vi.fn().mockReturnValue(500),
  mapBookingErrorToMessage: vi.fn().mockReturnValue("Booking error"),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const VALID_BOOKING_ID = "a0000000-0000-4000-a000-000000000001"

function makeRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/voice-log/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: VALID_BOOKING_ID,
    markAsCompleted: false,
    workPerformed: "Verkade alla fyra",
    horseObservation: null,
    horseNoteCategory: null,
    nextVisitWeeks: null,
    ...overrides,
  }
}

describe("POST /api/voice-log/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      id: VALID_BOOKING_ID,
      providerNotes: "Verkade alla fyra",
      horseId: "horse-1",
    })
    mockUpdateStatus.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
    })
  })

  // --- Feature flag ---

  it("returns 404 when voice_logging feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/voice-log/confirm", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("voice_logging")
  })

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const response = await POST(makeRequest(validBody()))
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)

    const response = await POST(makeRequest(validBody()))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false)

    const response = await POST(makeRequest(validBody()))
    expect(response.status).toBe(429)
  })

  // --- Validation ---

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost:3000/api/voice-log/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 when bookingId is missing", async () => {
    const response = await POST(makeRequest({ markAsCompleted: false }))
    expect(response.status).toBe(400)
  })

  it("returns 400 when bookingId is not a UUID", async () => {
    const response = await POST(makeRequest(validBody({ bookingId: "not-a-uuid" })))
    expect(response.status).toBe(400)
  })

  it("returns 400 for extra fields (.strict())", async () => {
    const response = await POST(
      makeRequest(validBody({ unexpectedField: "hacker" }))
    )
    expect(response.status).toBe(400)
  })

  // --- Provider not found ---

  it("returns 404 when provider not found", async () => {
    mockFindByUserId.mockResolvedValue(null)

    const response = await POST(makeRequest(validBody()))
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Leverantör hittades inte")
  })

  // --- Successful save ---

  it("saves provider notes and returns success", async () => {
    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.actions).toContain("providerNotes")

    expect(mockUpdateProviderNotesWithAuth).toHaveBeenCalledWith(
      VALID_BOOKING_ID,
      "Verkade alla fyra",
      "provider-1"
    )
  })

  it("marks booking as completed when requested", async () => {
    const response = await POST(
      makeRequest(validBody({ markAsCompleted: true }))
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).toContain("providerNotes")
    expect(data.actions).toContain("completed")

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      bookingId: VALID_BOOKING_ID,
      newStatus: "completed",
      providerId: "provider-1",
    })
  })

  it("handles status update failure gracefully (notes still saved)", async () => {
    mockUpdateStatus.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "INVALID_STATUS_TRANSITION", message: "Cannot complete" },
    })

    const response = await POST(
      makeRequest(validBody({ markAsCompleted: true }))
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).toContain("providerNotes")
    expect(data.actions).not.toContain("completed")
  })

  it("returns 404 when booking not found or unauthorized", async () => {
    mockUpdateProviderNotesWithAuth.mockResolvedValue(null)

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Bokningen hittades inte eller åtkomst nekad")
  })

  // --- Horse notes ---

  it("creates horse note when observation provided", async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: VALID_BOOKING_ID,
      horseId: "horse-1",
      horseName: "Stella",
      providerId: "provider-1",
    })

    const response = await POST(
      makeRequest(
        validBody({
          horseObservation: "Hovarna uttorkade",
          horseNoteCategory: "farrier",
        })
      )
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).toContain("horseNote")

    expect(mockHorseNoteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        horseId: "horse-1",
        authorId: "user-1",
        category: "farrier",
        content: "Hovarna uttorkade",
      }),
    })
  })

  it("skips horse note when no horseId on booking", async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: VALID_BOOKING_ID,
      horseId: null,
      horseName: "Stella",
      providerId: "provider-1",
    })

    const response = await POST(
      makeRequest(
        validBody({
          horseObservation: "Hovarna uttorkade",
          horseNoteCategory: "farrier",
        })
      )
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).not.toContain("horseNote")
    expect(mockHorseNoteCreate).not.toHaveBeenCalled()
  })

  it("verifies booking ownership before creating horse note", async () => {
    // Booking belongs to different provider
    mockBookingFindUnique.mockResolvedValue({
      id: VALID_BOOKING_ID,
      horseId: "horse-1",
      horseName: "Stella",
      providerId: "other-provider",
    })

    const response = await POST(
      makeRequest(
        validBody({
          horseObservation: "Hovarna uttorkade",
          horseNoteCategory: "farrier",
        })
      )
    )

    expect(response.status).toBe(200)
    // Should NOT create horse note since provider doesn't match
    expect(mockHorseNoteCreate).not.toHaveBeenCalled()
  })

  // --- NextVisitWeeks in response ---

  it("returns nextVisitWeeks in response", async () => {
    const response = await POST(
      makeRequest(validBody({ nextVisitWeeks: 8 }))
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.nextVisitWeeks).toBe(8)
  })

  // --- No workPerformed ---

  it("skips provider notes update when workPerformed is null", async () => {
    const response = await POST(
      makeRequest(validBody({ workPerformed: null }))
    )

    expect(response.status).toBe(200)
    expect(mockUpdateProviderNotesWithAuth).not.toHaveBeenCalled()
  })

  // --- Vocabulary learning ---

  it("saves vocabulary correction when workPerformed is edited", async () => {
    mockFindByUserId.mockResolvedValue({
      id: "provider-1",
      vocabularyTerms: null,
    })

    const response = await POST(
      makeRequest(
        validBody({
          workPerformed: "Hovkapning på alla fyra",
          originalWorkPerformed: "Hovbeslag på alla fyra",
        })
      )
    )

    expect(response.status).toBe(200)
    expect(mockProviderUpdate).toHaveBeenCalledWith({
      where: { id: "provider-1" },
      data: {
        vocabularyTerms: expect.stringContaining("Hovbeslag"),
      },
    })
  })

  it("does not save vocabulary when no original data provided", async () => {
    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(200)
    expect(mockProviderUpdate).not.toHaveBeenCalled()
  })

  it("does not save vocabulary when text is unchanged", async () => {
    const response = await POST(
      makeRequest(
        validBody({
          workPerformed: "Verkade alla fyra",
          originalWorkPerformed: "Verkade alla fyra",
        })
      )
    )

    expect(response.status).toBe(200)
    expect(mockProviderUpdate).not.toHaveBeenCalled()
  })

  it("increases count for existing vocabulary correction", async () => {
    const existingVocab = JSON.stringify({
      corrections: [{ from: "Hovbeslag", to: "Hovkapning", count: 2 }],
    })
    mockFindByUserId.mockResolvedValue({
      id: "provider-1",
      vocabularyTerms: existingVocab,
    })

    const response = await POST(
      makeRequest(
        validBody({
          workPerformed: "Hovkapning på alla fyra",
          originalWorkPerformed: "Hovbeslag på alla fyra",
        })
      )
    )

    expect(response.status).toBe(200)
    expect(mockProviderUpdate).toHaveBeenCalled()
    const updateCall = mockProviderUpdate.mock.calls[0][0]
    const savedVocab = JSON.parse(updateCall.data.vocabularyTerms)
    const correction = savedVocab.corrections.find(
      (c: any) => c.from === "Hovbeslag"
    )
    expect(correction.count).toBe(3)
  })
})
