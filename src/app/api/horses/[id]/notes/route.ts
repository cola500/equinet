import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

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

    // Verify horse ownership (IDOR protection)
    const horse = await prisma.horse.findFirst({
      where: {
        id: horseId,
        ownerId: session.user.id,
        isActive: true,
      },
    })

    if (!horse) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    // Optional category filter
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    const where: { horseId: string; category?: string } = { horseId }
    if (category && NOTE_CATEGORIES.includes(category as any)) {
      where.category = category
    }

    const notes = await prisma.horseNote.findMany({
      where,
      orderBy: { noteDate: "desc" },
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    return NextResponse.json(notes)
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

    // Verify horse ownership (IDOR protection)
    const horse = await prisma.horse.findFirst({
      where: {
        id: horseId,
        ownerId: session.user.id,
        isActive: true,
      },
    })

    if (!horse) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Validate
    const validated = noteCreateSchema.parse(body)

    const note = await prisma.horseNote.create({
      data: {
        horseId,
        authorId: session.user.id,
        category: validated.category,
        title: validated.title,
        content: validated.content,
        noteDate: new Date(validated.noteDate),
      },
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    logger.info("Horse note created", {
      noteId: note.id,
      horseId,
      category: validated.category,
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
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
