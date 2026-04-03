/**
 * POST /api/native/bookings/[id]/quick-note - Save provider notes on a booking
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 * Domain rules: booking must be confirmed or completed, owned by provider.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

const quickNoteSchema = z.object({
  providerNotes: z.string().trim().min(1, "Anteckning kan inte vara tom").max(2000, "Anteckning kan vara max 2000 tecken"),
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params

    // 1. Auth (dual-auth)
    const authUser = await getAuthUser(request)
    if (!authUser) {
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

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Parse and validate body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = quickNoteSchema.parse(body)

    // 5. Find booking with ownership check
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokning hittades inte" },
        { status: 404 }
      )
    }

    if (booking.providerId !== provider.id) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    if (booking.status !== "confirmed" && booking.status !== "completed") {
      return NextResponse.json(
        { error: "Anteckningar kan bara läggas till på bekräftade eller genomförda bokningar" },
        { status: 400 }
      )
    }

    // 6. Update booking with provider notes
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { providerNotes: validated.providerNotes },
      select: { providerNotes: true },
    })

    logger.info("Native quick note saved", {
      bookingId,
      providerId: provider.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error saving quick note", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte spara anteckning" },
      { status: 500 }
    )
  }
}
