import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email("Ogiltig email"),
  password: z.string().min(6, "Lösenordet måste vara minst 6 tecken"),
  firstName: z.string().min(1, "Förnamn krävs"),
  lastName: z.string().min(1, "Efternamn krävs"),
  phone: z.string().optional(),
  userType: z.enum(["customer", "provider"], {
    errorMap: () => ({ message: "Användartyp måste vara 'customer' eller 'provider'" })
  }),
  // Provider-specifika fält (endast om userType är 'provider')
  businessName: z.string().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validera input
    const validatedData = registerSchema.parse(body)

    // Kolla om användaren redan finns
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "En användare med denna email finns redan" },
        { status: 400 }
      )
    }

    // Hasha lösenord
    const passwordHash = await bcrypt.hash(validatedData.password, 10)

    // Skapa användare
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        userType: validatedData.userType,
      }
    })

    // Om användaren är en leverantör, skapa även leverantörsprofil
    if (validatedData.userType === "provider" && validatedData.businessName) {
      await prisma.provider.create({
        data: {
          userId: user.id,
          businessName: validatedData.businessName,
          description: validatedData.description,
          city: validatedData.city,
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
        { error: "Valideringsfel", details: error.errors },
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
