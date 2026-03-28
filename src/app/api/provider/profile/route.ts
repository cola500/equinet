import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
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
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user }) => {
    const { userId } = user

    const provider = await prisma.provider.findUnique({
      where: { userId },
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
  },
)

// PUT - Update current provider profile
export const PUT = withApiHandler(
  { auth: "provider", schema: providerProfileSchema },
  async ({ user, body }) => {
    const { userId } = user

    try {
      // Single query pattern: update directly using userId
      // This eliminates race condition between findUnique and update
      // If provider doesn't exist for this userId, Prisma will throw P2025 error
      const updatedProvider = await prisma.provider.update({
        where: { userId },
        data: body,
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
    } catch (error) {
      // Handle Prisma-specific errors (not covered by withApiHandler's generic catch)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          logger.error("Provider not found for userId")
          return NextResponse.json(
            { error: "Leverantörsprofil hittades inte" },
            { status: 404 }
          )
        }

        if (error.code === "P2002") {
          return NextResponse.json(
            { error: "Ett företag med detta namn finns redan" },
            { status: 409 }
          )
        }

        logger.error("Prisma error during profile update", error, { prismaCode: error.code })
        return NextResponse.json(
          { error: "Databasfel uppstod" },
          { status: 500 }
        )
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        logger.error("Database connection failed during profile update", error)
        return NextResponse.json(
          { error: "Databasen är inte tillgänglig" },
          { status: 503 }
        )
      }

      if (error instanceof Error && error.message.includes("Query timeout")) {
        logger.error("Query timeout during profile update", error)
        return NextResponse.json(
          { error: "Förfrågan tok för lång tid", details: "Försök igen" },
          { status: 504 }
        )
      }

      // Re-throw for withApiHandler's generic catch
      throw error
    }
  },
)
