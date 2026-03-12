import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// GET - List pending verification requests (admin only)
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    await requireAdmin(session)

    const verifications = await prisma.providerVerification.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        issuer: true,
        year: true,
        status: true,
        createdAt: true,
        provider: {
          select: { businessName: true },
        },
        images: {
          select: {
            id: true,
            url: true,
            mimeType: true,
          },
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
