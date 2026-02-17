import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { invalidateProviderCache } from "@/lib/cache/provider-cache"
import { logger } from "@/lib/logger"

const providerProfileSchema = z.object({
  businessName: z.string().min(1, "Företagsnamn krävs"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  serviceArea: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  serviceAreaKm: z.number().min(1).max(500).optional().nullable(),
  acceptingNewCustomers: z.boolean().optional(),
  rescheduleEnabled: z.boolean().optional(),
  rescheduleWindowHours: z.number().int().min(1).max(168).optional(),
  maxReschedules: z.number().int().min(1).max(10).optional(),
  rescheduleRequiresApproval: z.boolean().optional(),
  recurringEnabled: z.boolean().optional(),
  maxSeriesOccurrences: z.number().int().min(2).max(52).optional(),
}).strict()

// GET - Fetch current provider profile
export async function GET(request: NextRequest) {
  try {
    // Auth handled by middleware
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        businessName: true,
        description: true,
        address: true,
        city: true,
        postalCode: true,
        serviceArea: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        profileImageUrl: true,
        isActive: true,
        acceptingNewCustomers: true,
        rescheduleEnabled: true,
        rescheduleWindowHours: true,
        maxReschedules: true,
        rescheduleRequiresApproval: true,
        recurringEnabled: true,
        maxSeriesOccurrences: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
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
      return NextResponse.json({ error: "Leverantörsprofil hittades inte" }, { status: 404 })
    }

    return NextResponse.json(provider)
  } catch (err: unknown) {
    const error = err as Error

    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching provider profile", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta leverantörsprofil" },
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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

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

    const validatedData = providerProfileSchema.parse(body)

    // Single query pattern: update directly using userId
    // This eliminates race condition between findUnique and update
    // If provider doesn't exist for this userId, Prisma will throw P2025 error
    const updatedProvider = await prisma.provider.update({
      where: { userId: session.user.id },
      data: validatedData,
      select: {
        id: true,
        businessName: true,
        description: true,
        address: true,
        city: true,
        postalCode: true,
        serviceArea: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        profileImageUrl: true,
        isActive: true,
        acceptingNewCustomers: true,
        rescheduleEnabled: true,
        rescheduleWindowHours: true,
        maxReschedules: true,
        rescheduleRequiresApproval: true,
        recurringEnabled: true,
        maxSeriesOccurrences: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
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

    // Invalidate provider cache after update (async, don't block response)
    invalidateProviderCache().catch(() => {
      // Fail silently - cache will expire naturally
    })

    return NextResponse.json(updatedProvider)
  } catch (err: unknown) {
    const error = err as Error

    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: Record not found (provider doesn't exist for this userId)
      if (error.code === "P2025") {
        logger.error("Provider not found for userId")
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
      logger.error("Prisma error during profile update", error, { prismaCode: error.code })
      return NextResponse.json(
        { error: "Databasfel uppstod" },
        { status: 500 }
      )
    }

    // Handle Prisma initialization errors (database connection issues)
    if (error instanceof Prisma.PrismaClientInitializationError) {
      logger.error("Database connection failed during profile update", error)
      return NextResponse.json(
        { error: "Databasen är inte tillgänglig" },
        { status: 503 }
      )
    }

    // Handle query timeout errors
    if (error instanceof Error && error.message.includes("Query timeout")) {
      logger.error("Query timeout during profile update", error)
      return NextResponse.json(
        { error: "Förfrågan tok för lång tid", details: "Försök igen" },
        { status: 504 }
      )
    }

    // Generic error fallback
    logger.error("Unexpected error updating provider profile", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera leverantörsprofil" },
      { status: 500 }
    )
  }
}
