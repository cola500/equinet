import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { geocodeAddress } from "@/lib/geocoding"
import { z } from "zod"

// GET single provider with services and availability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const provider = await prisma.provider.findUnique({
      where: {
        id,
        isActive: true,
      },
      include: {
        services: {
          where: {
            isActive: true,
          },
        },
        availability: {
          where: {
            isActive: true,
          },
          orderBy: {
            dayOfWeek: "asc",
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(provider)
  } catch (error) {
    console.error("Error fetching provider:", error)
    return NextResponse.json(
      { error: "Failed to fetch provider" },
      { status: 500 }
    )
  }
}

// Zod schema for provider update
const updateProviderSchema = z.object({
  businessName: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  serviceAreaKm: z.number().positive().optional(),
  profileImageUrl: z.string().url().optional(),
})

// PUT update provider profile with automatic geocoding
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authentication check
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // 2. Fetch existing provider
    const existingProvider = await prisma.provider.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        address: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
      },
    })

    if (!existingProvider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // 3. Authorization check - user must own this provider profile
    if (existingProvider.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 4. Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const validated = updateProviderSchema.parse(body)

    // 5. Geocoding logic - only if address changed
    let latitude = existingProvider.latitude
    let longitude = existingProvider.longitude

    const addressChanged =
      (validated.address && validated.address !== existingProvider.address) ||
      (validated.city && validated.city !== existingProvider.city) ||
      (validated.postalCode && validated.postalCode !== existingProvider.postalCode)

    if (addressChanged) {
      // Use new values if provided, otherwise keep existing
      const addressToGeocode = validated.address ?? existingProvider.address
      const cityToGeocode = validated.city ?? existingProvider.city
      const postalCodeToGeocode = validated.postalCode ?? existingProvider.postalCode

      if (addressToGeocode) {
        const geocoded = await geocodeAddress(
          addressToGeocode,
          cityToGeocode ?? undefined,
          postalCodeToGeocode ?? undefined
        )

        if (geocoded) {
          latitude = geocoded.latitude
          longitude = geocoded.longitude
        } else {
          return NextResponse.json(
            { error: "Could not geocode address. Please check address format." },
            { status: 400 }
          )
        }
      }
    }

    // 6. Update provider with geocoded coordinates
    const updatedProvider = await prisma.provider.update({
      where: { id },
      data: {
        ...validated,
        latitude,
        longitude,
      },
    })

    return NextResponse.json(updatedProvider)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error updating provider:", error)
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 }
    )
  }
}
