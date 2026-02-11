import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

type RouteContext = { params: Promise<{ customerId: string; noteId: string }> }

// DELETE /api/provider/customers/[customerId]/notes/[noteId]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan ta bort kundanteckningar" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    const { noteId } = await context.params
    const providerId = session.user.providerId

    try {
      // Atomic: WHERE { id, providerId } ensures IDOR protection
      await prisma.providerCustomerNote.delete({
        where: { id: noteId, providerId },
      })
    } catch {
      return NextResponse.json(
        { error: "Anteckningen hittades inte" },
        { status: 404 }
      )
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to delete customer note",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte ta bort anteckning" },
      { status: 500 }
    )
  }
}
