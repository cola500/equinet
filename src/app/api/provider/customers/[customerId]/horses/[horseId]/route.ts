import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { sanitizeString, stripXss } from "@/lib/sanitize"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import { horseUpdateSchema } from "@/lib/schemas/horse"

type RouteContext = { params: Promise<{ customerId: string; horseId: string }> }

// PUT /api/provider/customers/[customerId]/horses/[horseId]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan uppdatera hästar" },
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
    const parsed = horseUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customerId, horseId } = await context.params
    const providerId = session.user.providerId

    const hasRelation = await hasCustomerRelationship(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // Verify horse belongs to customer
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, ownerId: customerId, isActive: true },
      select: { id: true },
    })
    if (!horse) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    // Sanitize fields
    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = sanitizeString(stripXss(parsed.data.name))
    if (parsed.data.breed !== undefined) data.breed = parsed.data.breed ? sanitizeString(stripXss(parsed.data.breed)) : null
    if (parsed.data.birthYear !== undefined) data.birthYear = parsed.data.birthYear
    if (parsed.data.color !== undefined) data.color = parsed.data.color ? sanitizeString(stripXss(parsed.data.color)) : null
    if (parsed.data.gender !== undefined) data.gender = parsed.data.gender
    if (parsed.data.specialNeeds !== undefined) data.specialNeeds = parsed.data.specialNeeds ? sanitizeString(stripXss(parsed.data.specialNeeds)) : null
    if (parsed.data.registrationNumber !== undefined) data.registrationNumber = parsed.data.registrationNumber ? sanitizeString(stripXss(parsed.data.registrationNumber)) : null
    if (parsed.data.microchipNumber !== undefined) data.microchipNumber = parsed.data.microchipNumber ? sanitizeString(stripXss(parsed.data.microchipNumber)) : null

    // Atomic ownership check: updateMany includes ownerId + isActive in WHERE to prevent TOCTOU
    const updateResult = await prisma.horse.updateMany({
      where: { id: horseId, ownerId: customerId, isActive: true },
      data,
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    const updated = await prisma.horse.findUnique({
      where: { id: horseId },
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

    logger.info("Horse updated by provider for customer", {
      horseId,
      customerId,
      providerId,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to update customer horse",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte uppdatera häst" },
      { status: 500 }
    )
  }
}

// DELETE /api/provider/customers/[customerId]/horses/[horseId]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan ta bort hästar" },
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

    const { customerId, horseId } = await context.params
    const providerId = session.user.providerId

    const hasRelation = await hasCustomerRelationship(providerId, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // Verify horse belongs to customer
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, ownerId: customerId, isActive: true },
      select: { id: true },
    })
    if (!horse) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    // Atomic soft delete with ownership in WHERE to prevent TOCTOU
    const deleteResult = await prisma.horse.updateMany({
      where: { id: horseId, ownerId: customerId, isActive: true },
      data: { isActive: false },
    })

    if (deleteResult.count === 0) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    logger.info("Horse soft-deleted by provider for customer", {
      horseId,
      customerId,
      providerId,
    })

    return NextResponse.json({ message: "Hästen har tagits bort" })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to delete customer horse",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte ta bort häst" },
      { status: 500 }
    )
  }
}
