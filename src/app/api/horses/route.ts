import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const currentYear = new Date().getFullYear()

const horseCreateSchema = z.object({
  name: z.string().min(1, "Hästens namn krävs").max(100, "Namn för långt (max 100 tecken)"),
  breed: z.string().max(100, "Ras för lång (max 100 tecken)").optional(),
  birthYear: z.number()
    .int("Födelseår måste vara ett heltal")
    .min(1980, "Födelseår kan inte vara före 1980")
    .max(currentYear, "Födelseår kan inte vara i framtiden")
    .optional(),
  color: z.string().max(50, "Färg för lång (max 50 tecken)").optional(),
  gender: z.enum(["mare", "gelding", "stallion"], {
    message: "Kön måste vara mare, gelding eller stallion",
  }).optional(),
  specialNeeds: z.string().max(1000, "Specialbehov för lång text (max 1000 tecken)").optional(),
}).strict()

// GET - List horses for authenticated user
export async function GET(request: NextRequest) {
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

    const horses = await prisma.horse.findMany({
      where: {
        ownerId: session.user.id,
        isActive: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(horses)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch horses", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta hästar" },
      { status: 500 }
    )
  }
}

// POST - Create new horse
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Validate input
    const validated = horseCreateSchema.parse(body)

    const horse = await prisma.horse.create({
      data: {
        ownerId: session.user.id,
        name: validated.name,
        breed: validated.breed,
        birthYear: validated.birthYear,
        color: validated.color,
        gender: validated.gender,
        specialNeeds: validated.specialNeeds,
      },
    })

    logger.info("Horse created", { horseId: horse.id, ownerId: session.user.id })

    return NextResponse.json(horse, { status: 201 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to create horse", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa häst" },
      { status: 500 }
    )
  }
}
