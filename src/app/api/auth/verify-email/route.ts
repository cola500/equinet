import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token krävs"),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate input
    const result = verifyEmailSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: result.error.issues },
        { status: 400 }
      )
    }

    const { token } = result.data

    // Find the token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Ogiltig eller utgången verifieringslänk" },
        { status: 400 }
      )
    }

    // Check if already used
    if (verificationToken.usedAt) {
      return NextResponse.json(
        { error: "Denna verifieringslänk har redan använts" },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date() > verificationToken.expiresAt) {
      return NextResponse.json(
        { error: "Verifieringslänken har gått ut. Begär en ny." },
        { status: 400 }
      )
    }

    // Update user and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      message: "E-postadressen har verifierats",
      email: verificationToken.user.email,
    })
  } catch (error) {
    logger.error("Verify email error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel vid verifiering" },
      { status: 500 }
    )
  }
}
