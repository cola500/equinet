/**
 * DELETE /api/native/calendar/exceptions/[date] - Delete availability exception
 *
 * Auth: Bearer token (mobile token).
 * Deletes an availability exception for the authenticated provider.
 */
import { NextRequest, NextResponse } from "next/server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { parseDate } from "@/lib/date-utils"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    // 1. Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Find provider for this user
    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Validate date format
    const { date } = await params
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Ogiltigt datumformat" },
        { status: 400 }
      )
    }

    // 5. Delete exception
    const deleted = await prisma.availabilityException.delete({
      where: {
        providerId_date: {
          providerId: provider.id,
          date: parseDate(date),
        },
      },
    })

    logger.info("Native calendar exception deleted", {
      userId: authResult.userId,
      providerId: provider.id,
      date,
    })

    return NextResponse.json({
      message: "Undantag borttaget",
      date: deleted.date.toISOString().split("T")[0],
    })
  } catch (error) {
    // Handle P2025 (record not found)
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

    logger.error("Failed to delete native calendar exception", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
