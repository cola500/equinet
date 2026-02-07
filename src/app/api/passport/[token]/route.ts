import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { mergeTimeline, TimelineBooking, TimelineNote } from "@/lib/timeline"

type RouteContext = { params: Promise<{ token: string }> }

// Categories visible in public passport (privacy: exclude general/injury)
const PUBLIC_VISIBLE_CATEGORIES = ["veterinary", "farrier", "medication"]

// GET /api/passport/[token] - Public horse passport (no auth required)
export async function GET(request: NextRequest, context: RouteContext) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { token } = await context.params

    // Find token with horse data
    const passportToken = await prisma.horsePassportToken.findUnique({
      where: { token },
      include: {
        horse: true,
      },
    })

    if (!passportToken) {
      return NextResponse.json(
        { error: "Hästpasset hittades inte" },
        { status: 404 }
      )
    }

    // Check expiry
    if (new Date() > passportToken.expiresAt) {
      return NextResponse.json(
        { error: "Hästpasslänken är utgången. Be ägaren skapa en ny." },
        { status: 404 }
      )
    }

    // Check if horse is still active
    if (!passportToken.horse.isActive) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    const horse = passportToken.horse

    // Fetch completed bookings for timeline
    const bookings = await prisma.booking.findMany({
      where: {
        horseId: horse.id,
        status: "completed",
      },
      select: {
        id: true,
        bookingDate: true,
        status: true,
        customerNotes: true,
        service: { select: { name: true } },
        provider: { select: { businessName: true } },
      },
      orderBy: { bookingDate: "desc" },
    })

    // Fetch notes (only public-safe categories)
    const notes = await prisma.horseNote.findMany({
      where: {
        horseId: horse.id,
        category: { in: PUBLIC_VISIBLE_CATEGORIES },
      },
      select: {
        id: true,
        category: true,
        title: true,
        content: true,
        noteDate: true,
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { noteDate: "desc" },
    })

    // Build timeline
    const timelineBookings: TimelineBooking[] = bookings.map((b) => ({
      type: "booking" as const,
      id: b.id,
      date: b.bookingDate.toISOString(),
      title: b.service.name,
      providerName: b.provider.businessName,
      status: b.status,
      notes: b.customerNotes,
      providerNotes: null, // Public view - no provider notes
    }))

    const timelineNotes: TimelineNote[] = notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      date: n.noteDate.toISOString(),
      title: n.title,
      category: n.category,
      content: n.content,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
    }))

    const timeline = mergeTimeline(timelineBookings, timelineNotes)

    // Calculate age from birthYear
    const currentYear = new Date().getFullYear()
    const age = horse.birthYear ? currentYear - horse.birthYear : null

    logger.info("Passport viewed", {
      horseId: horse.id,
      tokenId: passportToken.id,
    })

    return NextResponse.json({
      horse: {
        name: horse.name,
        breed: horse.breed,
        birthYear: horse.birthYear,
        age,
        color: horse.color,
        gender: horse.gender,
        specialNeeds: horse.specialNeeds,
      },
      timeline,
      expiresAt: passportToken.expiresAt.toISOString(),
    })
  } catch (error) {
    logger.error("Failed to fetch passport data", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta hästpassdata" },
      { status: 500 }
    )
  }
}
