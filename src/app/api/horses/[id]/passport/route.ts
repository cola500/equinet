import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { randomBytes } from "crypto"

type RouteContext = { params: Promise<{ id: string }> }

const PASSPORT_EXPIRY_DAYS = 30

/**
 * Generate a URL-safe random token for passport sharing.
 */
function generatePassportToken(): string {
  return randomBytes(32).toString("hex")
}

// POST /api/horses/[id]/passport - Create a shareable passport link
export async function POST(request: NextRequest, context: RouteContext) {
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

    // IDOR protection: verify ownership
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

    const token = generatePassportToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PASSPORT_EXPIRY_DAYS)

    const passportToken = await prisma.horsePassportToken.create({
      data: {
        horseId,
        token,
        expiresAt,
      },
    })

    // Build the public URL
    const baseUrl = request.headers.get("x-forwarded-host")
      ? `https://${request.headers.get("x-forwarded-host")}`
      : new URL(request.url).origin
    const url = `${baseUrl}/passport/${passportToken.token}`

    logger.info("Passport token created", {
      horseId,
      tokenId: passportToken.id,
      userId: session.user.id,
      expiresAt: expiresAt.toISOString(),
    })

    return NextResponse.json(
      {
        token: passportToken.token,
        url,
        expiresAt: passportToken.expiresAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to create passport token", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa hästpass-länk" },
      { status: 500 }
    )
  }
}
