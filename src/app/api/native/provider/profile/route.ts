/**
 * GET /api/native/provider/profile - Fetch provider profile for native iOS app
 * PUT /api/native/provider/profile - Update provider profile (provider + user fields)
 *
 * Auth: Bearer > Supabase
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  rateLimiters,
  getClientIP,
  RateLimitServiceError,
} from "@/lib/rate-limit"
import { invalidateProviderCache } from "@/lib/cache/provider-cache"

const profileUpdateSchema = z
  .object({
    // Provider fields
    businessName: z.string().min(1, "Företagsnamn krävs").optional(),
    description: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    serviceArea: z.string().optional().nullable(),
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
    // User fields
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional().nullable(),
  })
  .strict()

const profileSelect = {
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
} as const

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Fetch provider with user data
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: profileSelect,
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    logger.info("Native provider profile fetched", {
      userId: authUser.id,
      providerId: provider.id,
    })

    return NextResponse.json(provider)
  } catch (error) {
    logger.error("Failed to fetch native provider profile", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta profil" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.profileUpdate(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // 3. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validate
    const parsed = profileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 5. Separate provider vs user fields
    const { firstName, lastName, phone, ...providerFields } = parsed.data
    const hasUserFields =
      firstName !== undefined || lastName !== undefined || phone !== undefined
    const hasProviderFields = Object.keys(providerFields).length > 0

    // 6. Update in transaction (provider + user atomically)
    const updatedProfile = await prisma.$transaction(async (tx) => {
      if (hasUserFields) {
        const userUpdate: Record<string, unknown> = {}
        if (firstName !== undefined) userUpdate.firstName = firstName
        if (lastName !== undefined) userUpdate.lastName = lastName
        if (phone !== undefined) userUpdate.phone = phone
        await tx.user.update({
          where: { id: authUser.id },
          data: userUpdate,
        })
      }

      if (hasProviderFields) {
        await tx.provider.update({
          where: { userId: authUser.id },
          data: providerFields,
        })
      }

      // Re-fetch with full select to return consistent data
      return tx.provider.findUnique({
        where: { userId: authUser.id },
        select: profileSelect,
      })
    })

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    // Invalidate provider cache (async, don't block response)
    invalidateProviderCache().catch(() => {})

    logger.info("Native provider profile updated", {
      userId: authUser.id,
      providerId: updatedProfile.id,
      updatedFields: Object.keys(parsed.data),
    })

    return NextResponse.json(updatedProfile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to update native provider profile", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera profil" },
      { status: 500 }
    )
  }
}
