import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// POST /api/integrations/fortnox/disconnect - Remove Fortnox connection
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantorer kan hantera Fortnox-koppling" },
        { status: 403 }
      )
    }

    const providerId = (session.user as any).providerId
    if (!providerId) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // Delete connection (tokens are encrypted, deleting is sufficient)
    const connection = await prisma.fortnoxConnection.findUnique({
      where: { providerId },
    })

    if (!connection) {
      return NextResponse.json(
        { error: "Ingen Fortnox-koppling hittad" },
        { status: 404 }
      )
    }

    await prisma.fortnoxConnection.delete({
      where: { providerId },
    })

    logger.info("Fortnox disconnected", {
      userId: session.user.id,
      providerId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to disconnect Fortnox", error as Error)
    return NextResponse.json(
      { error: "Kunde inte koppla bort Fortnox" },
      { status: 500 }
    )
  }
}
