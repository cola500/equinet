import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bookingSchema = z.object({
  providerId: z.string(),
  serviceId: z.string(),
  bookingDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  horseName: z.string().optional(),
  horseInfo: z.string().optional(),
  customerNotes: z.string().optional(),
})

// GET bookings for logged-in user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let bookings

    if (session.user.userType === "provider") {
      const provider = await prisma.provider.findUnique({
        where: { userId: session.user.id },
      })

      if (!provider) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 })
      }

      bookings = await prisma.booking.findMany({
        where: { providerId: provider.id },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          service: true,
        },
        orderBy: { bookingDate: "desc" },
      })
    } else {
      bookings = await prisma.booking.findMany({
        where: { customerId: session.user.id },
        include: {
          provider: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          service: true,
        },
        orderBy: { bookingDate: "desc" },
      })
    }

    return NextResponse.json(bookings)
  } catch (error) {
    console.error("Error fetching bookings:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

// POST - Create new booking
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = bookingSchema.parse(body)

    // Verify service exists and belongs to provider
    const service = await prisma.service.findUnique({
      where: { id: validatedData.serviceId },
    })

    if (!service || service.providerId !== validatedData.providerId) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: session.user.id,
        providerId: validatedData.providerId,
        serviceId: validatedData.serviceId,
        bookingDate: new Date(validatedData.bookingDate),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        horseName: validatedData.horseName,
        horseInfo: validatedData.horseInfo,
        customerNotes: validatedData.customerNotes,
        status: "pending",
      },
      include: {
        service: true,
        provider: {
          include: {
            user: true,
          },
        },
      },
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    )
  }
}
