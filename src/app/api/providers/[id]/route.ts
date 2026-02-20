import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { geocodeAddress } from "@/lib/geocoding"
import { z } from "zod"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { invalidateProviderCache } from "@/lib/cache/provider-cache"
import { logger } from "@/lib/logger"

// GET single provider with services and availability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Use repository instead of direct Prisma access
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByIdWithPublicDetails(id)

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(provider)
  } catch (error) {
    logger.error("Error fetching provider", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta leverantör" },
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
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const { id } = await params

    // Use repository instead of direct Prisma access
    const providerRepo = new ProviderRepository()

    // 2. Fetch existing provider with authorization check
    const existingProvider = await providerRepo.findByIdForOwner(id, session.user.id)

    if (!existingProvider) {
      // Returns 404 for both "not found" and "not authorized" (security best practice)
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // 3. Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (_jsonError) {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateProviderSchema.parse(body)

    // 4. Geocoding logic - only if address changed
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
        // Build full address string
        const fullAddress = [addressToGeocode, cityToGeocode, postalCodeToGeocode]
          .filter(Boolean)
          .join(', ')
        const geocoded = await geocodeAddress(fullAddress)

        if (geocoded) {
          latitude = geocoded.latitude
          longitude = geocoded.longitude
        } else {
          return NextResponse.json(
            { error: "Kunde inte geokoda adressen. Kontrollera adressformatet." },
            { status: 400 }
          )
        }
      }
    }

    // 5. Update provider with geocoded coordinates (auth already verified above)
    const updatedProvider = await providerRepo.updateWithAuth(
      id,
      {
        ...validated,
        latitude,
        longitude,
      },
      session.user.id
    )

    if (!updatedProvider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // Invalidate provider cache after update (async, don't block response)
    invalidateProviderCache().catch(() => {
      // Fail silently - cache will expire naturally
    })

    return NextResponse.json(updatedProvider)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error updating provider", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera leverantör" },
      { status: 500 }
    )
  }
}
