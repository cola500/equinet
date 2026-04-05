import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async () => {
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
  },
)
