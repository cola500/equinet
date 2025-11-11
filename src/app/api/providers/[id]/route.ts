import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
