import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { objectsToCsv, flattenBookings, flattenNotes } from "@/lib/export-utils"
import { mergeTimeline, TimelineBooking, TimelineNote } from "@/lib/timeline"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/horses/[id]/export - Export horse data with full timeline
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
    const session = await auth()
    const { id: horseId } = await context.params

    // IDOR protection: verify ownership in WHERE clause
    const horse = await prisma.horse.findFirst({
      where: {
        id: horseId,
        ownerId: session.user.id,
        isActive: true,
      },
    })

    if (!horse) {
      return NextResponse.json(
        { error: "Hästen hittades inte" },
        { status: 404 }
      )
    }

    // Fetch bookings for this horse
    const bookings = await prisma.booking.findMany({
      where: { horseId },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        customerNotes: true,
        service: { select: { name: true } },
        provider: { select: { businessName: true } },
        horse: { select: { name: true } },
      },
      orderBy: { bookingDate: "desc" },
    })

    // Fetch notes for this horse
    const notes = await prisma.horseNote.findMany({
      where: { horseId },
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

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format")

    logger.info("Horse data export", {
      horseId,
      userId: session.user.id,
      format: format || "json",
    })

    if (format === "csv") {
      const flatBookings = flattenBookings(bookings)
      const flatNotes = flattenNotes(notes, horse.name)

      let csvContent = `# Häst: ${horse.name}\n`
      csvContent += `# Ras: ${horse.breed || "-"}\n`
      csvContent += `# Födelseår: ${horse.birthYear || "-"}\n\n`
      csvContent += "# Bokningar\n"
      csvContent += objectsToCsv(flatBookings as unknown as Record<string, unknown>[])
      csvContent += "\n\n# Anteckningar\n"
      csvContent += objectsToCsv(flatNotes as unknown as Record<string, unknown>[])

      const filename = `${horse.name.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, "-")}-export-${new Date().toISOString().split("T")[0]}.csv`

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // JSON format (default)
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      horse: {
        name: horse.name,
        breed: horse.breed,
        birthYear: horse.birthYear,
        color: horse.color,
        gender: horse.gender,
        specialNeeds: horse.specialNeeds,
      },
      bookings,
      notes,
      timeline,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to export horse data", error as Error)
    return NextResponse.json(
      { error: "Kunde inte exportera hästdata" },
      { status: 500 }
    )
  }
}
