import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { TravelTimeService, BookingWithLocation } from "@/domain/booking/TravelTimeService"
import { Location } from "@/domain/shared/Location"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { calculateAvailableSlots } from "@/lib/utils/slotCalculator"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting: 100 requests per minute per IP
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { id: providerId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const customerLat = searchParams.get("lat")
    const customerLng = searchParams.get("lng")
    const serviceDurationParam = searchParams.get("serviceDuration")

    if (!date) {
      return NextResponse.json(
        { error: "Datumparameter krävs" },
        { status: 400 }
      )
    }

    // Parse optional parameters
    const hasCustomerLocation = customerLat && customerLng
    const customerLatitude = hasCustomerLocation ? parseFloat(customerLat) : null
    const customerLongitude = hasCustomerLocation ? parseFloat(customerLng) : null
    const serviceDurationMinutes = serviceDurationParam ? parseInt(serviceDurationParam, 10) : 30

    // Verify provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // Get day of week for the date (0 = Monday, 6 = Sunday)
    const bookingDate = new Date(date)
    const dayOfWeek = (bookingDate.getDay() + 6) % 7

    // Check for availability exception (closed day / alternative hours)
    const exception = await prisma.availabilityException.findUnique({
      where: { providerId_date: { providerId, date: bookingDate } },
      select: {
        isClosed: true,
        reason: true,
        startTime: true,
        endTime: true,
      },
    })

    // If provider has explicitly closed this day, return immediately
    if (exception?.isClosed) {
      return NextResponse.json({
        date,
        dayOfWeek,
        isClosed: true,
        closedReason: exception.reason || null,
        openingTime: null,
        closingTime: null,
        slots: [],
        bookedSlots: [],
      })
    }

    // Get availability schedule for this day of week
    const availability = await prisma.availability.findFirst({
      where: {
        providerId,
        dayOfWeek,
        isActive: true,
      },
    })

    // If provider is closed this day (no weekly schedule), return that info
    if (!availability || availability.isClosed) {
      return NextResponse.json({
        date,
        dayOfWeek,
        isClosed: true,
        openingTime: null,
        closingTime: null,
        slots: [],
        bookedSlots: [],
      })
    }

    // Use exception's alternative hours if available, otherwise weekly schedule
    const openingTime = (exception?.startTime) || availability.startTime
    const closingTime = (exception?.endTime) || availability.endTime

    // Get all confirmed/pending bookings for the provider on that date
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        bookingDate,
        status: {
          in: ["pending", "confirmed"],
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        customer: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    })

    // Prepare travel-time callback if customer location is provided
    let checkTravelTime: ((startTime: string, endTime: string) => boolean) | undefined

    if (customerLatitude !== null && customerLongitude !== null) {
      const customerLocationResult = Location.create(customerLatitude, customerLongitude)

      if (customerLocationResult.isSuccess && bookings.length > 0) {
        const customerLocation = customerLocationResult.value
        const travelTimeService = new TravelTimeService()

        // Build BookingWithLocation array for TravelTimeService
        const existingBookingsWithLocation: BookingWithLocation[] = bookings.map((b) => {
          let location: Location | undefined
          if (b.customer.latitude && b.customer.longitude) {
            const locationResult = Location.create(b.customer.latitude, b.customer.longitude)
            if (locationResult.isSuccess) {
              location = locationResult.value
            }
          }
          return {
            id: b.id,
            startTime: b.startTime,
            endTime: b.endTime,
            location,
          }
        })

        checkTravelTime = (startTime: string, endTime: string) => {
          const hypotheticalBooking: BookingWithLocation = {
            id: "hypothetical",
            startTime,
            endTime,
            location: customerLocation,
          }
          const result = travelTimeService.hasEnoughTravelTime(
            hypotheticalBooking,
            existingBookingsWithLocation
          )
          return !result.valid
        }
      }
    }

    // Generate slots using shared calculator
    const slots = calculateAvailableSlots({
      openingTime,
      closingTime,
      bookedSlots: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      serviceDurationMinutes,
      date,
      currentDateTime: new Date(),
      checkTravelTime,
    })

    return NextResponse.json({
      date,
      dayOfWeek,
      isClosed: false,
      openingTime,
      closingTime,
      slots,
      // Keep bookedSlots for backwards compatibility
      bookedSlots: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        serviceName: b.service.name,
      })),
    })
  } catch (error) {
    logger.error("Error fetching availability", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta tillgänglighet" },
      { status: 500 }
    )
  }
}
