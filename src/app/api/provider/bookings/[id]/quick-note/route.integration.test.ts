/**
 * Integration test: quick-note route uses BookingRepository.findByIdForProvider()
 * instead of direct prisma.booking.findUnique() for ownership verification.
 *
 * BDD outer loop: verifies the route returns 404 when provider doesn't own booking.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// --- Mock boundaries (DB, external I/O) ---

const mockBookingRepo = {
  findByIdForProvider: vi.fn(),
  updateProviderNotesWithAuth: vi.fn(),
}

const mockProviderRepo = {
  findByUserId: vi.fn(),
}

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/infrastructure/persistence/booking/PrismaBookingRepository", () => ({
  PrismaBookingRepository: class {
    findByIdForProvider = mockBookingRepo.findByIdForProvider
    updateProviderNotesWithAuth = mockBookingRepo.updateProviderNotesWithAuth
  },
}))

vi.mock("@/infrastructure/persistence/provider/ProviderRepository", () => ({
  ProviderRepository: class {
    findByUserId = mockProviderRepo.findByUserId
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    horseNote: { create: vi.fn() },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { ai: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/domain/voice-log/VoiceInterpretationService", () => ({
  VoiceInterpretationService: class {
    interpretQuickNote = vi.fn().mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        cleanedText: "Hästen var lugn idag",
        isHealthRelated: false,
        horseNoteCategory: null,
        suggestedNextWeeks: null,
      },
    })
  },
}))

import { auth } from "@/lib/auth-server"
import { POST } from "./route"

const mockAuth = vi.mocked(auth)

// Test data
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000001"
const OTHER_PROVIDER_ID = "a0000000-0000-4000-a000-000000000099"
const BOOKING_ID = "b0000000-0000-4000-a000-000000000001"
const USER_ID = "u0000000-0000-4000-a000-000000000001"

function createRequest(bookingId: string, body: object): NextRequest {
  return new NextRequest(`http://localhost/api/provider/bookings/${bookingId}/quick-note`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/provider/bookings/[id]/quick-note -- ownership guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockAuth.mockResolvedValue({
      user: { id: USER_ID, userType: "provider", providerId: PROVIDER_ID },
      expires: "2099-01-01",
    } as never)

    mockProviderRepo.findByUserId.mockResolvedValue({
      id: PROVIDER_ID,
      userId: USER_ID,
    })
  })

  it("returns 404 when provider does not own the booking (IDOR protection)", async () => {
    // Booking belongs to OTHER_PROVIDER_ID -- findByIdForProvider returns null
    mockBookingRepo.findByIdForProvider.mockResolvedValue(null)

    const req = createRequest(BOOKING_ID, { transcript: "Hästen var pigg" })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe("Bokning hittades inte")

    // Verify findByIdForProvider was called with both id AND providerId
    expect(mockBookingRepo.findByIdForProvider).toHaveBeenCalledWith(
      BOOKING_ID,
      PROVIDER_ID
    )
  })

  it("succeeds when provider owns the booking", async () => {
    mockBookingRepo.findByIdForProvider.mockResolvedValue({
      id: BOOKING_ID,
      providerId: PROVIDER_ID,
      status: "confirmed",
      horseId: null,
      customer: { firstName: "Anna", lastName: "Svensson" },
      service: { name: "Hovvård" },
      horse: null,
    })

    mockBookingRepo.updateProviderNotesWithAuth.mockResolvedValue({
      id: BOOKING_ID,
      providerNotes: "Hästen var lugn idag",
    })

    const req = createRequest(BOOKING_ID, { transcript: "Hästen var lugn idag" })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cleanedText).toBeDefined()
  })

  it("returns 400 when booking status is not confirmed/completed", async () => {
    mockBookingRepo.findByIdForProvider.mockResolvedValue({
      id: BOOKING_ID,
      providerId: PROVIDER_ID,
      status: "pending",
      horseId: null,
      customer: { firstName: "Anna", lastName: "Svensson" },
      service: { name: "Hovvård" },
      horse: null,
    })

    const req = createRequest(BOOKING_ID, { transcript: "Notering" })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })

    expect(res.status).toBe(400)
  })
})
