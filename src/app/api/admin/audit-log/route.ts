import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/admin/audit-log
 * Returns paginated admin audit log entries.
 * Query params: cursor (string), limit (number, default 100, max 200)
 */
export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get("cursor")
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 200)

    const [entries, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          userEmail: true,
          action: true,
          ipAddress: true,
          statusCode: true,
          createdAt: true,
        },
      }),
      prisma.adminAuditLog.count(),
    ])

    const nextCursor = entries.length === limit ? entries[entries.length - 1]?.id : null

    return NextResponse.json({ entries, total, nextCursor })
  },
)
