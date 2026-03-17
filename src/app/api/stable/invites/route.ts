import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableInviteService } from "@/domain/stable/StableInviteServiceFactory"
import { sendStableInviteNotification } from "@/lib/email"

const inviteSchema = z
  .object({
    email: z.string().email("Ogiltig e-postadress"),
  })
  .strict()

// POST - Create a stable invite
export async function POST(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  if (!(await isFeatureEnabled("stable_profiles"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Verify user owns a stable
    const stableService = createStableService()
    const stable = await stableService.getByUserId(session.user.id)
    if (!stable) {
      return NextResponse.json(
        { error: "Du har inget stall" },
        { status: 403 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON", details: "Förfrågan måste innehålla giltig JSON" },
        { status: 400 }
      )
    }

    const validated = inviteSchema.parse(body)

    const inviteService = createStableInviteService()
    const result = await inviteService.createInvite(stable.id, validated.email)

    if (result.isFailure) {
      return NextResponse.json(
        { error: "Kunde inte skapa inbjudan" },
        { status: 500 }
      )
    }

    // Send email (fire-and-forget)
    sendStableInviteNotification(
      validated.email,
      stable.name,
      result.value.token
    ).catch((err) =>
      logger.error("Failed to send stable invite email", err as Error)
    )

    logger.info("Stable invite created", {
      stableId: stable.id,
      email: validated.email,
    })

    return NextResponse.json(
      {
        message: "Inbjudan skapad",
        inviteUrl: `/invite/stable/${result.value.token}`,
      },
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

    logger.error("Failed to create stable invite", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa inbjudan" },
      { status: 500 }
    )
  }
}

// GET - List invites for the stable owner
export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  if (!(await isFeatureEnabled("stable_profiles"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const stableService = createStableService()
    const stable = await stableService.getByUserId(session.user.id)
    if (!stable) {
      return NextResponse.json(
        { error: "Du har inget stall" },
        { status: 403 }
      )
    }

    const inviteService = createStableInviteService()
    const invites = await inviteService.listInvites(stable.id)

    return NextResponse.json(invites)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Failed to list stable invites", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta inbjudningar" },
      { status: 500 }
    )
  }
}
