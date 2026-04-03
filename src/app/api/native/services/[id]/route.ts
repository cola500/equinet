/**
 * PUT /api/native/services/[id] - Update service
 * DELETE /api/native/services/[id] - Delete service
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 * IDOR protection via repository's atomic WHERE (id + providerId).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean().optional(),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
}).strict()

const repo = new ServiceRepository()

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
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

    // 3. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validate
    const parsed = updateServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 5. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 6. Update via repository (IDOR-safe: atomic WHERE id + providerId)
    const { id } = await context.params
    const updated = await repo.updateWithAuth(
      id,
      {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        durationMinutes: parsed.data.durationMinutes,
        isActive: parsed.data.isActive,
        recommendedIntervalWeeks: parsed.data.recommendedIntervalWeeks ?? null,
      },
      provider.id
    )

    if (!updated) {
      return NextResponse.json(
        { error: "Tjänsten hittades inte" },
        { status: 404 }
      )
    }

    logger.info("Native service updated", {
      userId: authUser.id,
      serviceId: id,
    })

    return NextResponse.json({ service: updated })
  } catch (error) {
    logger.error("Failed to update native service", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte uppdatera tjänst" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
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

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Delete via repository (IDOR-safe: atomic WHERE id + providerId)
    const { id } = await context.params
    const deleted = await repo.deleteWithAuth(id, provider.id)

    if (!deleted) {
      return NextResponse.json(
        { error: "Tjänsten hittades inte" },
        { status: 404 }
      )
    }

    logger.info("Native service deleted", {
      userId: authUser.id,
      serviceId: id,
    })

    return NextResponse.json({ message: "Tjänsten har tagits bort" })
  } catch (error) {
    logger.error("Failed to delete native service", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte ta bort tjänst" },
      { status: 500 }
    )
  }
}
