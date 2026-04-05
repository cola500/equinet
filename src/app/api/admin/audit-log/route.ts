import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const querySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

/**
 * GET /api/admin/audit-log
 * Returns paginated admin audit log entries.
 * Query params: cursor (uuid, optional), limit (1-200, default 100)
 */
export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { cursor, limit } = parsed.data

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
