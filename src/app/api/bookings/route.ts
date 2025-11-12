import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const bookingSchema = z.object({
  providerId: z.string(),
  serviceId: z.string(),
  bookingDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  horseName: z.string().optional(),
  horseInfo: z.string().optional(),
  customerNotes: z.string().optional(),
}).strict()

// GET bookings for logged-in user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let bookings

    if (session.user.userType === "provider") {
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
      })

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      bookings = await prisma.booking.findMany({
        where: { providerId: provider.id },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          service: true,
        },
        orderBy: { bookingDate: "desc" },
      })
    } else {
      bookings = await prisma.booking.findMany({
        where: { customerId: session.user.id },
        include: {
          provider: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          service: true,
        },
        orderBy: { bookingDate: "desc" },
      })
    }

    return NextResponse.json(bookings)
  } catch (error) {
    logger.error("Failed to fetch bookings", error as Error, {
      userId: session?.user?.id,
    })
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

// POST - Create new booking
export async function POST(request: NextRequest) {
  let session: any = null
  try {
    session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting - 10 bookings per hour per user
    const rateLimitKey = `booking:${session.user.id}`
    if (!rateLimiters.booking(rateLimitKey)) {
      logger.security("Rate limit exceeded for booking creation", "medium", {
        userId: session.user.id,
        endpoint: "/api/bookings",
      })
      return NextResponse.json(
        {
          error: "För många bokningar",
          details: "Du kan göra max 10 bokningar per timme. Försök igen senare.",
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validatedData = bookingSchema.parse(body)

    // Verify service exists and belongs to provider
    const service = await prisma.service.findUnique({
      where: { id: validatedData.serviceId },
    })

    if (!service || service.providerId !== validatedData.providerId) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      )
    }

    // Check for overlapping bookings (availability validation)
    const bookingDate = new Date(validatedData.bookingDate)
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        providerId: validatedData.providerId,
        bookingDate: bookingDate,
        status: {
          in: ["pending", "confirmed"], // Don't check cancelled/rejected
        },
        // Check for time overlap using OR conditions
        OR: [
          // New booking starts during an existing booking
          {
            AND: [
              { startTime: { lte: validatedData.startTime } },
              { endTime: { gt: validatedData.startTime } },
            ],
          },
          // New booking ends during an existing booking
          {
            AND: [
              { startTime: { lt: validatedData.endTime } },
              { endTime: { gte: validatedData.endTime } },
            ],
          },
          // New booking completely contains an existing booking
          {
            AND: [
              { startTime: { gte: validatedData.startTime } },
              { endTime: { lte: validatedData.endTime } },
            ],
          },
        ],
      },
    })

    if (overlappingBookings.length > 0) {
      return NextResponse.json(
        {
          error: "Leverantören är redan bokad under den valda tiden",
          details: "Vänligen välj en annan tid eller datum",
        },
        { status: 409 } // 409 Conflict
      )
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: session.user.id,
        providerId: validatedData.providerId,
        serviceId: validatedData.serviceId,
        bookingDate: new Date(validatedData.bookingDate),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        horseName: validatedData.horseName,
        horseInfo: validatedData.horseInfo,
        customerNotes: validatedData.customerNotes,
        status: "pending",
      },
      include: {
        service: true,
        provider: {
          include: {
            user: true,
          },
        },
      },
    })

    logger.info("Booking created successfully", {
      bookingId: booking.id,
      customerId: session.user.id,
      providerId: validatedData.providerId,
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Booking validation failed", {
        userId: session?.user?.id,
        errors: error.issues,
      })
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to create booking", error as Error, {
      userId: session?.user?.id,
    })
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    )
  }
}
