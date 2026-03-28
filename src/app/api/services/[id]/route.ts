import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"

const serviceSchema = z.object({
  name: z.string().min(1, "Tjänstens namn krävs"),
  description: z.string().optional(),
  price: z.number().positive("Pris måste vara positivt"),
  durationMinutes: z.number().int().positive("Varaktighet måste vara positiv"),
  isActive: z.boolean().optional(),
  recommendedIntervalWeeks: z.number().int().min(1).max(52).nullable().optional(),
})

// PUT - Update service
export const PUT = withApiHandler(
  { auth: "provider", schema: serviceSchema },
  async ({ request, user, body }) => {
    const id = request.nextUrl.pathname.split("/").pop()!

    const serviceRepo = new ServiceRepository()
    const providerRepo = new ProviderRepository()

    const provider = await providerRepo.findByUserId(user.userId)

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const service = await serviceRepo.updateWithAuth(id, body, provider.id)

    if (!service) {
      return NextResponse.json({ error: "Tjänst hittades inte" }, { status: 404 })
    }

    return NextResponse.json(service)
  },
)

// DELETE - Delete service
export const DELETE = withApiHandler(
  { auth: "provider" },
  async ({ request, user }) => {
    const id = request.nextUrl.pathname.split("/").pop()!

    const serviceRepo = new ServiceRepository()
    const providerRepo = new ProviderRepository()

    const provider = await providerRepo.findByUserId(user.userId)

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    const deleted = await serviceRepo.deleteWithAuth(id, provider.id)

    if (!deleted) {
      return NextResponse.json({ error: "Tjänst hittades inte" }, { status: 404 })
    }

    return NextResponse.json({ message: "Service deleted" })
  },
)
