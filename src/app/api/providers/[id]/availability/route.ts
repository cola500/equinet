import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      )
    }

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
    const dayOfWeek = (bookingDate.getDay() + 6) % 7 // Convert JS day (0=Sunday) to our format (0=Monday)

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
        bookedSlots: [],
      })
    }

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
        startTime: true,
        endTime: true,
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

    return NextResponse.json({
      date,
      dayOfWeek,
      isClosed: false,
      openingTime: availability.startTime,
      closingTime: availability.endTime,
      bookedSlots: bookings.map((b: { startTime: string; endTime: string; service: { name: string } }) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        serviceName: b.service.name,
      })),
    })
  } catch (error) {
    console.error("Error fetching availability:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}
