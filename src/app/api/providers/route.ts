import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sanitizeSearchQuery } from "@/lib/sanitize"

// GET all active providers with their services
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityParam = searchParams.get("city")
    const searchParam = searchParams.get("search")

    // Sanitize search inputs to prevent SQL injection and XSS
    const city = cityParam ? sanitizeSearchQuery(cityParam) : null
    const search = searchParam ? sanitizeSearchQuery(searchParam) : null

    // Build where clause
    const where: any = {
      isActive: true,
    }

    if (city) {
      where.city = city
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const providers = await prisma.provider.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        description: true,
        city: true,
        services: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(providers)
  } catch (error) {
    console.error("Error fetching providers:", error)
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    )
  }
}
