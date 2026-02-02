import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

// GET /api/customers/:id/horses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    // Provider-only endpoint
    if (session.user.userType !== 'provider') {
      return NextResponse.json(
        { error: "Bara leverantörer kan se kunders hästar" },
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

    const { id: customerId } = await params

    // Get provider from session
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Verify provider has a booking relationship with customer (IDOR protection)
    const hasRelation = await prisma.booking.findFirst({
      where: { customerId, providerId: provider.id },
      select: { id: true },
    })

    if (!hasRelation) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Get customer's active horses
    const horses = await prisma.horse.findMany({
      where: { ownerId: customerId, isActive: true },
      select: {
        id: true,
        name: true,
        breed: true,
        birthYear: true,
        gender: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(horses)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch customer horses", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta hästar" },
      { status: 500 }
    )
  }
}
