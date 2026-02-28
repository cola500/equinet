import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"
import { isFeatureEnabled } from "@/lib/feature-flags"

const createGroupBookingSchema = z.object({
  serviceType: z.string().min(1, "Tjänsttyp krävs").max(100),
  providerId: z.string().uuid("Ogiltigt provider-ID").optional(),
  locationName: z.string().min(1, "Platsnamn krävs").max(200),
  address: z.string().min(1, "Adress krävs").max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  dateFrom: z.string().refine(
    (s) => !isNaN(Date.parse(s)),
    { message: "Ogiltigt datumformat" }
  ).refine(
    (s) => {
      const d = new Date(s)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return d >= today
    },
    { message: "Startdatum måste vara i framtiden" }
  ),
  dateTo: z.string().refine(
    (s) => !isNaN(Date.parse(s)),
    { message: "Ogiltigt datumformat" }
  ),
  notes: z.string().max(1000, "Anteckningar för långa (max 1000 tecken)").optional(),
  maxParticipants: z.number().int().min(2, "Minst 2 deltagare").max(20, "Max 20 deltagare").optional(),
  joinDeadline: z.string().refine(
    (s) => !isNaN(Date.parse(s)),
    { message: "Ogiltigt datumformat" }
  ).optional(),
  numberOfHorses: z.number().int().min(1).max(10).optional(),
  horseName: z.string().max(100).optional(),
  horseInfo: z.string().max(500).optional(),
  horseId: z.string().uuid().optional(),
}).refine(
  (data) => {
    const from = new Date(data.dateFrom)
    const to = new Date(data.dateTo)
    return to >= from
  },
  { message: "Slutdatum kan inte vara före startdatum", path: ["dateTo"] }
).refine(
  (data) => {
    const from = new Date(data.dateFrom)
    const to = new Date(data.dateTo)
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 30
  },
  { message: "Datumspann får inte överstiga 30 dagar", path: ["dateTo"] }
)

export async function POST(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("group_bookings"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const session = await auth()

    // Rate limiting
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        logger.security("Rate limit exceeded for group booking creation", "medium", {
          userId: session.user.id,
          endpoint: "/api/group-bookings",
        })
        return NextResponse.json(
          { error: "För många förfrågningar. Försök igen senare." },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      logger.error("Rate limiter error", rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError)))
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    // Validate
    const validated = createGroupBookingSchema.parse(body)

    // Delegate to service
    const service = createGroupBookingService()
    const result = await service.createRequest({
      userId: session.user.id,
      serviceType: validated.serviceType,
      providerId: validated.providerId,
      locationName: validated.locationName,
      address: validated.address,
      latitude: validated.latitude,
      longitude: validated.longitude,
      dateFrom: new Date(validated.dateFrom),
      dateTo: new Date(validated.dateTo),
      notes: validated.notes,
      maxParticipants: validated.maxParticipants ?? 10,
      joinDeadline: validated.joinDeadline ? new Date(validated.joinDeadline) : undefined,
      numberOfHorses: validated.numberOfHorses,
      horseId: validated.horseId,
      horseName: validated.horseName,
      horseInfo: validated.horseInfo,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: err.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to create group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Kunde inte skapa gruppbokning" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  if (!(await isFeatureEnabled("group_bookings"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()

    const service = createGroupBookingService()
    const result = await service.listForUser(session.user.id)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to fetch group bookings", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Kunde inte hämta gruppbokningar" },
      { status: 500 }
    )
  }
}
