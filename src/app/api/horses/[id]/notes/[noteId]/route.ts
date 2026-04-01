import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

const NOTE_CATEGORIES = [
  "veterinary",
  "farrier",
  "general",
  "injury",
  "medication",
] as const

const noteUpdateSchema = z.object({
  category: z.enum(NOTE_CATEGORIES, {
    message: "Kategori måste vara veterinary, farrier, general, injury eller medication",
  }).optional(),
  title: z.string().min(1, "Titel krävs").max(200, "Titel för lång (max 200 tecken)").optional(),
  content: z.string().max(2000, "Innehåll för långt (max 2000 tecken)").nullable().optional(),
  noteDate: z.string().refine(
    (val) => {
      const date = new Date(val)
      if (isNaN(date.getTime())) return false
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      return date < tomorrow
    },
    { message: "Datum måste vara giltigt och inte i framtiden" }
  ).optional(),
})

type RouteContext = { params: Promise<{ id: string; noteId: string }> }

// PUT - Update a note
export async function PUT(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any", schema: noteUpdateSchema },
    async ({ user, body }) => {
      const { id: horseId, noteId } = await context.params

      const updateData: Record<string, unknown> = {}
      if (body.category !== undefined) updateData.category = body.category
      if (body.title !== undefined) updateData.title = body.title
      if (body.content !== undefined) updateData.content = body.content
      if (body.noteDate !== undefined) updateData.noteDate = new Date(body.noteDate)

      const service = createHorseService()
      const result = await service.updateNote(horseId, noteId, updateData, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      logger.info("Horse note updated", { noteId, horseId })
      return NextResponse.json(result.value)
    },
  )(request)
}

// DELETE - Hard delete a note
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any" },
    async ({ user }) => {
      const { id: horseId, noteId } = await context.params

      const service = createHorseService()
      const result = await service.deleteNote(horseId, noteId, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      logger.info("Horse note deleted", { noteId, horseId })
      return NextResponse.json({ message: "Anteckningen har tagits bort" })
    },
  )(request)
}
