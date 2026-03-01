import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"
import { z } from "zod"
import bcrypt from "bcrypt"

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(/[A-Z]/, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(/[a-z]/, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(/[0-9]/, "Lösenordet måste innehålla minst en siffra")
    .regex(/[^A-Za-z0-9]/, "Lösenordet måste innehålla minst ett specialtecken"),
}).strict()

// POST /api/auth/accept-invite -- Unauthenticated endpoint
export async function POST(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("customer_invite"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = acceptInviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

    // Find token with user info
    const inviteToken = await prisma.customerInviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            email: true,
            firstName: true,
            isManualCustomer: true,
          },
        },
      },
    })

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Ogiltig eller utgången inbjudningslänk" },
        { status: 400 }
      )
    }

    if (inviteToken.usedAt) {
      return NextResponse.json(
        { error: "Denna inbjudningslänk har redan använts" },
        { status: 400 }
      )
    }

    if (new Date() > inviteToken.expiresAt) {
      return NextResponse.json(
        { error: "Inbjudningslänken har gått ut. Be leverantören skicka en ny." },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Atomic: upgrade user + mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: inviteToken.userId },
        data: {
          passwordHash,
          isManualCustomer: false,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.customerInviteToken.update({
        where: { id: inviteToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    logger.info("Ghost user upgraded via invite", {
      userId: inviteToken.userId,
      email: inviteToken.user.email,
    })

    return NextResponse.json({ message: "Ditt konto har aktiverats" })
  } catch (error) {
    logger.error(
      "Failed to accept invite",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte aktivera kontot" },
      { status: 500 }
    )
  }
}
