import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters } from "@/lib/rate-limit"
import { parseDate } from "@/lib/date-utils"
import { logger } from "@/lib/logger"

/**
 * GET /api/providers/[id]/availability-exceptions/[date]
 * Hämta ett specifikt undantag för ett datum
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    const { id: providerId, date } = await params

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Ogiltigt datumformat. Använd ÅÅÅÅ-MM-DD" },
        { status: 400 }
      )
    }

    const exception = await prisma.availabilityException.findUnique({
      where: {
        providerId_date: {
          providerId,
          date: parseDate(date),
        },
      },
    })

    if (!exception) {
      return NextResponse.json(
        { error: "Undantag hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...exception,
      date: exception.date.toISOString().split("T")[0],
    })
  } catch (error) {
    logger.error("Error fetching availability exception", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}

/**
 * DELETE /api/providers/[id]/availability-exceptions/[date]
 * Ta bort ett datumbaserat undantag
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  try {
    // Auth
    const session = await auth()

    // Provider check
    if (session.user.userType !== "provider") {
      return new Response("Bara leverantörer kan ta bort tillgänglighetsundantag", { status: 403 })
    }

    // Rate limiting
    const isAllowed = await rateLimiters.profileUpdate(session.user.id)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Vänta en stund innan du gör fler ändringar." },
        { status: 429 }
      )
    }

    const { id: providerId, date } = await params

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Ogiltigt datumformat. Använd ÅÅÅÅ-MM-DD" },
        { status: 400 }
      )
    }

    // Authorization check - verify the provider owns this profile
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    })

    if (!provider || provider.userId !== session.user.id) {
      return new Response("Åtkomst nekad - inte din leverantörsprofil", { status: 403 })
    }

    // Delete exception
    const deleted = await prisma.availabilityException.delete({
      where: {
        providerId_date: {
          providerId,
          date: parseDate(date),
        },
      },
    })

    return NextResponse.json({
      message: "Undantag borttaget",
      date: deleted.date.toISOString().split("T")[0],
    })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    // Check if exception doesn't exist
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Undantag hittades inte" },
        { status: 404 }
      )
    }

    logger.error("Error deleting availability exception", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internt serverfel", { status: 500 })
  }
}
