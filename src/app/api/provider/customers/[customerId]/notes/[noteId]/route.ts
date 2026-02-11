import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { sanitizeMultilineString, stripXss } from "@/lib/sanitize"

const updateNoteSchema = z.object({
  content: z.string().min(1).max(2000),
}).strict()

const noteSelect = {
  id: true,
  providerId: true,
  customerId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
}

type RouteContext = { params: Promise<{ customerId: string; noteId: string }> }

// PUT /api/provider/customers/[customerId]/notes/[noteId]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan redigera kundanteckningar" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate with Zod
    const parsed = updateNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // Sanitize content
    const content = sanitizeMultilineString(stripXss(parsed.data.content))
    if (!content) {
      return NextResponse.json(
        { error: "Valideringsfel", details: [{ message: "Innehållet kan inte vara tomt" }] },
        { status: 400 }
      )
    }

    const { noteId } = await context.params
    const providerId = session.user.providerId

    try {
      // Atomic: WHERE { id, providerId } ensures IDOR protection
      const note = await prisma.providerCustomerNote.update({
        where: { id: noteId, providerId },
        data: { content },
        select: noteSelect,
      })

      return NextResponse.json(note)
    } catch {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
        { status: 404 }
      )
    }
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to update customer note",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte uppdatera anteckning" },
      { status: 500 }
    )
  }
}

// DELETE /api/provider/customers/[customerId]/notes/[noteId]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan ta bort kundanteckningar" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    const { noteId } = await context.params
    const providerId = session.user.providerId

    try {
      // Atomic: WHERE { id, providerId } ensures IDOR protection
      await prisma.providerCustomerNote.delete({
        where: { id: noteId, providerId },
      })
    } catch {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
        { status: 404 }
      )
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to delete customer note",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte ta bort anteckning" },
      { status: 500 }
    )
  }
}
