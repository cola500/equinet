import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import {
  objectsToCsv,
  flattenBookings,
  flattenNotes,
  flattenUserProfile,
  flattenHorses,
  flattenReviews,
  flattenProvider,
  flattenProviderServices,
} from "@/lib/export-utils"

// GET /api/export/my-data - Export all user data (GDPR Art 20)
export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()
    const userId = session.user.id
    const isProvider = session.user.userType === "provider"

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") // "json" (default) or "csv"

    // Fetch user profile (excluding sensitive fields)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        userType: true,
        city: true,
        address: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Användare hittades inte" },
        { status: 404 }
      )
    }

    // Fetch horses (for customers)
    const horses = await prisma.horse.findMany({
      where: { ownerId: userId, isActive: true },
      select: {
        id: true,
        name: true,
        breed: true,
        birthYear: true,
        color: true,
        gender: true,
        specialNeeds: true,
        registrationNumber: true,
        microchipNumber: true,
        createdAt: true,
      },
    })

    // Fetch bookings
    const bookings = await prisma.booking.findMany({
      where: isProvider
        ? { provider: { userId } }
        : { customerId: userId },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        customerNotes: true,
        horseName: true,
        service: { select: { name: true } },
        provider: { select: { businessName: true } },
        horse: { select: { name: true } },
      },
      orderBy: { bookingDate: "desc" },
    })

    // Fetch horse notes (authored by this user)
    const horseNotes = await prisma.horseNote.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        noteDate: true,
        horse: { select: { name: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { noteDate: "desc" },
    })

    // Fetch reviews (written by this user)
    const reviews = await prisma.review.findMany({
      where: isProvider
        ? { providerId: (session.user as any).providerId }
        : { customerId: userId },
      select: {
        id: true,
        rating: true,
        comment: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
        provider: { select: { businessName: true } },
        booking: {
          select: {
            bookingDate: true,
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Fetch provider-specific data if applicable
    let provider = null
    if (isProvider && (session.user as any).providerId) {
      provider = await prisma.provider.findUnique({
        where: { id: (session.user as any).providerId },
        select: {
          id: true,
          businessName: true,
          description: true,
          address: true,
          city: true,
          postalCode: true,
          serviceAreaKm: true,
          isVerified: true,
          createdAt: true,
          services: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              durationMinutes: true,
              isActive: true,
            },
          },
        },
      })
    }

    logger.info("Data export requested", {
      userId,
      format: format || "json",
      userType: session.user.userType,
    })

    // CSV format -- all sections
    if (format === "csv") {
      const cast = (obj: unknown) => obj as Record<string, unknown>
      const castArr = (arr: unknown[]) => arr as Record<string, unknown>[]

      let csvContent = "# Profil\n"
      csvContent += objectsToCsv([cast(flattenUserProfile(user))])

      csvContent += "\n\n# Hästar\n"
      csvContent += objectsToCsv(castArr(flattenHorses(horses)))

      csvContent += "\n\n# Bokningar\n"
      csvContent += objectsToCsv(castArr(flattenBookings(bookings)))

      csvContent += "\n\n# Anteckningar\n"
      csvContent += objectsToCsv(castArr(flattenNotes(horseNotes)))

      csvContent += "\n\n# Recensioner\n"
      csvContent += objectsToCsv(castArr(flattenReviews(reviews)))

      if (provider) {
        const { services, ...providerData } = provider
        csvContent += "\n\n# Leverantör\n"
        csvContent += objectsToCsv([cast(flattenProvider(providerData))])

        csvContent += "\n\n# Tjänster\n"
        csvContent += objectsToCsv(castArr(flattenProviderServices(services)))
      }

      const filename = `equinet-export-${new Date().toISOString().split("T")[0]}.csv`

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // JSON format (default)
    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      horses,
      bookings,
      horseNotes,
      reviews,
      ...(provider ? { provider } : {}),
    }

    return NextResponse.json(exportData)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to export user data", error as Error)
    return NextResponse.json(
      { error: "Kunde inte exportera data" },
      { status: 500 }
    )
  }
}
