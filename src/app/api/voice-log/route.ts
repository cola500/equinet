import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import {
  createVoiceInterpretationService,
  mapVoiceLogErrorToStatus,
  type BookingContext,
} from "@/domain/voice-log/VoiceInterpretationService"

const interpretSchema = z.object({
  transcript: z.string().min(1, "Transkribering krävs").max(5000, "Transkribering för lång"),
  date: z.string().optional(),
})

// POST /api/voice-log - Interpret a voice transcript
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const validated = interpretSchema.parse(body)

    // Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // Get today's bookings with customer/horse details for context
    const date = validated.date ? new Date(validated.date) : new Date()
    date.setHours(0, 0, 0, 0)

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        bookingDate: date,
        status: { in: ["confirmed", "pending", "completed"] },
      },
      select: {
        id: true,
        startTime: true,
        status: true,
        horseName: true,
        horseId: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        horse: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    })

    // Map to context format
    const bookingContext: BookingContext[] = bookings.map((b: any) => ({
      id: b.id,
      customerName: `${b.customer.firstName} ${b.customer.lastName}`,
      horseName: b.horse?.name || b.horseName,
      horseId: b.horse?.id || b.horseId,
      serviceName: b.service.name,
      startTime: b.startTime,
      status: b.status,
    }))

    // Interpret
    const service = createVoiceInterpretationService()
    const result = await service.interpret(validated.transcript, bookingContext)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapVoiceLogErrorToStatus(result.error) }
      )
    }

    logger.info("Voice log interpreted", {
      providerId: provider.id,
      bookingId: result.value.bookingId,
      confidence: result.value.confidence,
    })

    // Enrich result with horseId from context
    const enriched = { ...result.value }
    if (enriched.bookingId) {
      const matchedBooking = bookingContext.find((b) => b.id === enriched.bookingId)
      if (matchedBooking) {
        enriched.horseName = enriched.horseName || matchedBooking.horseName
      }
    }

    return NextResponse.json({
      interpretation: enriched,
      bookings: bookingContext,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to interpret voice log", error as Error)
    return NextResponse.json(
      { error: "Kunde inte tolka röstinspelningen" },
      { status: 500 }
    )
  }
}
