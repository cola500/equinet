import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    await requireAdmin(session)

    const { id } = await context.params

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
  } catch (error) {
    if (error instanceof Response) return error
    logger.error("Failed to fetch bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta buggrapport" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const admin = await requireAdmin(session)

    const { id } = await context.params

    const existing = await prisma.bugReport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Buggrapport hittades inte" },
        { status: 404 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateBugReportSchema.parse(body)

    const updated = await prisma.bugReport.update({
      where: { id },
      data: {
        ...validated,
        updatedBy: admin.id,
      },
    })

    logger.info("Bug report updated", {
      bugReportId: id,
      changes: Object.keys(validated),
      adminId: admin.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to update bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera buggrapport" },
      { status: 500 }
    )
  }
}
