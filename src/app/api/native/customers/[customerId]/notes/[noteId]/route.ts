/**
 * PUT /api/native/customers/[customerId]/notes/[noteId] - Update note
 * DELETE /api/native/customers/[customerId]/notes/[noteId] - Delete note
 *
 * Auth: Bearer > Supabase.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { sanitizeMultilineString, stripXss } from "@/lib/sanitize"

const updateNoteSchema = z.object({
  content: z.string().min(1).max(2000),
}).strict()

const noteSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
}

type RouteContext = { params: Promise<{ customerId: string; noteId: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validate
    const parsed = updateNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 5. Sanitize content
    const content = sanitizeMultilineString(stripXss(parsed.data.content))
    if (!content) {
      return NextResponse.json(
        { error: "Valideringsfel", details: [{ message: "Innehållet kan inte vara tomt" }] },
        { status: 400 }
      )
    }

    // 6. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 7. Atomic update with IDOR protection
    const { noteId } = await context.params
    try {
      const note = await prisma.providerCustomerNote.update({
        where: { id: noteId, providerId: provider.id },
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
    logger.error("Failed to update native customer note", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera anteckning" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Atomic delete with IDOR protection
    const { noteId } = await context.params
    try {
      await prisma.providerCustomerNote.delete({
        where: { id: noteId, providerId: provider.id },
      })
    } catch {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
        { status: 404 }
      )
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    logger.error("Failed to delete native customer note", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte ta bort anteckning" },
      { status: 500 }
    )
  }
}
