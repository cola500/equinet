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

    // Verify note exists on this horse
    const existingNote = await prisma.horseNote.findFirst({
      where: { id: noteId, horseId },
    })

    if (!existingNote) {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
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
    const validated = noteUpdateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (validated.category !== undefined) updateData.category = validated.category
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.content !== undefined) updateData.content = validated.content
    if (validated.noteDate !== undefined) updateData.noteDate = new Date(validated.noteDate)

    const updated = await prisma.horseNote.update({
      where: { id: noteId },
      data: updateData,
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    logger.info("Horse note updated", { noteId, horseId })

    return NextResponse.json(updated)
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

    // Verify note exists on this horse
    const existingNote = await prisma.horseNote.findFirst({
      where: { id: noteId, horseId },
    })

    if (!existingNote) {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
        { status: 404 }
      )
    }

    await prisma.horseNote.delete({
      where: { id: noteId },
    })

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
