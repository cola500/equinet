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

const noteCreateSchema = z.object({
  category: z.enum(NOTE_CATEGORIES, {
    message: "Kategori måste vara veterinary, farrier, general, injury eller medication",
  }),
  title: z.string().min(1, "Titel krävs").max(200, "Titel för lång (max 200 tecken)"),
  content: z.string().max(2000, "Innehåll för långt (max 2000 tecken)").optional(),
  noteDate: z.string().refine(
    (val) => {
      const date = new Date(val)
      if (isNaN(date.getTime())) return false
      // Must not be in the future (allow same day)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      return date < tomorrow
    },
    { message: "Datum måste vara giltigt och inte i framtiden" }
  ),
})

type RouteContext = { params: Promise<{ id: string }> }

// GET - List notes for a horse (owner only)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id: horseId } = await context.params

    // Optional category filter
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const validCategory = category && (NOTE_CATEGORIES as readonly string[]).includes(category)
      ? category
      : undefined

    const service = createHorseService()
    const result = await service.listNotes(horseId, session.user.id, validCategory)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch horse notes", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta anteckningar" },
      { status: 500 }
    )
  }
}

// POST - Create note for a horse (owner only)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id: horseId } = await context.params

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
    const validated = noteCreateSchema.parse(body)

    const service = createHorseService()
    const result = await service.createNote(
      horseId,
      {
        category: validated.category,
        title: validated.title,
        content: validated.content,
        noteDate: new Date(validated.noteDate),
      },
      session.user.id
    )

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse note created", {
      noteId: result.value.id,
      horseId,
      category: validated.category,
    })

    return NextResponse.json(result.value, { status: 201 })
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

    logger.error("Failed to create horse note", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa anteckning" },
      { status: 500 }
    )
  }
}
