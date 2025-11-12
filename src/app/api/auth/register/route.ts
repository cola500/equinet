import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { rateLimiters } from "@/lib/rate-limit"
import { registerSchema } from "@/lib/validations/auth"
import { sanitizeEmail, sanitizeString, sanitizePhone } from "@/lib/sanitize"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Rate limiting - Check IP address
    const identifier = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'

    if (!rateLimiters.registration(identifier)) {
      return NextResponse.json(
        { error: "För många registreringsförsök. Försök igen om en timme." },
        { status: 429 }
      )
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

    // Kolla om användaren redan finns
    const existingUser = await prisma.user.findUnique({
      where: {
        email: sanitizedEmail
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "En användare med denna email finns redan" },
        { status: 400 }
      )
    }

    // Hasha lösenord (already validated by Zod)
    const passwordHash = await bcrypt.hash(validatedData.password, 10)

    // Skapa användare
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        passwordHash,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        phone: sanitizedPhone,
        userType: validatedData.userType,
      }
    })

    // Om användaren är en leverantör, skapa även leverantörsprofil
    if (validatedData.userType === "provider" && sanitizedBusinessName) {
      await prisma.provider.create({
        data: {
          userId: user.id,
          businessName: sanitizedBusinessName,
          description: sanitizedDescription,
          city: sanitizedCity,
        }
      })
    }

    return NextResponse.json(
      {
        message: "Användare skapad",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType
        }
      },
      { status: 201 }
    )

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Registreringsfel:", error)
    return NextResponse.json(
      { error: "Något gick fel vid registrering" },
      { status: 500 }
    )
  }
}
