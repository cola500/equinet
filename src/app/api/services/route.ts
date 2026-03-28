import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { rateLimiters } from "@/lib/rate-limit"
import { z } from "zod"
import { logger } from "@/lib/logger"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
})

// GET all services for logged-in provider
export const GET = withApiHandler(
  { auth: "provider" },
  async ({ user }) => {
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(user.userId)

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const serviceRepo = new ServiceRepository()
    const services = await serviceRepo.findByProviderId(provider.id)

    return NextResponse.json(services)
  },
)

// POST - Create new service (custom rate limit key, so rateLimit: false)
export const POST = withApiHandler(
  { auth: "provider", rateLimit: false, schema: serviceSchema },
  async ({ user, body }) => {
    // Manual rate limiting with user-specific key
    const rateLimitKey = `service-create:${user.userId}`
    const isAllowed = await rateLimiters.serviceCreate(rateLimitKey)
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: "För många tjänster skapade",
          details: "Du kan skapa max 10 tjänster per timme. Försök igen senare.",
        },
        { status: 429 }
      )
    }

    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(user.userId)

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const serviceRepo = new ServiceRepository()
    const service = await serviceRepo.save({
      id: crypto.randomUUID(),
      providerId: provider.id,
      name: body.name,
      description: body.description || null,
      price: body.price,
      durationMinutes: body.durationMinutes,
      isActive: true,
      recommendedIntervalWeeks: body.recommendedIntervalWeeks ?? null,
      createdAt: new Date(),
    })

    logger.info("Service created", { providerId: provider.id, serviceId: service.id })

    return NextResponse.json(service, { status: 201 })
  },
)
