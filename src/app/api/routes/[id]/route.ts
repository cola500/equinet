import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

// GET /api/routes/:id - Get specific route
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth handled by middleware
    const session = await auth()

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
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error fetching route:", error)
    return new Response("Internt serverfel", { status: 500 })
  }
}
