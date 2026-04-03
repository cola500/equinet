/**
 * GET /api/native/customers/[customerId]/horses - List customer horses
 * POST /api/native/customers/[customerId]/horses - Create horse
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import { horseCreateSchema } from "@/lib/schemas/horse"
import { sanitizeString, stripXss } from "@/lib/sanitize"

const horseSelect = {
  id: true,
  name: true,
  breed: true,
  birthYear: true,
  color: true,
  gender: true,
  specialNeeds: true,
  registrationNumber: true,
  microchipNumber: true,
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

    // 5. Fetch horses
    const horses = await prisma.horse.findMany({
      where: { ownerId: customerId, isActive: true },
      select: horseSelect,
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ horses })
  } catch (error) {
    logger.error("Failed to fetch native customer horses", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta hästar" },
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
    const parsed = horseCreateSchema.safeParse(body)
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

    // 7. Sanitize & create
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
      // @ts-expect-error -- Prisma expects typed input but data is dynamically built from validated fields
      data,
      select: horseSelect,
    })

    logger.info("Native horse created for customer", {
      horseId: horse.id,
      customerId,
      providerId: provider.id,
    })

    return NextResponse.json(horse, { status: 201 })
  } catch (error) {
    logger.error("Failed to create native customer horse", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte skapa häst" },
      { status: 500 }
    )
  }
}
