import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    await requireAdmin(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const orderBy: Record<string, string> = {}
    if (sortBy === "priority") {
      orderBy.priority = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [bugReports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          userRole: true,
          pageUrl: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.bugReport.count({ where }),
    ])

    return NextResponse.json({ bugReports, total })
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to fetch bug reports", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta buggrapporter" },
      { status: 500 }
    )
  }
}
