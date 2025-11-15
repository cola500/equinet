import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Validation schema for creating route order
const createRouteOrderSchema = z.object({
  serviceType: z.string().min(1, "Tjänstetyp krävs"),
  address: z.string().min(1, "Adress krävs"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  numberOfHorses: z.number().int().min(1).max(10).default(1),
  dateFrom: z.string().min(1, "Från-datum krävs"), // Accept date string from input
  dateTo: z.string().min(1, "Till-datum krävs"),   // Accept date string from input
  priority: z.enum(["normal", "urgent"], { message: "Prioritet måste vara 'normal' eller 'urgent'" }),
  specialInstructions: z.string().optional(),
  contactPhone: z.string().min(1, "Kontakttelefon krävs"),
})

// POST /api/route-orders - Create new route order
export async function POST(request: Request) {
  try {
    // Auth handled by middleware
    const session = await auth()

    // Only customers can create route orders
    if (session.user.userType !== "customer") {
      return NextResponse.json(
        { error: "Endast kunder kan skapa rutt-beställningar" },
        { status: 403 }
      )
    }

    // 2. Parse and validate
    const body = await request.json()
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
