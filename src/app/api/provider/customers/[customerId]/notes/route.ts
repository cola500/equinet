import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { sanitizeMultilineString, stripXss } from "@/lib/sanitize"

const createNoteSchema = z.object({
  content: z.string().min(1).max(2000),
}).strict()

type RouteContext = { params: Promise<{ customerId: string }> }

// Check that the provider has at least one completed booking with the customer
async function hasCompletedBooking(providerId: string, customerId: string): Promise<boolean> {
  const count = await prisma.booking.count({
    where: { providerId, customerId, status: "completed" },
  })
  return count > 0
}

// GET /api/provider/customers/[customerId]/notes
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan se kundanteckningar" },
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

    const { customerId } = await context.params
    const providerId = session.user.providerId

    // Verify booking relation
    const hasRelation = await hasCompletedBooking(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen avslutad bokning med denna kund" },
        { status: 403 }
      )
    }

    const notes = await prisma.providerCustomerNote.findMany({
      where: { providerId, customerId },
      select: {
        id: true,
        providerId: true,
        customerId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to fetch customer notes",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hämta anteckningar" },
      { status: 500 }
    )
  }
}

// POST /api/provider/customers/[customerId]/notes
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan skapa kundanteckningar" },
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
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customerId } = await context.params
    const providerId = session.user.providerId

    // Verify booking relation
    const hasRelation = await hasCompletedBooking(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen avslutad bokning med denna kund" },
        { status: 403 }
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

    const note = await prisma.providerCustomerNote.create({
      data: {
        providerId,
        customerId,
        content,
      },
      select: {
        id: true,
        providerId: true,
        customerId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to create customer note",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte skapa anteckning" },
      { status: 500 }
    )
  }
}
