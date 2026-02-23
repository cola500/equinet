import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { isValidMunicipality } from "@/lib/geo/municipalities"

const profileSchema = z.object({
  firstName: z.string().min(1, "Förnamn krävs"),
  lastName: z.string().min(1, "Efternamn krävs"),
  phone: z.string().optional(),
  // Geographic location fields
  city: z.string().optional(),
  address: z.string().optional(),
  municipality: z.string().optional().refine(
    (val) => !val || isValidMunicipality(val),
    { message: "Ogiltig kommun" }
  ),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).strict()

// GET - Fetch current user profile
export async function GET(_request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        userType: true,
        city: true,
        address: true,
        municipality: true,
        latitude: true,
        longitude: true,
        provider: {
          select: { id: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Flatten provider ID for convenience
    const { provider, ...userData } = user
    return NextResponse.json({
      ...userData,
      providerId: provider?.id || null,
    })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching profile", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta profil" },
      { status: 500 }
    )
  }
}

// PUT - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      logger.warn("Invalid JSON in request body", { error: String(jsonError) })
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    const validatedData = profileSchema.parse(body)

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        userType: true,
        city: true,
        address: true,
        municipality: true,
        latitude: true,
        longitude: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating profile", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera profil" },
      { status: 500 }
    )
  }
}
