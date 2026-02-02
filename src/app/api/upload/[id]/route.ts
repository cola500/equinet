import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { deleteFile } from "@/lib/supabase-storage"

type RouteContext = { params: Promise<{ id: string }> }

// DELETE /api/upload/[id] - Delete an uploaded file
export async function DELETE(request: NextRequest, context: RouteContext) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "For manga forfragningar. Forsok igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()
    const { id } = await context.params

    // IDOR protection: verify ownership in WHERE clause
    const upload = await prisma.upload.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!upload) {
      return NextResponse.json(
        { error: "Filen hittades inte" },
        { status: 404 }
      )
    }

    // If linked to a verification, check that it's editable (not approved)
    if (upload.verificationId) {
      const verification = await prisma.providerVerification.findUnique({
        where: { id: upload.verificationId },
        select: { status: true },
      })

      if (verification && verification.status === "approved") {
        return NextResponse.json(
          { error: "Kan inte ta bort bilder från godkända verifieringar" },
          { status: 400 }
        )
      }
    }

    // Delete from Supabase Storage
    await deleteFile(upload.path)

    // Delete from database
    await prisma.upload.delete({
      where: { id },
    })

    logger.info("File deleted", {
      uploadId: id,
      path: upload.path,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to delete file", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ta bort filen" },
      { status: 500 }
    )
  }
}
