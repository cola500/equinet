/**
 * PUT /api/native/customers/[customerId] - Update customer
 * DELETE /api/native/customers/[customerId] - Remove manually added customer
 *
 * Auth: Bearer > Supabase.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
}).strict()

type RouteContext = { params: Promise<{ customerId: string }> }

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
    const parseResult = updateCustomerSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parseResult.error.issues },
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

    // 6. IDOR-safe: verify customer belongs to provider
    const { customerId } = await context.params
    const link = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: { providerId: provider.id, customerId },
      },
    })
    if (!link) {
      return NextResponse.json(
        { error: "Kunden finns inte i ditt kundregister" },
        { status: 404 }
      )
    }

    // 7. Update
    const validated = parseResult.data
    const updated = await prisma.user.update({
      where: { id: customerId },
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName || "",
        phone: validated.phone || null,
        email: validated.email || undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    })

    logger.info("Native customer updated", {
      userId: authUser.id,
      customerId,
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error("Failed to update native customer", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera kund" },
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

    // 4. IDOR-safe: verify customer belongs to provider
    const { customerId } = await context.params
    const link = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: { providerId: provider.id, customerId },
      },
    })
    if (!link) {
      return NextResponse.json(
        { error: "Kunden finns inte i ditt kundregister" },
        { status: 404 }
      )
    }

    // 5. Delete the link
    await prisma.providerCustomer.delete({
      where: { id: link.id },
    })

    // 6. Clean up ghost user if no bookings
    const bookingCount = await prisma.booking.count({
      where: { customerId },
    })

    if (bookingCount === 0) {
      const user = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, isManualCustomer: true },
      })

      if (user?.isManualCustomer) {
        await prisma.user.delete({ where: { id: customerId } })
        logger.info("Ghost user cleaned up after customer removal", {
          ghostUserId: customerId,
        })
      }
    }

    return NextResponse.json({ message: "Kunden har tagits bort" })
  } catch (error) {
    logger.error("Failed to delete native customer", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte ta bort kund" },
      { status: 500 }
    )
  }
}
