import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth-dual"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"

const deviceTokenSchema = z
  .object({
    token: z.string().min(1).max(200),
    platform: z.enum(["ios", "web"]).default("ios"),
  })
  .strict()

const deleteSchema = z
  .object({
    token: z.string().min(1).max(200),
  })
  .strict()

// POST /api/device-tokens -- Register/update device token
export async function POST(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("push_notifications"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIp)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const data = deviceTokenSchema.parse(body)

    // Limit device tokens per user (prevent resource exhaustion)
    const existingCount = await prisma.deviceToken.count({
      where: { userId: authUser.id },
    })
    if (existingCount >= 20) {
      return NextResponse.json(
        { error: "Maximalt antal enhetstoken uppnått" },
        { status: 429 }
      )
    }

    await prisma.deviceToken.upsert({
      where: { token: data.token },
      create: {
        userId: authUser.id,
        token: data.token,
        platform: data.platform,
      },
      update: {
        userId: authUser.id,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Error saving device token",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}

// DELETE /api/device-tokens -- Unregister device token
export async function DELETE(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled("push_notifications"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const data = deleteSchema.parse(body)

    await prisma.deviceToken.deleteMany({
      where: { token: data.token, userId: authUser.id },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Error deleting device token",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
