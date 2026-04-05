import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
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
  },
)
