import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { sendEmailVerificationNotification } from "@/lib/email"
import { z } from "zod"
import { randomBytes } from "crypto"
import { logger } from "@/lib/logger"

const resendSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const clientIP = getClientIP(request)
    const isAllowed = await rateLimiters.resendVerification(clientIP)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många försök. Vänta 15 minuter innan du försöker igen." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validate input
    const result = resendSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: result.error.issues },
        { status: 400 }
      )
    }

    const { email } = result.data

    // Always return success to prevent email enumeration
    // But only actually send email if user exists and is not verified
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        email: true,
        emailVerified: true,
      },
    })

    if (user && !user.emailVerified) {
      // Generate new token
      const token = randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Create new token
      await prisma.emailVerificationToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      })

      // Send email (non-blocking)
      sendEmailVerificationNotification(user.email, user.firstName, token).catch(
        (error) => logger.error("Failed to send verification email", error instanceof Error ? error : new Error(String(error)))
      )
    }

    // Always return same response to prevent email enumeration
    return NextResponse.json({
      message:
        "Om e-postadressen finns i vårt system och inte redan är verifierad, har vi skickat ett nytt verifieringsmail.",
    })
  } catch (error) {
    logger.error("Resend verification error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel. Försök igen senare." },
      { status: 500 }
    )
  }
}
