import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/route-orders/[id]/bookings
 *
 * Returns bookings for a specific route announcement.
 * Only the owning provider can access this endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Only providers can access this endpoint
    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Endast leverantörer kan se bokningar på annonser" },
        { status: 403 }
      )
    }

    // Get the announcement ID from params
    const { id: announcementId } = await params

    // Find the provider profile
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider-profil hittades inte" },
        { status: 404 }
      )
    }

    // Verify the announcement exists and belongs to this provider
    const announcement = await prisma.routeOrder.findUnique({
      where: { id: announcementId },
      select: {
        id: true,
        providerId: true,
        announcementType: true,
        serviceType: true,
        dateFrom: true,
        dateTo: true,
        status: true,
      }
    })

    if (!announcement) {
      return NextResponse.json(
        { error: "Annons hittades inte" },
        { status: 404 }
      )
    }

    if (announcement.providerId !== provider.id) {
      return NextResponse.json(
        { error: "Du har inte behörighet att se bokningar för denna annons" },
        { status: 403 }
      )
    }

    if (announcement.announcementType !== "provider_announced") {
      return NextResponse.json(
        { error: "Detta är inte en leverantörs-annons" },
        { status: 400 }
      )
    }

    // Fetch bookings linked to this announcement
    const bookings = await prisma.booking.findMany({
      where: {
        routeOrderId: announcementId,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
          }
        },
      },
      orderBy: [
        { bookingDate: 'asc' },
        { startTime: 'asc' },
      ],
    })

    // Return announcement info along with bookings
    return NextResponse.json({
      announcement: {
        id: announcement.id,
        serviceType: announcement.serviceType,
        dateFrom: announcement.dateFrom,
        dateTo: announcement.dateTo,
        status: announcement.status,
      },
      bookings: bookings.map(booking => ({
        id: booking.id,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        horseName: booking.horseName,
        horseInfo: booking.horseInfo,
        customerNotes: booking.customerNotes,
        customer: {
          id: booking.customer.id,
          name: `${booking.customer.firstName} ${booking.customer.lastName}`,
          email: booking.customer.email,
          phone: booking.customer.phone,
        },
        service: booking.service,
        createdAt: booking.createdAt,
      })),
      totalBookings: bookings.length,
    })

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error fetching announcement bookings:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta bokningar" },
      { status: 500 }
    )
  }
}
