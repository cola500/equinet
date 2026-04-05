import { NextResponse } from "next/server"
import { z } from "zod"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const updateBugReportSchema = z
  .object({
    status: z
      .enum(["NEW", "INVESTIGATING", "PLANNED", "FIXED", "DISMISSED"])
      .optional(),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
    internalNote: z.string().trim().max(5000).optional(),
  })
  .strict()

function extractIdFromUrl(url: string): string {
  return new URL(url).pathname.split("/").pop()!
}

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const id = extractIdFromUrl(request.url)

    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        reproductionSteps: true,
        pageUrl: true,
        userAgent: true,
        platform: true,
        userRole: true,
        status: true,
        priority: true,
        internalNote: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!bugReport) {
      return NextResponse.json(
        { error: "Buggrapport hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(bugReport)
  },
)

export const PATCH = withApiHandler(
  { auth: "admin", schema: updateBugReportSchema },
  async ({ user, body, request }) => {
    const id = extractIdFromUrl(request.url)

    const existing = await prisma.bugReport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Buggrapport hittades inte" },
        { status: 404 }
      )
    }

    const updated = await prisma.bugReport.update({
      where: { id },
      data: {
        ...body,
        updatedBy: user.userId,
      },
    })

    logger.info("Bug report updated", {
      bugReportId: id,
      changes: Object.keys(body),
      adminId: user.userId,
    })

    return NextResponse.json(updated)
  },
)
