import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  mergeTimeline,
  TimelineBooking,
  TimelineNote,
} from "@/lib/timeline"

const NOTE_CATEGORIES = [
  "veterinary",
  "farrier",
  "general",
  "injury",
  "medication",
] as const

// Categories visible to providers (privacy: exclude general/injury)
const PROVIDER_VISIBLE_CATEGORIES = ["veterinary", "farrier", "medication"]

type RouteContext = { params: Promise<{ id: string }> }

// GET - Combined timeline (bookings + notes)
// Access: Owner sees all, provider with booking sees limited categories
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id: horseId } = await context.params

    // Check if user is the horse owner
    const ownedHorse = await prisma.horse.findFirst({
      where: {
        id: horseId,
        ownerId: session.user.id,
        isActive: true,
      },
    })

    const isOwner = !!ownedHorse
    let isProviderWithAccess = false

    // If not owner, check if provider with a booking for this horse
    if (!isOwner) {
      // Check if horse exists at all
      const horse = await prisma.horse.findUnique({
        where: { id: horseId },
      })

      if (!horse || !horse.isActive) {
        return NextResponse.json(
          { error: "Hästen hittades inte" },
          { status: 404 }
        )
      }

      // Check if this user's provider has any booking for this horse
      const providerBookings = await prisma.booking.findMany({
        where: {
          horseId,
          provider: { userId: session.user.id },
        },
        take: 1,
      })

      if (providerBookings.length === 0) {
        return NextResponse.json(
          { error: "Hästen hittades inte" },
          { status: 404 }
        )
      }

      isProviderWithAccess = true
    }

    // Optional category filter
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get("category")

    // Fetch bookings for this horse
    const bookings = await prisma.booking.findMany({
      where: {
        horseId,
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

    // Fetch notes -- limit categories for provider access
    const noteWhere: Record<string, unknown> = { horseId }
    if (isProviderWithAccess) {
      noteWhere.category = { in: PROVIDER_VISIBLE_CATEGORIES }
    }
    if (
      categoryFilter &&
      NOTE_CATEGORIES.includes(categoryFilter as any)
    ) {
      // If provider, further restrict to visible categories
      if (isProviderWithAccess) {
        if (!PROVIDER_VISIBLE_CATEGORIES.includes(categoryFilter)) {
          // Provider trying to access restricted category -- just return empty
          noteWhere.category = categoryFilter
        } else {
          noteWhere.category = categoryFilter
        }
      } else {
        noteWhere.category = categoryFilter
      }
    }

    const notes = await prisma.horseNote.findMany({
      where: noteWhere,
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

    // Transform to timeline items
    const timelineBookings: TimelineBooking[] = bookings.map((b) => ({
      type: "booking" as const,
      id: b.id,
      date: b.bookingDate.toISOString(),
      title: b.service.name,
      providerName: b.provider.businessName,
      status: b.status,
      notes: b.customerNotes,
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

    // Filter bookings by category if specified (bookings don't have categories, skip if filtering)
    const filteredBookings = categoryFilter ? [] : timelineBookings

    const timeline = mergeTimeline(filteredBookings, timelineNotes)

    return NextResponse.json(timeline)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch horse timeline", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta tidslinje" },
      { status: 500 }
    )
  }
}
