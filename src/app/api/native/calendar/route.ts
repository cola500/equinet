/**
 * GET /api/native/calendar - Calendar data for native iOS app
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 * Returns bookings + availability + exceptions for a date range.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { dateSchema } from "@/lib/zod-schemas"

const querySchema = z.object({
  from: dateSchema,
  to: dateSchema,
}).strict().refine(
  (data) => {
    const from = new Date(data.from)
    const to = new Date(data.to)
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return false
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 31
  },
  { message: "Ogiltigt datumintervall (max 31 dagar)" }
)

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (dual-auth)
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

    // 3. Validate query params
    const params = {
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
    }
    const parseResult = querySchema.safeParse(params)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parseResult.error.issues },
        { status: 400 }
      )
    }
    const { from, to } = parseResult.data

    // 4. Find provider for this user
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

    const fromDate = new Date(from)
    const toDate = new Date(to)

    // 5. Fetch data in parallel
    const [bookings, availability, exceptions] = await Promise.all([
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          bookingDate: { gte: fromDate, lte: toDate },
        },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          status: true,
          horseName: true,
          customerNotes: true,
          providerNotes: true,
          bookingSeriesId: true,
          customer: {
            select: { firstName: true, lastName: true, phone: true },
          },
          service: {
            select: { id: true, name: true, price: true },
          },
          isManualBooking: true,
          payment: {
            select: { id: true },
          },
        },
      }),
      prisma.availability.findMany({
        where: { providerId: provider.id, isActive: true },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          isClosed: true,
        },
      }),
      prisma.availabilityException.findMany({
        where: {
          providerId: provider.id,
          date: { gte: fromDate, lte: toDate },
        },
        select: {
          date: true,
          isClosed: true,
          startTime: true,
          endTime: true,
          reason: true,
          location: true,
        },
      }),
    ])

    logger.info("Native calendar data fetched", {
      userId: authUser.id,
      providerId: provider.id,
      from,
      to,
      bookingCount: bookings.length,
    })

    // 6. Map response (flatten nested relations)
    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        horseName: b.horseName,
        customerFirstName: b.customer.firstName,
        customerLastName: b.customer.lastName,
        customerPhone: b.customer.phone ?? null,
        serviceName: b.service.name,
        serviceId: b.service.id,
        servicePrice: b.service.price,
        isManualBooking: b.isManualBooking,
        isPaid: b.payment !== null,
        bookingSeriesId: b.bookingSeriesId ?? null,
        customerNotes: b.customerNotes ?? null,
        providerNotes: b.providerNotes ?? null,
      })),
      availability,
      exceptions,
    })
  } catch (error) {
    logger.error("Failed to fetch native calendar data", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
