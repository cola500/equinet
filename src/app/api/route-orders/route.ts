import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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
      console.error("Invalid JSON in request body:", jsonError)
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
    console.error("Error creating route order:", error)
    return new Response("Internt serverfel", { status: 500 })
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

  // 3. Use first stop as primary location
  const firstStop = validated.stops[0]

  // 4. Create announcement
  const announcement = await prisma.routeOrder.create({
    data: {
      providerId: provider.id,
      serviceType: validated.serviceType,
      address: firstStop.address,
      latitude: firstStop.latitude ?? null,
      longitude: firstStop.longitude ?? null,
      dateFrom,
      dateTo,
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

  // 5. Create route stops if multiple stops
  if (validated.stops.length > 1) {
    await prisma.routeStop.createMany({
      data: validated.stops.map((stop, index) => ({
        routeOrderId: announcement.id,
        locationName: stop.locationName,
        address: stop.address,
        latitude: stop.latitude ?? null,
        longitude: stop.longitude ?? null,
        stopOrder: index + 1,
      })),
    })
  } else {
    // Create single stop for consistency
    await prisma.routeStop.create({
      data: {
        routeOrderId: announcement.id,
        locationName: firstStop.locationName,
        address: firstStop.address,
        latitude: firstStop.latitude ?? null,
        longitude: firstStop.longitude ?? null,
        stopOrder: 1,
      },
    })
  }

  return NextResponse.json(announcement, { status: 201 })
}
