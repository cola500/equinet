import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { requireProvider } from "@/lib/roles"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

// POST /api/integrations/fortnox/disconnect - Remove Fortnox connection
export async function POST(request: NextRequest) {
  try {
    const { userId, providerId } = requireProvider(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
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
      userId,
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
