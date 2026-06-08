import { NextResponse } from "next/server"
import { z } from "zod"
import { startOfDay, endOfDay } from "date-fns"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

/**
 * A single stop in the provider's day, shaped for RouteMapVisualization
 * and the stop list. The visit location is the horse's stable when that stable
 * has coordinates; otherwise it falls back to the customer's address.
 * `stableName` is set whenever the horse is stabled (even without coordinates).
 */
interface DayRouteStop {
  id: string
  startTime: string
  endTime: string
  serviceType: string
  address: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  customer: { firstName: string; lastName: string }
  stableName?: string
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datumformat (YYYY-MM-DD)")

// GET /api/provider/today-route?date=YYYY-MM-DD
// Returns the provider's active bookings for a day (default today) ordered by
// start time, with the data needed to render them as a route on a map.
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user, request }) => {
    const provider = await prisma.provider.findUnique({
      where: { userId: user.userId },
      select: { id: true, latitude: true, longitude: true },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    // Default to today (UTC date) when no explicit date is provided.
    const dateParam =
      request.nextUrl.searchParams.get("date") ??
      new Date().toISOString().split("T")[0]

    const parsedDate = dateSchema.safeParse(dateParam)
    if (!parsedDate.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsedDate.error.issues },
        { status: 400 }
      )
    }

    // Match the whole local day, not an exact timestamp: bookings are stored at
    // local midnight (seed/demo) or UTC midnight (API), so an exact equality
    // misses them across the timezone boundary. Mirrors the native/dashboard
    // "today's bookings" convention (startOfDay/endOfDay in server-local time).
    const target = new Date(`${parsedDate.data}T00:00:00`)
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        bookingDate: { gte: startOfDay(target), lte: endOfDay(target) },
        status: { in: ["pending", "confirmed"] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            latitude: true,
            longitude: true,
            address: true,
            city: true,
          },
        },
        horse: {
          select: {
            stable: {
              select: {
                name: true,
                address: true,
                city: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    })

    const stops: DayRouteStop[] = bookings.map((b) => {
      const stable = b.horse?.stable ?? null
      // Visit happens at the stable when it has coordinates; otherwise the
      // customer's home address (current behaviour). The stable name is shown
      // regardless of whether the stable has coordinates.
      const visit =
        stable && stable.latitude != null && stable.longitude != null
          ? {
              address: stable.address,
              city: stable.city,
              latitude: stable.latitude,
              longitude: stable.longitude,
            }
          : {
              address: b.customer.address,
              city: b.customer.city,
              latitude: b.customer.latitude,
              longitude: b.customer.longitude,
            }

      return {
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        serviceType: b.service.name,
        ...visit,
        customer: {
          firstName: b.customer.firstName,
          lastName: b.customer.lastName,
        },
        ...(stable?.name ? { stableName: stable.name } : {}),
      }
    })

    const startLocation =
      provider.latitude != null && provider.longitude != null
        ? { lat: provider.latitude, lon: provider.longitude }
        : null

    return NextResponse.json({
      date: parsedDate.data,
      startLocation,
      stops,
    })
  }
)
