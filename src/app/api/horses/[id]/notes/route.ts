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
  return withApiHandler(
    { auth: "any" },
    async ({ request: req, user }) => {
      const { id: horseId } = await context.params

      // Optional category filter
      const { searchParams } = new URL(req.url)
      const category = searchParams.get("category")
      const validCategory = category && (NOTE_CATEGORIES as readonly string[]).includes(category)
        ? category
        : undefined

      const service = createHorseService()
      const result = await service.listNotes(horseId, user.userId, validCategory)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      return NextResponse.json(result.value)
    },
  )(request)
}

// POST - Create note for a horse (owner only)
export async function POST(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any", schema: noteCreateSchema },
    async ({ user, body }) => {
      const { id: horseId } = await context.params

      const service = createHorseService()
      const result = await service.createNote(
        horseId,
        {
          category: body.category,
          title: body.title,
          content: body.content,
          noteDate: new Date(body.noteDate),
        },
        user.userId
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
        category: body.category,
      })

      return NextResponse.json(result.value, { status: 201 })
    },
  )(request)
}
