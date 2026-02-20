import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { sanitizeString, stripXss } from "@/lib/sanitize"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import { horseCreateSchema } from "@/lib/schemas/horse"

type RouteContext = { params: Promise<{ customerId: string }> }

// GET /api/provider/customers/[customerId]/horses
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan se kunders hästar" },
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

    const hasRelation = await hasCustomerRelationship(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    const horses = await prisma.horse.findMany({
      where: { ownerId: customerId, isActive: true },
      select: {
        id: true,
        name: true,
        breed: true,
        birthYear: true,
        color: true,
        gender: true,
        specialNeeds: true,
        registrationNumber: true,
        microchipNumber: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ horses })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to fetch customer horses",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hämta hästar" },
      { status: 500 }
    )
  }
}

// POST /api/provider/customers/[customerId]/horses
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan lägga till hästar" },
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
    const parsed = horseCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customerId } = await context.params
    const providerId = session.user.providerId

    const hasRelation = await hasCustomerRelationship(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // Sanitize fields
    const data: Record<string, unknown> = {
      name: sanitizeString(stripXss(parsed.data.name)),
      ownerId: customerId,
    }
    if (parsed.data.breed) data.breed = sanitizeString(stripXss(parsed.data.breed))
    if (parsed.data.birthYear) data.birthYear = parsed.data.birthYear
    if (parsed.data.color) data.color = sanitizeString(stripXss(parsed.data.color))
    if (parsed.data.gender) data.gender = parsed.data.gender
    if (parsed.data.specialNeeds) data.specialNeeds = sanitizeString(stripXss(parsed.data.specialNeeds))
    if (parsed.data.registrationNumber) data.registrationNumber = sanitizeString(stripXss(parsed.data.registrationNumber))
    if (parsed.data.microchipNumber) data.microchipNumber = sanitizeString(stripXss(parsed.data.microchipNumber))

    const horse = await prisma.horse.create({
      data: data as any,
      select: {
        id: true,
        name: true,
        breed: true,
        birthYear: true,
        color: true,
        gender: true,
        specialNeeds: true,
        registrationNumber: true,
        microchipNumber: true,
        createdAt: true,
      },
    })

    logger.info("Horse created by provider for customer", {
      horseId: horse.id,
      customerId,
      providerId,
    })

    return NextResponse.json(horse, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to create customer horse",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte skapa häst" },
      { status: 500 }
    )
  }
}
