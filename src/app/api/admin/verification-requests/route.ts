import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async () => {
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
  },
)
