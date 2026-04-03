import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

/**
 * GET /api/provider/onboarding-status
 * Returns the onboarding completion status for the current provider
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const provider = await prisma.provider.findFirst({
      where: { userId: authUser.id },
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
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // Profile complete: business info filled (excluding location -- that's hasServiceArea)
    const profileComplete = Boolean(
      provider.businessName &&
      provider.description &&
      provider.address &&
      provider.city &&
      provider.postalCode
    )

    const hasServices = provider.services.length > 0
    const hasAvailability = provider.availability.length > 0
    const hasServiceArea = provider.latitude !== null && provider.longitude !== null

    const allComplete = profileComplete && hasServices && hasAvailability && hasServiceArea

    return NextResponse.json({
      profileComplete,
      hasServices,
      hasAvailability,
      hasServiceArea,
      allComplete,
    })
  } catch (error) {
    logger.error("Error fetching onboarding status", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
