/**
 * PATCH /api/native/announcements/[id]/bookings/[bookingId]
 *
 * Update booking status (confirm or cancel) for an announcement booking.
 * Auth: Bearer > Supabase
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const updateBookingSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
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

    if (!authUser.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const { id: announcementId, bookingId } = await params

    // Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateBookingSchema.parse(body)

    // Verify announcement ownership
    const announcement = await prisma.routeOrder.findFirst({
      where: {
        id: announcementId,
        providerId: authUser.providerId,
        announcementType: "provider_announced",
      },
      select: { id: true },
    })

    if (!announcement) {
      return NextResponse.json(
        { error: "Annons hittades inte" },
        { status: 404 }
      )
    }

    // Verify booking belongs to this announcement and is in valid state
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        routeOrderId: announcementId,
        status: "pending",
      },
      select: { id: true },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokningen hittades inte eller kan inte ändras" },
        { status: 404 }
      )
    }

    // Update booking status
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: validated.status,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
      },
    })

    logger.info("Native booking status updated", {
      bookingId,
      announcementId,
      newStatus: validated.status,
      providerId: authUser.providerId,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to update booking status", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera bokningen" },
      { status: 500 }
    )
  }
}
