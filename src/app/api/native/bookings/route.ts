/**
 * GET /api/native/bookings - Booking list for native iOS app
 *
 * Auth: Bearer token (mobile token).
 * Returns bookings for the provider, optionally filtered by status.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const statusSchema = z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"])

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
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

    // 3. Optional status filter
    const statusParam = request.nextUrl.searchParams.get("status")
    if (statusParam) {
      const parseResult = statusSchema.safeParse(statusParam)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Valideringsfel", details: parseResult.error.issues },
          { status: 400 }
        )
      }
    }

    // 4. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 5. Build where clause
    const where: { providerId: string; status?: string } = {
      providerId: provider.id,
    }
    if (statusParam) {
      where.status = statusParam
    }

    // 6. Fetch bookings with lean select
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { bookingDate: "desc" },
      take: 100,
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        horseName: true,
        customerNotes: true,
        providerNotes: true,
        cancellationMessage: true,
        isManualBooking: true,
        bookingSeriesId: true,
        customer: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        service: {
          select: { name: true, price: true },
        },
        horse: {
          select: { id: true, breed: true },
        },
        payment: {
          select: { id: true, invoiceNumber: true },
        },
        customerReview: {
          select: { id: true, rating: true, comment: true },
        },
      },
    })

    logger.info("Native bookings fetched", {
      userId: authResult.userId,
      providerId: provider.id,
      count: bookings.length,
      statusFilter: statusParam,
    })

    // 7. Flatten response
    return NextResponse.json(
      bookings.map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        serviceName: b.service.name,
        servicePrice: b.service.price,
        customerFirstName: b.customer.firstName,
        customerLastName: b.customer.lastName,
        customerEmail: b.customer.email,
        customerPhone: b.customer.phone ?? null,
        horseName: b.horseName ?? null,
        horseId: b.horse?.id ?? null,
        horseBreed: b.horse?.breed ?? null,
        isPaid: b.payment !== null,
        invoiceNumber: b.payment?.invoiceNumber ?? null,
        isManualBooking: b.isManualBooking,
        bookingSeriesId: b.bookingSeriesId ?? null,
        customerNotes: b.customerNotes ?? null,
        providerNotes: b.providerNotes ?? null,
        cancellationMessage: b.cancellationMessage ?? null,
        customerReview: b.customerReview
          ? {
              id: b.customerReview.id,
              rating: b.customerReview.rating,
              comment: b.customerReview.comment ?? null,
            }
          : null,
      }))
    )
  } catch (error) {
    logger.error("Failed to fetch native bookings", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
