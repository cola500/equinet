import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

const VERIFICATION_TYPES = ["education", "organization", "experience"] as const
const MAX_PENDING_REQUESTS = 5

const verificationRequestSchema = z.object({
  type: z.enum(VERIFICATION_TYPES, {
    message: "Typ måste vara education, organization eller experience",
  }),
  title: z.string().min(1, "Titel krävs").max(200, "Titel för lång (max 200 tecken)"),
  description: z.string().max(1000, "Beskrivning för lång (max 1000 tecken)").optional(),
})

// GET - List own verification requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // Find provider for this user
    const provider = await prisma.provider.findFirst({
      where: { userId: session.user.id },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    const verifications = await prisma.providerVerification.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(verifications)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to fetch verification requests", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta verifieringsansökningar" },
      { status: 500 }
    )
  }
}

// POST - Create verification request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Find provider for this user
    const provider = await prisma.provider.findFirst({
      where: { userId: session.user.id },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantörsprofil hittades inte" },
        { status: 404 }
      )
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON", details: "Request body must be valid JSON" },
        { status: 400 }
      )
    }

    // Validate
    const validated = verificationRequestSchema.parse(body)

    // Check max pending limit
    const pendingCount = await prisma.providerVerification.count({
      where: {
        providerId: provider.id,
        status: "pending",
      },
    })

    if (pendingCount >= MAX_PENDING_REQUESTS) {
      return NextResponse.json(
        {
          error: `Du kan ha max ${MAX_PENDING_REQUESTS} väntande ansökningar. Vänta tills befintliga har granskats.`,
        },
        { status: 400 }
      )
    }

    const verification = await prisma.providerVerification.create({
      data: {
        providerId: provider.id,
        type: validated.type,
        title: validated.title,
        description: validated.description,
      },
    })

    logger.info("Verification request created", {
      verificationId: verification.id,
      providerId: provider.id,
      type: validated.type,
    })

    return NextResponse.json(verification, { status: 201 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to create verification request", error as Error)
    return NextResponse.json(
      { error: "Kunde inte skapa verifieringsansökan" },
      { status: 500 }
    )
  }
}
