import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { objectsToCsv, flattenBookings, flattenNotes } from "@/lib/export-utils"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

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

    const service = createHorseService()
    const result = await service.exportData(horseId, session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    const { horse, bookings, notes, timeline } = result.value

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
      horse,
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
