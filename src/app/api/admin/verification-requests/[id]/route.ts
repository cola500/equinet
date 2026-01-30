import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"], {
    message: "Action måste vara approve eller reject",
  }),
  reviewNote: z.string().max(500, "Anteckning för lång (max 500 tecken)").optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

// PUT - Approve or reject a verification request (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    const { id } = await context.params

    // Admin check: fetch user and verify isAdmin flag
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isAdmin: true },
    })

    if (!user?.isAdmin) {
      logger.security("Non-admin attempted verification review", "medium", {
        userId: session.user.id,
        verificationId: id,
      })
      return NextResponse.json(
        { error: "Behörighet saknas" },
        { status: 403 }
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
    const validated = reviewSchema.parse(body)

    // Fetch verification request
    const verification = await prisma.providerVerification.findUnique({
      where: { id },
      include: {
        provider: { select: { userId: true } },
      },
    })

    if (!verification) {
      return NextResponse.json(
        { error: "Verifieringsansökan hittades inte" },
        { status: 404 }
      )
    }

    if (verification.status !== "pending") {
      return NextResponse.json(
        { error: "Denna ansökan har redan behandlats" },
        { status: 400 }
      )
    }

    const isApproved = validated.action === "approve"
    const now = new Date()

    // Use transaction: update verification + optionally set provider verified + create notification
    // @ts-expect-error - Prisma transaction callback type inference issue
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update verification status
      const updated = await tx.providerVerification.update({
        where: { id },
        data: {
          status: isApproved ? "approved" : "rejected",
          reviewedAt: now,
          reviewedBy: session.user.id,
          reviewNote: validated.reviewNote,
        },
      })

      // 2. If approved, set provider as verified
      if (isApproved) {
        await tx.provider.update({
          where: { id: verification.providerId },
          data: {
            isVerified: true,
            verifiedAt: now,
            verifiedBy: session.user.id,
          },
        })
      }

      // 3. Create notification for the provider
      await tx.notification.create({
        data: {
          userId: verification.provider.userId,
          type: isApproved ? "verification_approved" : "verification_rejected",
          message: isApproved
            ? `Din verifieringsansökan "${verification.title}" har godkänts! Du är nu verifierad.`
            : `Din verifieringsansökan "${verification.title}" har avvisats.${validated.reviewNote ? ` Kommentar: ${validated.reviewNote}` : ""}`,
          linkUrl: "/provider/verification",
        },
      })

      return updated
    })

    logger.info("Verification request reviewed", {
      verificationId: id,
      action: validated.action,
      reviewedBy: session.user.id,
    })

    return NextResponse.json(result)
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

    logger.error("Failed to review verification request", error as Error)
    return NextResponse.json(
      { error: "Kunde inte behandla verifieringsansökan" },
      { status: 500 }
    )
  }
}
