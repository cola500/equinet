import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { geocodeAddress } from "@/lib/geocoding"
import { logger } from "@/lib/logger"

// Validation schema for route stop
const routeStopSchema = z.object({
  locationName: z.string().min(1, "Platsnamn krävs"),
  address: z.string().min(1, "Adress krävs"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

// Validation schema for customer-initiated route order
const createRouteOrderSchema = z.object({
  announcementType: z.literal('customer_initiated').optional().default('customer_initiated'),
  serviceType: z.string().min(1, "Tjänstetyp krävs"),
  address: z.string().min(1, "Adress krävs"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  numberOfHorses: z.number().int().min(1).max(10).default(1),
  dateFrom: z.string().min(1, "Från-datum krävs"), // Accept date string from input
  dateTo: z.string().min(1, "Till-datum krävs"),   // Accept date string from input
  priority: z.enum(["normal", "urgent"], { message: "Prioritet måste vara 'normal' eller 'urgent'" }),
  specialInstructions: z.string().optional(),
  contactPhone: z.string().min(1, "Kontakttelefon krävs"),
})

// Validation schema for provider-announced route order
const createAnnouncementSchema = z.object({
  announcementType: z.literal('provider_announced'),
  serviceType: z.string().min(1, "Tjänstetyp krävs"),
  dateFrom: z.string().min(1, "Från-datum krävs"),
  dateTo: z.string().min(1, "Till-datum krävs"),
  stops: z.array(routeStopSchema).min(1, "Minst 1 stopp krävs").max(3, "Max 3 stopp tillåtna"),
  specialInstructions: z.string().optional(),
})

// POST /api/route-orders - Create new route order (customer or provider)
export async function POST(request: Request) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      logger.warn("Invalid JSON in request body", { error: String(jsonError) })
      return NextResponse.json(
        { error: "Invalid request body", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Determine if this is customer-initiated or provider-announced
    const announcementType = body.announcementType || 'customer_initiated'

    if (announcementType === 'provider_announced') {
      // Provider announcement flow
      return await handleProviderAnnouncement(request, body, session)
    } else {
      // Customer-initiated flow (existing)
      return await handleCustomerOrder(request, body, session)
    }

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Error creating route order", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Handle customer-initiated route orders
async function handleCustomerOrder(request: Request, body: any, session: any) {
  // Only customers can create route orders
  if (session.user.userType !== "customer") {
    return NextResponse.json(
      { error: "Endast kunder kan skapa rutt-beställningar" },
      { status: 403 }
    )
  }

  // Parse and validate
  const validated = createRouteOrderSchema.parse(body)

  // 3. Validate date range
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

  // For urgent orders, must be within 48 hours
  if (validated.priority === "urgent") {
    const maxUrgentDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    if (dateFrom > maxUrgentDate) {
      return NextResponse.json(
        { error: "Akutbeställningar måste vara inom 48 timmar" },
        { status: 400 }
      )
    }
  }

  // For normal orders, max 30 days span
  const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 30) {
    return NextResponse.json(
      { error: "Datum-spann kan max vara 30 dagar" },
      { status: 400 }
    )
  }

  // 4. Create route order
  const routeOrder = await prisma.routeOrder.create({
    data: {
      customerId: session.user.id,
      serviceType: validated.serviceType,
      address: validated.address,
      latitude: validated.latitude,
      longitude: validated.longitude,
      numberOfHorses: validated.numberOfHorses,
      dateFrom,
      dateTo,
      priority: validated.priority,
      specialInstructions: validated.specialInstructions,
      contactPhone: validated.contactPhone,
      status: "pending",
      announcementType: "customer_initiated",
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    }
  })

  return NextResponse.json(routeOrder, { status: 201 })
}

// Handle provider-announced route orders
async function handleProviderAnnouncement(request: Request, body: any, session: any) {
  // Only providers can create announcements
  if (session.user.userType !== "provider") {
    return NextResponse.json(
      { error: "Only providers can create announcements" },
      { status: 403 }
    )
  }

  // Parse and validate
  const validated = createAnnouncementSchema.parse(body)

  // 1. Find provider profile
  const provider = await prisma.provider.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  })

  if (!provider) {
    return NextResponse.json(
      { error: "Provider profile not found" },
      { status: 404 }
    )
  }

  // 2. Validate date range
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

  // For announcements, max 14 days span
  const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 14) {
    return NextResponse.json(
      { error: "Annonsering kan max vara 14 dagar" },
      { status: 400 }
    )
  }

  // 3. Geocode each stop's address - FAIL if any address cannot be geocoded
  const stopsWithCoordinates: Array<{ locationName: string; address: string; latitude?: number; longitude?: number }> = []
  for (const stop of validated.stops) {
    // Only geocode if coordinates not already provided
    if (stop.latitude && stop.longitude) {
      stopsWithCoordinates.push(stop)
      continue
    }

    const coords = await geocodeAddress(stop.address)
    if (!coords) {
      return NextResponse.json(
        {
          error: "Kunde inte hitta adressen",
          details: `Adressen "${stop.address}" kunde inte geocodas. Kontrollera stavningen och försök igen.`
        },
        { status: 400 }
      )
    }

    stopsWithCoordinates.push({
      ...stop,
      latitude: coords.latitude,
      longitude: coords.longitude
    })
  }

  // 4. Use first stop as primary location
  const firstStop = stopsWithCoordinates[0]

  // 5. Create announcement + route stops in a single transaction
  // @ts-expect-error - Prisma transaction callback type inference issue
  const announcement = await prisma.$transaction(async (tx: any) => {
    const newAnnouncement = await tx.routeOrder.create({
      data: {
        providerId: provider.id,
        serviceType: validated.serviceType,
        address: firstStop.address,
        latitude: firstStop.latitude ?? null,
        longitude: firstStop.longitude ?? null,
        numberOfHorses: 1,
        dateFrom,
        dateTo,
        priority: "normal",
        specialInstructions: validated.specialInstructions,
        announcementType: "provider_announced",
        status: "open",
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
          }
        }
      }
    })

    // Create route stops within the same transaction
    if (stopsWithCoordinates.length > 1) {
      await tx.routeStop.createMany({
        data: stopsWithCoordinates.map((stop: { locationName: string; address: string; latitude?: number; longitude?: number }, index: number) => ({
          routeOrderId: newAnnouncement.id,
          locationName: stop.locationName,
          address: stop.address,
          latitude: stop.latitude ?? null,
          longitude: stop.longitude ?? null,
          stopOrder: index + 1,
        })),
      })
    } else {
      await tx.routeStop.create({
        data: {
          routeOrderId: newAnnouncement.id,
          locationName: firstStop.locationName,
          address: firstStop.address,
          latitude: firstStop.latitude ?? null,
          longitude: firstStop.longitude ?? null,
          stopOrder: 1,
        },
      })
    }

    return newAnnouncement
  })

  return NextResponse.json(announcement, { status: 201 })
}

// GET /api/route-orders - Fetch route orders (provider announcements or customer orders)
export async function GET(request: Request) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Parse query params
    const { searchParams } = new URL(request.url)
    const announcementType = searchParams.get("announcementType")

    // Provider announcements list (for provider's own view)
    if (announcementType === "provider_announced" && session.user.userType === "provider") {
      // Find provider profile
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      })

      if (!provider) {
        return NextResponse.json(
          { error: "Provider profile not found" },
          { status: 404 }
        )
      }

      // Fetch provider's own announcements (all statuses) - using select for efficiency
      const announcements = await prisma.routeOrder.findMany({
        where: {
          providerId: provider.id,
          announcementType: "provider_announced"
        },
        select: {
          id: true,
          serviceType: true,
          address: true,
          latitude: true,
          longitude: true,
          dateFrom: true,
          dateTo: true,
          status: true,
          specialInstructions: true,
          announcementType: true,
          createdAt: true,
          routeStops: {
            select: {
              id: true,
              stopOrder: true,
              locationName: true,
              address: true,
              latitude: true,
              longitude: true,
              estimatedArrival: true,
              status: true,
            },
            orderBy: { stopOrder: "asc" }
          },
          _count: {
            select: { bookings: true }
          }
        },
        orderBy: { createdAt: "desc" }
      })

      return NextResponse.json(announcements)
    }

    // Customer orders list (for customer's own view)
    if (announcementType === "customer_initiated" && session.user.userType === "customer") {
      const limitParam = searchParams.get("limit")
      const offsetParam = searchParams.get("offset")
      const limit = Math.min(Math.max(1, parseInt(limitParam || "50", 10) || 50), 100)
      const customerOffset = Math.max(0, parseInt(offsetParam || "0", 10) || 0)

      const orders = await prisma.routeOrder.findMany({
        where: {
          customerId: session.user.id,
          announcementType: "customer_initiated"
        },
        select: {
          id: true,
          serviceType: true,
          address: true,
          latitude: true,
          longitude: true,
          numberOfHorses: true,
          dateFrom: true,
          dateTo: true,
          priority: true,
          status: true,
          specialInstructions: true,
          contactPhone: true,
          announcementType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: customerOffset,
      })

      return NextResponse.json(orders)
    }

    // Invalid request
    return NextResponse.json(
      { error: "Invalid request parameters" },
      { status: 400 }
    )

  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching route orders", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
