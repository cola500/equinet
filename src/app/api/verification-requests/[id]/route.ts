import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

const VERIFICATION_TYPES = ["education", "organization", "certificate", "experience", "license"] as const

const updateVerificationSchema = z.object({
  title: z.string().min(1, "Titel krävs").max(200, "Titel för lång (max 200 tecken)").optional(),
  description: z.string().max(1000, "Beskrivning för lång (max 1000 tecken)").optional().nullable(),
  issuer: z.string().max(200, "Utfärdare för lång (max 200 tecken)").optional().nullable(),
  year: z.number().int().min(1900, "År måste vara minst 1900").max(2100, "År kan vara max 2100").optional().nullable(),
  type: z.enum(VERIFICATION_TYPES, {
    message: "Typ måste vara education, organization, certificate, experience eller license",
  }).optional(),
})

// PUT - Update a verification request (only pending/rejected)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

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

    // Find verification with IDOR protection
    const verification = await prisma.providerVerification.findFirst({
      where: { id, providerId: provider.id },
    })

    if (!verification) {
      return NextResponse.json(
        { error: "Verifieringsansökan hittades inte" },
        { status: 404 }
      )
    }

    // Cannot edit approved verifications
    if (verification.status === "approved") {
      return NextResponse.json(
        { error: "Godkända verifieringar kan inte redigeras" },
        { status: 400 }
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

    // Validate
    const validated = updateVerificationSchema.parse(body)

    // If status was rejected, reset to pending on edit
    const newStatus = verification.status === "rejected" ? "pending" : verification.status

    const updated = await prisma.providerVerification.update({
      where: { id },
      data: {
        ...validated,
        status: newStatus,
        // Clear review data if resetting to pending
        ...(newStatus === "pending" && verification.status === "rejected"
          ? { reviewedAt: null, reviewedBy: null, reviewNote: null }
          : {}),
      },
    })

    logger.info("Verification request updated", {
      verificationId: id,
      providerId: provider.id,
      statusChange: verification.status !== newStatus ? `${verification.status} -> ${newStatus}` : undefined,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to update verification request", error as Error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera verifieringsansökan" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a verification request (only pending/rejected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

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

    // Find verification with IDOR protection
    const verification = await prisma.providerVerification.findFirst({
      where: { id, providerId: provider.id },
    })

    if (!verification) {
      return NextResponse.json(
        { error: "Verifieringsansökan hittades inte" },
        { status: 404 }
      )
    }

    // Cannot delete approved verifications
    if (verification.status === "approved") {
      return NextResponse.json(
        { error: "Godkända verifieringar kan inte tas bort" },
        { status: 400 }
      )
    }

    // Delete associated uploads from DB (storage cleanup is tech debt)
    await prisma.upload.deleteMany({
      where: { verificationId: id },
    })

    // Delete the verification
    await prisma.providerVerification.delete({
      where: { id },
    })

    logger.info("Verification request deleted", {
      verificationId: id,
      providerId: provider.id,
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to delete verification request", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ta bort verifieringsansökan" },
      { status: 500 }
    )
  }
}
