import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * GET /api/provider/onboarding-status
 * Returns the onboarding completion status for the current provider
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    const provider = await prisma.provider.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        businessName: true,
        description: true,
        address: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: { id: true },
        },
        availability: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    })

    if (!provider) {
      return new Response("Provider not found", { status: 404 })
    }

    // Check if profile is complete:
    // - businessName is required at registration, so always filled
    // - description filled
    // - address + city + postalCode filled
    // - location (latitude + longitude) set
    const profileComplete = Boolean(
      provider.businessName &&
      provider.description &&
      provider.address &&
      provider.city &&
      provider.postalCode &&
      provider.latitude !== null &&
      provider.longitude !== null
    )

    const hasServices = provider.services.length > 0
    const hasAvailability = provider.availability.length > 0
    const isActive = provider.isActive

    const allComplete = profileComplete && hasServices && hasAvailability && isActive

    return NextResponse.json({
      profileComplete,
      hasServices,
      hasAvailability,
      isActive,
      allComplete,
    })
  } catch (error) {
    logger.error("Error fetching onboarding status", error instanceof Error ? error : new Error(String(error)))
    return new Response("Internal error", { status: 500 })
  }
}
