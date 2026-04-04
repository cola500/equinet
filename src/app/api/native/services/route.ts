/**
 * GET /api/native/services - Service list for native iOS app
 * POST /api/native/services - Create new service
 *
 * Auth: Bearer > Supabase.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"
import { randomUUID } from "crypto"

const serviceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean().optional(),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
}).strict()

const repo = new ServiceRepository()

export async function GET(request: NextRequest) {
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

    // 4. Fetch services via repository
    const services = await repo.findByProviderId(provider.id)

    logger.info("Native services fetched", {
      userId: authUser.id,
      providerId: provider.id,
      count: services.length,
    })

    return NextResponse.json({ services })
  } catch (error) {
    logger.error("Failed to fetch native services", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta tjänster" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.serviceCreate(clientIP)
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
    const parsed = serviceSchema.safeParse(body)
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

    // 6. Create service via repository
    const service = await repo.save({
      id: randomUUID(),
      providerId: provider.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      durationMinutes: parsed.data.durationMinutes,
      isActive: parsed.data.isActive ?? true,
      recommendedIntervalWeeks: parsed.data.recommendedIntervalWeeks ?? null,
    })

    logger.info("Native service created", {
      userId: authUser.id,
      providerId: provider.id,
      serviceId: service.id,
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    logger.error("Failed to create native service", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte skapa tjänst" },
      { status: 500 }
    )
  }
}
