import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"

const providerProfileSchema = z.object({
  businessName: z.string().min(1, "Företagsnamn krävs"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  serviceArea: z.string().optional(),
}).strict()

// GET - Fetch current provider profile
export async function GET(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    return NextResponse.json(provider)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error fetching provider profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider profile" },
      { status: 500 }
    )
  }
}

// PUT - Update current provider profile
export async function PUT(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = providerProfileSchema.parse(body)

    // Single query pattern: update directly using userId
    // This eliminates race condition between findUnique and update
    // If provider doesn't exist for this userId, Prisma will throw P2025 error
    const updatedProvider = await prisma.provider.update({
      where: { userId: session.user.id },
      data: validatedData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    return NextResponse.json(updatedProvider)
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: Record not found (provider doesn't exist for this userId)
      if (error.code === "P2025") {
        console.error("Provider not found for userId")
        return NextResponse.json(
          { error: "Provider profile not found" },
          { status: 404 }
        )
      }

      // P2002: Unique constraint violation (e.g., duplicate businessName if there was such a constraint)
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Ett företag med detta namn finns redan" },
          { status: 409 }
        )
      }

      // Other Prisma errors
      console.error("Prisma error during profile update:", error.code, error.message)
      return NextResponse.json(
        { error: "Databasfel uppstod" },
        { status: 500 }
      )
    }

    // Handle Prisma initialization errors (database connection issues)
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error("Database connection failed during profile update:", error.message)
      return NextResponse.json(
        { error: "Databasen är inte tillgänglig" },
        { status: 503 }
      )
    }

    // Handle query timeout errors
    if (error instanceof Error && error.message.includes("Query timeout")) {
      console.error("Query timeout during profile update:", error.message)
      return NextResponse.json(
        { error: "Förfrågan tok för lång tid", details: "Försök igen" },
        { status: 504 }
      )
    }

    // Generic error fallback
    console.error("Unexpected error updating provider profile:", error)
    return NextResponse.json(
      { error: "Failed to update provider profile" },
      { status: 500 }
    )
  }
}
