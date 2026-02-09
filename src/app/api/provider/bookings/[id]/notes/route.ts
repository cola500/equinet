import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { rateLimiters } from "@/lib/rate-limit"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { logger } from "@/lib/logger"
import { sanitizeString } from "@/lib/sanitize"

const providerNotesSchema = z.object({
  providerNotes: z.string().max(2000, "Anteckningen far vara max 2000 tecken").nullable(),
}).strict()

/**
 * PUT /api/provider/bookings/[id]/notes
 *
 * Update provider notes on a booking.
 * Only the owning provider can update notes.
 * Booking must be confirmed or completed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Auth
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    // 2. Rate limiting
    const isAllowed = await rateLimiters.api(session.user.id)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    // 3. Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // 4. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      logger.warn("Invalid JSON in provider notes request")
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    // 5. Zod validation
    const validated = providerNotesSchema.parse(body)

    // 6. Verify booking exists and belongs to provider with correct status
    const bookingRepo = new PrismaBookingRepository()
    const booking = await bookingRepo.findById(id)

    if (!booking || booking.providerId !== provider.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (!["confirmed", "completed"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Anteckningar kan bara laggas till pa bekraftade eller genomforda bokningar" },
        { status: 400 }
      )
    }

    // 7. Sanitize and update
    const sanitizedNotes = validated.providerNotes
      ? sanitizeString(validated.providerNotes)
      : null

    const updated = await bookingRepo.updateProviderNotesWithAuth(
      id,
      sanitizedNotes,
      provider.id
    )

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error(
      "Error updating provider notes",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
