import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import {
  createVoiceInterpretationService,
  mapVoiceLogErrorToStatus,
  type BookingContext,
} from "@/domain/voice-log/VoiceInterpretationService"
import { parseVocabulary, formatForPrompt } from "@/domain/voice-log/VocabularyService"

const interpretSchema = z.object({
  transcript: z.string().min(1, "Transkribering krävs").max(5000, "Transkribering för lång"),
  date: z.string().optional(),
}).strict()

// POST /api/voice-log - Interpret a voice transcript
export const POST = withApiHandler(
  { auth: "provider", rateLimit: "ai", featureFlag: "voice_logging", schema: interpretSchema },
  async ({ user, body: validated }) => {
    // Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(user.userId)
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
            breed: true,
            specialNeeds: true,
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

    // Fetch latest provider note for each horse (from previous bookings)
    const horseIds = bookings
      .map((b) => b.horse?.id)
      .filter((id): id is string => Boolean(id))
    const previousNotesByHorse: Record<string, string> = {}
    if (horseIds.length > 0) {
      const prevBookings = await prisma.booking.findMany({
        where: {
          providerId: provider.id,
          horseId: { in: horseIds },
          providerNotes: { not: null },
          bookingDate: { lt: date },
        },
        select: { horseId: true, providerNotes: true, bookingDate: true },
        orderBy: { bookingDate: "desc" },
      })
      for (const b of prevBookings) {
        if (b.horseId && b.providerNotes && !previousNotesByHorse[b.horseId]) {
          previousNotesByHorse[b.horseId] = b.providerNotes
        }
      }
    }

    // Map to context format
    const bookingContext: BookingContext[] = bookings.map((b) => ({
      id: b.id,
      customerName: `${b.customer.firstName} ${b.customer.lastName}`,
      horseName: b.horse?.name || b.horseName,
      horseId: b.horse?.id || b.horseId,
      serviceName: b.service.name,
      startTime: b.startTime,
      status: b.status,
      horseBreed: b.horse?.breed || null,
      horseSpecialNeeds: b.horse?.specialNeeds || null,
      previousNotes: (b.horse?.id && previousNotesByHorse[b.horse.id]) || null,
    }))

    // Build vocabulary prompt from provider's learned corrections
    const vocab = parseVocabulary(provider.vocabularyTerms ?? null)
    const vocabPrompt = formatForPrompt(vocab)

    // Interpret
    const service = createVoiceInterpretationService()
    const result = await service.interpret(validated.transcript, bookingContext, vocabPrompt)

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
  },
)
