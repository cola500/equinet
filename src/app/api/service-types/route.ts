import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { ServiceRepository } from "@/infrastructure/persistence/service/ServiceRepository"

// GET /api/service-types - List distinct active service type names
export async function GET(request: NextRequest) {
  try {
    await auth()

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const serviceRepo = new ServiceRepository()
    const services = await serviceRepo.findAll({ isActive: true })

    // Deduplicate names (multiple providers may offer same service name)
    const uniqueNames = [...new Set(services.map((s) => s.name))].sort()

    return NextResponse.json(uniqueNames)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error fetching service types", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
