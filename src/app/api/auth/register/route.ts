import { NextRequest, NextResponse } from "next/server"
import { rateLimiters } from "@/lib/rate-limit"
import { registerSchema } from "@/lib/validations/auth"
import { sanitizeEmail, sanitizeString, sanitizePhone } from "@/lib/sanitize"
import { createAuthService } from "@/domain/auth/AuthService"
import { mapAuthErrorToStatus } from "@/domain/auth/mapAuthErrorToStatus"
import { z } from "zod"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - Check IP address (before JSON parsing to prevent spam)
    const identifier = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    const isAllowed = await rateLimiters.registration(identifier)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många registreringsförsök. Försök igen om en timme." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // Validera input
    const validatedData = registerSchema.parse(body)

    // Sanitize all user inputs
    const sanitizedEmail = sanitizeEmail(validatedData.email)
    const sanitizedFirstName = sanitizeString(validatedData.firstName)
    const sanitizedLastName = sanitizeString(validatedData.lastName)
    const sanitizedPhone = validatedData.phone ? sanitizePhone(validatedData.phone) : undefined
    const sanitizedBusinessName = validatedData.businessName
      ? sanitizeString(validatedData.businessName)
      : undefined
    const sanitizedDescription = validatedData.description
      ? sanitizeString(validatedData.description)
      : undefined
    const sanitizedCity = validatedData.city ? sanitizeString(validatedData.city) : undefined

    // Delegate to AuthService
    const service = createAuthService()
    const result = await service.register({
      email: sanitizedEmail,
      password: validatedData.password,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      phone: sanitizedPhone,
      userType: validatedData.userType,
      businessName: sanitizedBusinessName,
      description: sanitizedDescription,
      city: sanitizedCity,
    })

    const genericMessage = "Om registreringen lyckades skickas ett verifieringsmail till din email."

    if (result.isFailure) {
      if (result.error.type === 'EMAIL_ALREADY_EXISTS') {
        logger.warn("Registration attempt with existing email", { email: sanitizedEmail })
        return NextResponse.json({ message: genericMessage })
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: mapAuthErrorToStatus(result.error) }
      )
    }

    return NextResponse.json({ message: genericMessage })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Registreringsfel", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Något gick fel vid registrering" },
      { status: 500 }
    )
  }
}
