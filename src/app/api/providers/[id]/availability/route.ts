import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { TravelTimeService, BookingWithLocation } from "@/domain/booking/TravelTimeService"
import { Location } from "@/domain/shared/Location"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

interface SlotWithReason {
  startTime: string
  endTime: string
  isAvailable: boolean
  unavailableReason?: "booked" | "travel-time" | "past"
}

/**
 * Convert "HH:mm" string to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes from midnight to "HH:mm" string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2
}

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
        { error: "Date parameter is required" },
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
        { error: "Provider not found" },
        { status: 404 }
      )
    }

    // Get day of week for the date (0 = Monday, 6 = Sunday)
    const bookingDate = new Date(date)
    const dayOfWeek = (bookingDate.getDay() + 6) % 7

    // Get availability schedule for this day of week
    const availability = await prisma.availability.findFirst({
      where: {
        providerId,
        dayOfWeek,
        isActive: true,
      },
    })

    // If provider is closed this day, return that info
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

    // Get all confirmed/pending bookings for the provider on that date
    // Include customer location for travel time calculation
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

    // Create TravelTimeService instance
    const travelTimeService = new TravelTimeService()

    // Convert bookings to BookingWithLocation format for TravelTimeService
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

    // Create customer location if provided
    let customerLocation: Location | undefined
    if (customerLatitude !== null && customerLongitude !== null) {
      const locationResult = Location.create(customerLatitude, customerLongitude)
      if (locationResult.isSuccess) {
        customerLocation = locationResult.value
      }
    }

    // Generate slots with availability status
    const openingMinutes = timeToMinutes(availability.startTime)
    const closingMinutes = timeToMinutes(availability.endTime)
    const slots: SlotWithReason[] = []

    // Get current time for past slot filtering
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate())
    const isPastDay = bookingDay < today
    const isToday = bookingDay.getTime() === today.getTime()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // Generate slots at serviceDuration intervals
    for (
      let startMinutes = openingMinutes;
      startMinutes + serviceDurationMinutes <= closingMinutes;
      startMinutes += serviceDurationMinutes
    ) {
      const endMinutes = startMinutes + serviceDurationMinutes
      const startTime = minutesToTime(startMinutes)
      const endTime = minutesToTime(endMinutes)

      // Check if slot is in the past (entire day passed or today's past slots)
      if (isPastDay || (isToday && startMinutes < currentMinutes)) {
        slots.push({
          startTime,
          endTime,
          isAvailable: false,
          unavailableReason: "past",
        })
        continue
      }

      // Check if this slot overlaps with any booked slot
      const isBookedConflict = bookings.some((booked) => {
        const bookedStart = timeToMinutes(booked.startTime)
        const bookedEnd = timeToMinutes(booked.endTime)
        return rangesOverlap(startMinutes, endMinutes, bookedStart, bookedEnd)
      })

      if (isBookedConflict) {
        slots.push({
          startTime,
          endTime,
          isAvailable: false,
          unavailableReason: "booked",
        })
        continue
      }

      // Check travel time if customer location is provided and there are existing bookings
      if (customerLocation && existingBookingsWithLocation.length > 0) {
        const hypotheticalBooking: BookingWithLocation = {
          id: "hypothetical",
          startTime,
          endTime,
          location: customerLocation,
        }

        const travelTimeResult = travelTimeService.hasEnoughTravelTime(
          hypotheticalBooking,
          existingBookingsWithLocation
        )

        if (!travelTimeResult.valid) {
          slots.push({
            startTime,
            endTime,
            isAvailable: false,
            unavailableReason: "travel-time",
          })
          continue
        }
      }

      // Slot is available
      slots.push({
        startTime,
        endTime,
        isAvailable: true,
      })
    }

    return NextResponse.json({
      date,
      dayOfWeek,
      isClosed: false,
      openingTime: availability.startTime,
      closingTime: availability.endTime,
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
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}
