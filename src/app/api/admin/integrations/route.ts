import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    await requireAdmin(session)

    const [
      fortnoxConnections,
      totalConnected,
      totalPayments,
      succeededPayments,
      pendingPayments,
      failedPayments,
      revenueAgg,
    ] = await Promise.all([
      prisma.fortnoxConnection.findMany({
        select: {
          providerId: true,
          provider: { select: { businessName: true } },
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.fortnoxConnection.count(),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "succeeded" } }),
      prisma.payment.count({ where: { status: "pending" } }),
      prisma.payment.count({ where: { status: "failed" } }),
      prisma.payment.aggregate({
        where: { status: "succeeded" },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      fortnox: {
        connections: fortnoxConnections.map((fc) => ({
          providerId: fc.providerId,
          businessName: fc.provider.businessName,
          connectedAt: fc.createdAt,
          tokenExpiresAt: fc.expiresAt,
        })),
        totalConnected,
      },
      payments: {
        total: totalPayments,
        succeeded: succeededPayments,
        pending: pendingPayments,
        failed: failedPayments,
        totalRevenue: revenueAgg._sum.amount ?? 0,
      },
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    logger.error("Failed to fetch admin integrations", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
