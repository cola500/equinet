import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
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
  try {
    const session = await auth()
    const { id: horseId, noteId } = await context.params

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    // Validate
    const validated = noteUpdateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (validated.category !== undefined) updateData.category = validated.category
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.content !== undefined) updateData.content = validated.content
    if (validated.noteDate !== undefined) updateData.noteDate = new Date(validated.noteDate)

    const service = createHorseService()
    const result = await service.updateNote(horseId, noteId, updateData, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse note updated", { noteId, horseId })

    return NextResponse.json(result.value)
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

    logger.error("Failed to update horse note", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera anteckning" },
      { status: 500 }
    )
  }
}

// DELETE - Hard delete a note
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id: horseId, noteId } = await context.params

    const service = createHorseService()
    const result = await service.deleteNote(horseId, noteId, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse note deleted", { noteId, horseId })

    return NextResponse.json({ message: "Anteckningen har tagits bort" })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to delete horse note", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ta bort anteckning" },
      { status: 500 }
    )
  }
}
