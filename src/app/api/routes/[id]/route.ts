import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/routes/:id - Get specific route
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Only providers can view routes
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Endast leverantörer kan se rutter" },
        { status: 403 }
      )
    }

    // 2. Fetch route
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        },
        stops: {
          include: {
            routeOrder: {
              include: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                  }
                }
              }
            }
          },
          orderBy: {
            stopOrder: 'asc'
          }
        }
      }
    })

    if (!route) {
      return NextResponse.json(
        { error: "Rutt hittades inte" },
        { status: 404 }
      )
    }

    // 3. Check ownership
    if (route.providerId !== session.user.providerId) {
      return NextResponse.json(
        { error: "Du har inte tillgång till denna rutt" },
        { status: 403 }
      )
    }

    return NextResponse.json(route)

  } catch (error) {
    console.error("Error fetching route:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
