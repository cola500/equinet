import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sanitizeSearchQuery } from "@/lib/sanitize"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * GET /api/providers/visiting-area?location=Sollebrunn
 * Returns providers that have upcoming visits to a specific area
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const locationParam = searchParams.get("location")

    if (!locationParam || locationParam.trim().length < 2) {
      return NextResponse.json(
        { error: "Location parameter required (min 2 characters)" },
        { status: 400 }
      )
    }

    const location = sanitizeSearchQuery(locationParam)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find providers with upcoming visits to the specified area
    const exceptions = await prisma.availabilityException.findMany({
      where: {
        location: {
          contains: location,
          mode: "insensitive",
        },
        date: {
          gte: today,
        },
        isClosed: false, // Only show visits where they're working
      },
      include: {
        provider: {
          include: {
            services: {
              where: { isActive: true },
            },
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    })

    // Filter to only active providers and deduplicate
    const providerMap = new Map<string, {
      provider: {
        id: string
        businessName: string
        description: string | null
        city: string | null
        services: Array<{ id: string; name: string; price: number; durationMinutes: number; isActive: boolean }>
        user: { firstName: string; lastName: string }
      }
      nextVisit: {
        date: string
        location: string
        startTime: string | null
        endTime: string | null
      }
    }>()

    for (const exception of exceptions) {
      if (!exception.provider.isActive) continue

      // Only keep the earliest visit per provider
      if (!providerMap.has(exception.providerId)) {
        providerMap.set(exception.providerId, {
          provider: {
            id: exception.provider.id,
            businessName: exception.provider.businessName,
            description: exception.provider.description,
            city: exception.provider.city,
            services: exception.provider.services,
            user: exception.provider.user,
          },
          nextVisit: {
            date: exception.date.toISOString().split("T")[0],
            location: exception.location!,
            startTime: exception.startTime,
            endTime: exception.endTime,
          },
        })
      }
    }

    const results = Array.from(providerMap.values())

    return NextResponse.json({
      data: results,
      searchedLocation: location,
      total: results.length,
    })
  } catch (error) {
    logger.error("Error fetching providers by visiting area", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta leverantörer" },
      { status: 500 }
    )
  }
}
