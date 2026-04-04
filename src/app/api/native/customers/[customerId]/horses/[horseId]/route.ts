/**
 * PUT /api/native/customers/[customerId]/horses/[horseId] - Update horse
 * DELETE /api/native/customers/[customerId]/horses/[horseId] - Soft-delete horse
 *
 * Auth: Bearer > Supabase.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import { horseUpdateSchema } from "@/lib/schemas/horse"
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

type RouteContext = { params: Promise<{ customerId: string; horseId: string }> }

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
    const parsed = horseUpdateSchema.safeParse(body)
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
    const { customerId, horseId } = await context.params
    const hasRelation = await hasCustomerRelationship(provider.id, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // 7. Verify horse belongs to customer
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

    // 8. Sanitize & update
    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = sanitizeString(stripXss(parsed.data.name))
    if (parsed.data.breed !== undefined) data.breed = parsed.data.breed ? sanitizeString(stripXss(parsed.data.breed)) : null
    if (parsed.data.birthYear !== undefined) data.birthYear = parsed.data.birthYear
    if (parsed.data.color !== undefined) data.color = parsed.data.color ? sanitizeString(stripXss(parsed.data.color)) : null
    if (parsed.data.gender !== undefined) data.gender = parsed.data.gender
    if (parsed.data.specialNeeds !== undefined) data.specialNeeds = parsed.data.specialNeeds ? sanitizeString(stripXss(parsed.data.specialNeeds)) : null
    if (parsed.data.registrationNumber !== undefined) data.registrationNumber = parsed.data.registrationNumber ? sanitizeString(stripXss(parsed.data.registrationNumber)) : null
    if (parsed.data.microchipNumber !== undefined) data.microchipNumber = parsed.data.microchipNumber ? sanitizeString(stripXss(parsed.data.microchipNumber)) : null

    // Atomic ownership check in WHERE
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
      select: horseSelect,
    })

    logger.info("Native horse updated for customer", {
      horseId,
      customerId,
      providerId: provider.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error("Failed to update native customer horse", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera häst" },
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

    // 4. Verify customer relationship
    const { customerId, horseId } = await context.params
    const hasRelation = await hasCustomerRelationship(provider.id, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // 5. Verify horse belongs to customer
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

    // 6. Atomic soft delete
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

    logger.info("Native horse soft-deleted for customer", {
      horseId,
      customerId,
      providerId: provider.id,
    })

    return NextResponse.json({ message: "Hästen har tagits bort" })
  } catch (error) {
    logger.error("Failed to delete native customer horse", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte ta bort häst" },
      { status: 500 }
    )
  }
}
