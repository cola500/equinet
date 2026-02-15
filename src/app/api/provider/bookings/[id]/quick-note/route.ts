import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { VoiceInterpretationService } from "@/domain/voice-log/VoiceInterpretationService"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sanitizeString } from "@/lib/sanitize"

const quickNoteSchema = z.object({
  transcript: z.string().min(1).max(2000),
}).strict()

/**
 * POST /api/provider/bookings/[id]/quick-note
 *
 * Quick voice note: AI cleans transcript, saves as providerNotes,
 * optionally creates HorseNote if health-related.
 */
export async function POST(
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

    // 2. Rate limiting (AI-specific)
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.ai(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många AI-förfrågningar. Försök igen om en stund." },
        { status: 429 }
      )
    }

    // 3. Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // 4. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 5. Zod validation
    const validated = quickNoteSchema.parse(body)

    // 6. Verify booking ownership + status (with relations for AI context)
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
        horseId: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        horse: { select: { name: true, breed: true, specialNeeds: true } },
      },
    })

    if (!booking || booking.providerId !== provider.id) {
      return NextResponse.json({ error: "Bokning hittades inte" }, { status: 404 })
    }

    if (!["confirmed", "completed"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Anteckningar kan bara läggas till på bekräftade eller genomförda bokningar" },
        { status: 400 }
      )
    }

    // 7. AI interpretation
    const aiService = new VoiceInterpretationService()
    const result = await aiService.interpretQuickNote(validated.transcript, {
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      horseName: booking.horse?.name ?? null,
      serviceType: booking.service.name,
      horseBreed: booking.horse?.breed ?? null,
      specialNeeds: booking.horse?.specialNeeds ?? null,
    })

    if (result.isFailure) {
      const statusCode = result.error.type === "API_KEY_MISSING" ? 503 : 500
      return NextResponse.json(
        { error: "Kunde inte tolka anteckningen" },
        { status: statusCode }
      )
    }

    const interpreted = result.value
    const actions: string[] = []

    // 8. Save cleaned text as providerNotes
    const bookingRepo = new PrismaBookingRepository()
    const sanitizedText = sanitizeString(interpreted.cleanedText)
    const updated = await bookingRepo.updateProviderNotesWithAuth(
      id,
      sanitizedText,
      provider.id
    )

    if (updated) {
      actions.push("providerNotes")
    }

    // 9. Create HorseNote if health-related
    if (
      interpreted.isHealthRelated &&
      interpreted.horseNoteCategory &&
      booking.horseId
    ) {
      await prisma.horseNote.create({
        data: {
          horseId: booking.horseId,
          authorId: session.user.id,
          category: interpreted.horseNoteCategory,
          title: sanitizedText.slice(0, 100),
          content: sanitizedText,
          noteDate: new Date(),
        },
      })
      actions.push("horseNote")
    }

    logger.info("Quick note saved", {
      providerId: provider.id,
      bookingId: id,
      actions,
    })

    return NextResponse.json({
      cleanedText: sanitizedText,
      isHealthRelated: interpreted.isHealthRelated,
      horseNoteCategory: interpreted.horseNoteCategory,
      suggestedNextWeeks: interpreted.suggestedNextWeeks,
      actions,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error(
      "Error saving quick note",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
