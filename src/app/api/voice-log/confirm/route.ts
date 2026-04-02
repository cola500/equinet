import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { createBookingService } from "@/domain/booking"
import {
  parseVocabulary,
  addCorrections,
  detectSignificantChanges,
} from "@/domain/voice-log/VocabularyService"

const confirmSchema = z.object({
  bookingId: z.string().uuid("Ogiltigt boknings-ID"),
  markAsCompleted: z.boolean(),
  workPerformed: z.string().max(2000).nullable(),
  horseObservation: z.string().max(2000).nullable(),
  horseNoteCategory: z.enum(["farrier", "veterinary", "general", "medication"]).nullable(),
  nextVisitWeeks: z.number().int().min(1).max(52).nullable(),
  originalWorkPerformed: z.string().max(2000).nullable().optional(),
  originalHorseObservation: z.string().max(2000).nullable().optional(),
}).strict()

// POST /api/voice-log/confirm - Save interpreted voice log data
export const POST = withApiHandler(
  { auth: "provider", rateLimit: "api", featureFlag: "voice_logging", schema: confirmSchema },
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

    const actions: string[] = []

    // 1. Update provider notes on booking (atomic ownership check via WHERE)
    if (validated.workPerformed) {
      const bookingRepo = new PrismaBookingRepository()
      const updated = await bookingRepo.updateProviderNotesWithAuth(
        validated.bookingId,
        validated.workPerformed,
        provider.id
      )
      if (!updated) {
        return NextResponse.json(
          { error: "Bokningen hittades inte eller åtkomst nekad" },
          { status: 404 }
        )
      }
      actions.push("providerNotes")
    }

    // 2. Mark as completed via BookingService
    if (validated.markAsCompleted) {
      const bookingService = createBookingService()
      const result = await bookingService.updateStatus({
        bookingId: validated.bookingId,
        newStatus: "completed",
        providerId: provider.id,
      })

      if (result.isFailure) {
        // Non-fatal: notes were saved, but status change failed
        logger.warn("Voice log: could not complete booking", {
          bookingId: validated.bookingId,
          error: result.error.type,
        })
      } else {
        actions.push("completed")
      }
    }

    // 3. Create horse note if observation provided
    if (validated.horseObservation && validated.horseNoteCategory) {
      // Verify booking belongs to this provider (atomic WHERE with providerId)
      const bookingRepoForNote = new PrismaBookingRepository()
      const booking = await bookingRepoForNote.findByIdForProvider(validated.bookingId, provider.id)

      if (booking?.horseId) {
        await prisma.horseNote.create({
          data: {
            horseId: booking.horseId,
            authorId: user.userId,
            category: validated.horseNoteCategory,
            title: validated.horseObservation.slice(0, 100),
            content: validated.horseObservation,
            noteDate: new Date(),
          },
        })
        actions.push("horseNote")
      }
    }

    // 4. Learn vocabulary from edits (non-blocking)
    if (validated.originalWorkPerformed && validated.workPerformed &&
        validated.originalWorkPerformed !== validated.workPerformed) {
      const workChanges = detectSignificantChanges(
        validated.originalWorkPerformed,
        validated.workPerformed
      )

      let allChanges = [...workChanges]

      if (validated.originalHorseObservation && validated.horseObservation &&
          validated.originalHorseObservation !== validated.horseObservation) {
        const obsChanges = detectSignificantChanges(
          validated.originalHorseObservation,
          validated.horseObservation
        )
        allChanges = [...allChanges, ...obsChanges]
      }

      if (allChanges.length > 0) {
        const currentVocab = parseVocabulary(provider.vocabularyTerms ?? null)
        const updatedVocab = addCorrections(currentVocab, allChanges)
        await prisma.provider.update({
          where: { id: provider.id },
          data: { vocabularyTerms: JSON.stringify(updatedVocab) },
        })
        actions.push("vocabulary")
      }
    }

    logger.info("Voice log confirmed", {
      providerId: provider.id,
      bookingId: validated.bookingId,
      actions,
    })

    return NextResponse.json({
      success: true,
      actions,
      nextVisitWeeks: validated.nextVisitWeeks,
    })
  }
)
