import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

// GET /api/customers/search?q=anna
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Provider-only endpoint
    if (session.user.userType !== 'provider') {
      return NextResponse.json(
        { error: "Bara leverantörer kan söka kunder" },
        { status: 403 }
      )
    }

    // Rate limiting
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    // Get query param
    const query = request.nextUrl.searchParams.get('q')?.trim()
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Sökfråga måste vara minst 2 tecken" },
        { status: 400 }
      )
    }

    // Get provider from session
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Search customers that have booked with THIS provider (IDOR protection)
    const customers = await prisma.user.findMany({
      where: {
        AND: [
          { userType: 'customer' },
          {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          // Customers who have booked with this provider OR are manually added
          {
            OR: [
              { bookings: { some: { providerId: provider.id } } },
              { providerCustomerLinks: { some: { providerId: provider.id } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      take: 10,
    })

    return NextResponse.json(customers)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to search customers", error as Error)
    return NextResponse.json(
      { error: "Kunde inte söka kunder" },
      { status: 500 }
    )
  }
}
