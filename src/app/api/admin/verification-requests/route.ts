import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// GET - List pending verification requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Admin check
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Behörighet saknas" },
        { status: 403 }
      )
    }

    const verifications = await prisma.providerVerification.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        provider: {
          select: { businessName: true },
        },
      },
    })

    return NextResponse.json(verifications)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch pending verifications", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta verifieringsansökningar" },
      { status: 500 }
    )
  }
}
