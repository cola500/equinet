import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { PrismaBookingRepository } from "@/infrastructure/persistence/booking/PrismaBookingRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
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
  routeOrderId: z.string().optional(), // NEW: Link to provider announcement
}).strict()

// GET bookings for logged-in user
export async function GET(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Use repository instead of direct Prisma access
    const bookingRepo = new PrismaBookingRepository()
    let bookings

    if (session.user.userType === "provider") {
      // Use repository to find provider
      const providerRepo = new ProviderRepository()
      const provider = await providerRepo.findByUserId(session.user.id)

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      // Get bookings with customer contact info (provider view)
      bookings = await bookingRepo.findByProviderIdWithDetails(provider.id)
    } else {
      // Get bookings without provider contact info (customer view)
      bookings = await bookingRepo.findByCustomerIdWithDetails(session.user.id)
    }

    return NextResponse.json(bookings)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch bookings", error as Error, {})
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

// POST - Create new booking
export async function POST(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Rate limiting - 10 bookings per hour per user (wrapped in try-catch to prevent crashes)
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
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
    } catch (rateLimitError) {
      // If rate limiter fails, log but allow the request (fail open for availability)
      console.error("Rate limiter error:", rateLimitError)
      try {
        logger.warn("Rate limiter failed, allowing request", {
          userId: session.user.id,
          error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
        })
      } catch (logError) {
        // Even logging the warning should not crash the request
        console.error("Logger also failed:", logError)
      }
    }

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("Invalid JSON in request body:", jsonError)
      return NextResponse.json(
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

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

    // Use transaction for atomicity: check for overlaps and create booking atomically
    // This prevents race conditions where two requests check simultaneously and both create bookings
    // @ts-expect-error - Prisma transaction callback type inference issue
    const booking: any = await prisma.$transaction(async (tx) => {
      const bookingDate = new Date(validatedData.bookingDate)

      // Check for overlapping bookings within the transaction
      const overlappingBookings = await tx.booking.findMany({
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
        // Throw an error to rollback the transaction
        throw new Error("BOOKING_CONFLICT")
      }

      // Create the booking atomically
      return await tx.booking.create({
        data: {
          customerId: session.user.id,
          providerId: validatedData.providerId,
          serviceId: validatedData.serviceId,
          routeOrderId: validatedData.routeOrderId, // NEW: Link to announcement
          bookingDate: bookingDate,
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
    }, {
      timeout: 15000, // 15 second timeout for transaction
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // Prevent race conditions
    })

    // Safe logger pattern: logging errors should never crash the request
    try {
      logger.info("Booking created successfully", {
        bookingId: booking.id,
        customerId: session.user.id,
        providerId: validatedData.providerId,
      })
    } catch (logError) {
      console.error("Logger failed after successful booking:", logError)
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (err: unknown) {
    const error = err as Error

    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      try {
        logger.warn("Booking validation failed", {
          errors: error.issues,
        })
      } catch (logError) {
        console.error("Logger failed:", logError)
      }
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    // Handle booking conflict from transaction
    if (error instanceof Error && error.message === "BOOKING_CONFLICT") {
      try {
        logger.warn("Booking conflict detected", {
        })
      } catch (logError) {
        console.error("Logger failed:", logError)
      }
      return NextResponse.json(
        {
          error: "Leverantören är redan bokad under den valda tiden",
          details: "Vänligen välj en annan tid eller datum",
        },
        { status: 409 }
      )
    }

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: Unique constraint violation
      if (error.code === "P2002") {
        try {
          logger.warn("Duplicate booking attempt", {
            code: error.code,
          })
        } catch (logError) {
          console.error("Logger failed:", logError)
        }
        return NextResponse.json(
          { error: "Bokningen finns redan" },
          { status: 409 }
        )
      }

      // P2003: Foreign key constraint failed (routeOrderId invalid)
      if (error.code === "P2003") {
        try {
          logger.warn("Invalid foreign key during booking", {
            code: error.code,
          })
        } catch (logError) {
          console.error("Logger failed:", logError)
        }
        return NextResponse.json(
          { error: "RouteOrder hittades inte" },
          { status: 400 }
        )
      }

      // P2025: Record not found
      if (error.code === "P2025") {
        try {
          logger.warn("Record not found during booking", {
            code: error.code,
          })
        } catch (logError) {
          console.error("Logger failed:", logError)
        }
        return NextResponse.json(
          { error: "Tjänst eller leverantör hittades inte" },
          { status: 404 }
        )
      }

      // Other Prisma errors
      console.error("Prisma error:", error.code, error.message)
      return NextResponse.json(
        { error: "Databasfel uppstod" },
        { status: 500 }
      )
    }

    // Handle Prisma initialization errors (database connection issues)
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error("Database connection failed:", error.message)
      try {
        logger.fatal("Database unavailable during booking", {})
      } catch (logError) {
        console.error("Logger failed:", logError)
      }
      return NextResponse.json(
        { error: "Databasen är inte tillgänglig" },
        { status: 503 }
      )
    }

    // Handle query timeout errors
    if (error instanceof Error && error.message.includes("Query timeout")) {
      console.error("Query timeout:", error.message)
      try {
        logger.error("Booking query timeout", error, {})
      } catch (logError) {
        console.error("Logger failed:", logError)
      }
      return NextResponse.json(
        { error: "Förfrågan tok för lång tid", details: "Försök igen" },
        { status: 504 }
      )
    }

    // Generic error fallback
    console.error("Unexpected error during booking:", error)
    try {
      logger.error("Failed to create booking", error as Error, {})
    } catch (logError) {
      console.error("Logger failed:", logError)
    }
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    )
  }
}
