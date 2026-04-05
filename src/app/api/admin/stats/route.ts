import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalUsers,
      customers,
      providers,
      newThisMonth,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      completedThisMonth,
      totalProviders,
      activeProviders,
      verifiedProviders,
      pendingVerifications,
      totalRevenue,
      monthRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { userType: "customer" } }),
      prisma.user.count({ where: { userType: "provider" } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "pending" } }),
      prisma.booking.count({ where: { status: "confirmed" } }),
      prisma.booking.count({ where: { status: "completed" } }),
      prisma.booking.count({ where: { status: "cancelled" } }),
      prisma.booking.count({
        where: { status: "completed", updatedAt: { gte: startOfMonth } },
      }),
      prisma.provider.count(),
      prisma.provider.count({ where: { isActive: true } }),
      prisma.provider.count({ where: { isVerified: true } }),
      prisma.providerVerification.count({ where: { status: "pending" } }),
      prisma.payment.aggregate({
        where: { status: "succeeded" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: "succeeded", createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ])

    return NextResponse.json({
      users: {
        total: totalUsers,
        customers,
        providers,
        newThisMonth,
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        completedThisMonth,
      },
      providers: {
        total: totalProviders,
        active: activeProviders,
        verified: verifiedProviders,
        pendingVerifications,
      },
      revenue: {
        totalCompleted: totalRevenue._sum.amount ?? 0,
        thisMonth: monthRevenue._sum.amount ?? 0,
      },
    })
  },
)
