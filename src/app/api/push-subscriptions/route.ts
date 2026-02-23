import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

const subscriptionSchema = z.object({
  endpoint: z.string().url("Ogiltig endpoint"),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
}).strict()

const deleteSchema = z.object({
  endpoint: z.string().url("Ogiltig endpoint"),
}).strict()

// POST /api/push-subscriptions - Save push subscription (stub)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = subscriptionSchema.parse(body)

    // Limit subscriptions per user (prevent resource exhaustion)
    const existingCount = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    })
    if (existingCount >= 20) {
      return NextResponse.json(
        { error: "Maximalt antal push-prenumerationer uppnått" },
        { status: 429 }
      )
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: validated.endpoint },
      update: {
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
        userId: session.user.id,
      },
      create: {
        userId: session.user.id,
        endpoint: validated.endpoint,
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
      },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
      },
    })

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error saving push subscription", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}

// DELETE /api/push-subscriptions - Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = deleteSchema.parse(body)

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: validated.endpoint,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Error removing push subscription", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
