import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { sanitizeString } from "@/lib/sanitize"

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const from = searchParams.get("from") || ""
    const to = searchParams.get("to") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      where.bookingDate = dateFilter
    }

    const [bookingsRaw, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          status: true,
          isManualBooking: true,
          customer: {
            select: { firstName: true, lastName: true },
          },
          provider: {
            select: { businessName: true },
          },
          service: {
            select: { name: true },
          },
        },
        orderBy: { bookingDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ])

    const bookings = bookingsRaw.map((b) => ({
      id: b.id,
      bookingDate: b.bookingDate,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      isManualBooking: b.isManualBooking,
      customerName: [b.customer?.firstName, b.customer?.lastName]
        .filter(Boolean)
        .join(" ") || "-",
      providerBusinessName: b.provider?.businessName || "-",
      serviceName: b.service?.name || "-",
    }))

    return NextResponse.json({
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  },
)

// ============================================================
// PATCH -- Cancel booking as admin
// ============================================================

const patchSchema = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(["cancel"]),
  reason: z.string().min(1).max(500),
}).strict()

export const PATCH = withApiHandler(
  { auth: "admin", schema: patchSchema },
  async ({ user, body }) => {
    const { bookingId, reason } = body
    const sanitizedReason = sanitizeString(reason)

    // Look up booking with provider userId for notification
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        customerId: true,
        provider: {
          select: { userId: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokningen hittades inte" },
        { status: 404 }
      )
    }

    // Only pending/confirmed can be cancelled
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Kan inte avboka en bokning med status: " + booking.status },
        { status: 400 }
      )
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
        cancellationMessage: `[Admin] ${sanitizedReason}`,
      },
      select: { id: true, status: true, cancellationMessage: true },
    })

    // Notify both customer and provider
    const notificationMessage = `En bokning har avbokats av administratör: ${sanitizedReason}`
    await prisma.notification.createMany({
      data: [
        {
          userId: booking.customerId,
          type: "booking_cancelled",
          message: notificationMessage,
          linkUrl: "/customer/bookings",
        },
        {
          userId: booking.provider!.userId,
          type: "booking_cancelled",
          message: notificationMessage,
          linkUrl: "/provider/bookings",
        },
      ],
    })

    logger.security(`Admin cancelled booking ${bookingId}: ${sanitizedReason}`, "high", {
      adminId: user.userId,
      bookingId,
    })

    return NextResponse.json(updated)
  },
)
