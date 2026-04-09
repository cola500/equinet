/**
 * GET /api/native/announcements - Provider's route announcements for native iOS
 * POST /api/native/announcements - Create a new provider announcement
 *
 * Auth: Bearer > Supabase
 * Feature flag: route_announcements (server-side gate)
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { isValidMunicipality } from "@/lib/geo/municipalities"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

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

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    const announcements = await prisma.routeOrder.findMany({
      where: {
        providerId: provider.id,
        announcementType: "provider_announced",
      },
      select: {
        id: true,
        serviceType: true,
        municipality: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        specialInstructions: true,
        createdAt: true,
        routeStops: {
          select: {
            id: true,
            stopOrder: true,
            locationName: true,
            address: true,
          },
          orderBy: { stopOrder: "asc" },
        },
        services: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = announcements.map(({ _count, ...rest }) => ({
      ...rest,
      bookingCount: _count.bookings,
    }))

    logger.info("Native announcements fetched", {
      userId: authUser.id,
      providerId: provider.id,
      count: result.length,
    })

    return NextResponse.json({ announcements: result })
  } catch (error) {
    logger.error("Failed to fetch native announcements", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta annonser" },
      { status: 500 }
    )
  }
}

// MARK: - POST /api/native/announcements

const createAnnouncementSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1, "Minst en tjänst krävs"),
  dateFrom: z.string().min(1, "Från-datum krävs"),
  dateTo: z.string().min(1, "Till-datum krävs"),
  municipality: z.string().min(1, "Kommun krävs"),
  specialInstructions: z.string().optional(),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
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

    if (!(await isFeatureEnabled("route_announcements"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    if (!authUser.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan skapa annonser" },
        { status: 403 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = createAnnouncementSchema.parse(body)

    // Validate municipality
    if (!isValidMunicipality(validated.municipality)) {
      return NextResponse.json({ error: "Ogiltig kommun" }, { status: 400 })
    }

    // Validate dates
    const dateFrom = new Date(validated.dateFrom)
    const dateTo = new Date(validated.dateTo)
    const now = new Date()

    if (dateFrom < now) {
      return NextResponse.json(
        { error: "Startdatum måste vara i framtiden" },
        { status: 400 }
      )
    }

    if (dateTo < dateFrom) {
      return NextResponse.json(
        { error: "Slutdatum måste vara efter startdatum" },
        { status: 400 }
      )
    }

    const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 14) {
      return NextResponse.json(
        { error: "Annonsering kan max vara 14 dagar" },
        { status: 400 }
      )
    }

    // Validate service ownership
    const services = await prisma.service.findMany({
      where: {
        id: { in: validated.serviceIds },
        providerId: authUser.providerId,
        isActive: true,
      },
      select: { id: true, name: true },
    })

    if (services.length !== validated.serviceIds.length) {
      return NextResponse.json(
        { error: "En eller flera tjänster tillhör inte dig eller är inaktiva" },
        { status: 400 }
      )
    }

    const serviceNames = services.map(s => s.name).join(", ")

    const announcement = await prisma.routeOrder.create({
      data: {
        providerId: authUser.providerId,
        serviceType: serviceNames,
        address: validated.municipality,
        municipality: validated.municipality,
        numberOfHorses: 1,
        dateFrom,
        dateTo,
        priority: "normal",
        specialInstructions: validated.specialInstructions,
        announcementType: "provider_announced",
        status: "open",
        services: {
          connect: services.map(s => ({ id: s.id })),
        },
      },
      select: {
        id: true,
        serviceType: true,
        municipality: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        specialInstructions: true,
        createdAt: true,
        services: {
          select: { id: true, name: true },
        },
      },
    })

    logger.info("Native announcement created", {
      announcementId: announcement.id,
      providerId: authUser.providerId,
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to create native announcement", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte skapa annons" },
      { status: 500 }
    )
  }
}
