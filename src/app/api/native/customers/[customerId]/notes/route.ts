/**
 * GET /api/native/customers/[customerId]/notes - List customer notes
 * POST /api/native/customers/[customerId]/notes - Create note
 *
 * Auth: Bearer > Supabase.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import { sanitizeMultilineString, stripXss } from "@/lib/sanitize"

const createNoteSchema = z.object({
  content: z.string().min(1).max(2000),
}).strict()

const noteSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
}

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
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

    // 4. Verify customer relationship
    const { customerId } = await context.params
    const hasRelation = await hasCustomerRelationship(provider.id, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // 5. Fetch notes
    const notes = await prisma.providerCustomerNote.findMany({
      where: { providerId: provider.id, customerId },
      select: noteSelect,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    logger.error("Failed to fetch native customer notes", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta anteckningar" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 5. Find provider
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

    // 6. Verify customer relationship
    const { customerId } = await context.params
    const hasRelation = await hasCustomerRelationship(provider.id, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // 7. Sanitize content
    const content = sanitizeMultilineString(stripXss(parsed.data.content))
    if (!content) {
      return NextResponse.json(
        { error: "Valideringsfel", details: [{ message: "Innehållet kan inte vara tomt" }] },
        { status: 400 }
      )
    }

    // 8. Create note
    const note = await prisma.providerCustomerNote.create({
      data: {
        providerId: provider.id,
        customerId,
        content,
      },
      select: noteSelect,
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    logger.error("Failed to create native customer note", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte skapa anteckning" },
      { status: 500 }
    )
  }
}
