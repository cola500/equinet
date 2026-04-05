import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { z } from "zod"

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"], {
    message: "Action måste vara approve eller reject",
  }),
  reviewNote: z.string().max(500, "Anteckning för lång (max 500 tecken)").optional(),
})

export const PUT = withApiHandler(
  { auth: "admin", schema: reviewSchema },
  async ({ user, body, request }) => {
    const id = new URL(request.url).pathname.split("/").pop()!

    // Fetch verification request
    const verification = await prisma.providerVerification.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
        title: true,
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

    const isApproved = body.action === "approve"
    const now = new Date()

    // Use transaction: update verification + optionally set provider verified + create notification
    // @ts-expect-error - Prisma transaction callback type inference issue
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // 1. Update verification status
      const updated = await tx.providerVerification.update({
        where: { id },
        data: {
          status: isApproved ? "approved" : "rejected",
          reviewedAt: now,
          reviewedBy: user.userId,
          reviewNote: body.reviewNote,
        },
      })

      // 2. If approved, set provider as verified
      if (isApproved) {
        await tx.provider.update({
          where: { id: verification.providerId },
          data: {
            isVerified: true,
            verifiedAt: now,
            verifiedBy: user.userId,
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
            : `Din verifieringsansökan "${verification.title}" har avvisats.${body.reviewNote ? ` Kommentar: ${body.reviewNote}` : ""}`,
          linkUrl: "/provider/verification",
        },
      })

      return updated
    })

    logger.info("Verification request reviewed", {
      verificationId: id,
      action: body.action,
      reviewedBy: user.userId,
    })

    return NextResponse.json(result)
  },
)
