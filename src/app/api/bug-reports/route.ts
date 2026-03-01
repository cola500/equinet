import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const createBugReportSchema = z
  .object({
    title: z.string().trim().min(1, "Titel krävs").max(200),
    description: z.string().trim().min(1, "Beskrivning krävs").max(5000),
    reproductionSteps: z.string().trim().max(5000).optional(),
    pageUrl: z.string().max(500),
    userAgent: z.string().max(500).optional(),
    platform: z.string().max(100).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.bugReport(
      session.user?.id || clientIp
    )
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen senare." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = createBugReportSchema.parse(body)

    const userType = (session.user as { userType?: string })?.userType
    const userRole =
      userType === "provider"
        ? "PROVIDER"
        : userType === "customer"
          ? "CUSTOMER"
          : "UNKNOWN"

    const bugReport = await prisma.bugReport.create({
      data: {
        title: validated.title,
        description: validated.description,
        reproductionSteps: validated.reproductionSteps || null,
        pageUrl: validated.pageUrl,
        userAgent: validated.userAgent || null,
        platform: validated.platform || null,
        userRole,
        userId: session.user?.id || null,
      },
    })

    logger.info("Bug report created", { bugReportId: bugReport.id })

    return NextResponse.json(
      { id: bugReport.id, status: bugReport.status },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Failed to create bug report", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa buggrapport" },
      { status: 500 }
    )
  }
}
