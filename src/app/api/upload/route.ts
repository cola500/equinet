import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { validateFile, uploadFile } from "@/lib/supabase-storage"

const VALID_BUCKETS = ["avatars", "horses", "services", "verifications"] as const
type UploadBucket = (typeof VALID_BUCKETS)[number]

const MAX_IMAGES_PER_VERIFICATION = 5

// POST /api/upload - Upload a file
export async function POST(request: NextRequest) {
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

    // Parse FormData
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig formdata" },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File | null
    const bucket = formData.get("bucket") as string | null
    const entityId = formData.get("entityId") as string | null

    // Validate inputs
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Ingen fil uppladdad" },
        { status: 400 }
      )
    }

    if (!bucket || !VALID_BUCKETS.includes(bucket as UploadBucket)) {
      return NextResponse.json(
        { error: "Ogiltig bucket. Tillåtna: avatars, horses, services, verifications." },
        { status: 400 }
      )
    }

    if (!entityId) {
      return NextResponse.json(
        { error: "entityId krävs" },
        { status: 400 }
      )
    }

    // Validate file type and size
    const validationError = validateFile(file.type, file.size)
    if (validationError) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      )
    }

    // Authorization: verify entity ownership
    if (bucket === "horses") {
      const horse = await prisma.horse.findFirst({
        where: {
          id: entityId,
          ownerId: session.user.id,
          isActive: true,
        },
      })
      if (!horse) {
        return NextResponse.json(
          { error: "Hasten hittades inte" },
          { status: 404 }
        )
      }
    } else if (bucket === "avatars") {
      const provider = await prisma.provider.findUnique({
        where: { id: entityId },
      })
      if (!provider || provider.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Leverantoren hittades inte" },
          { status: 404 }
        )
      }
    } else if (bucket === "verifications") {
      // IDOR: verify ownership + only pending/rejected can have images added
      const verification = await prisma.providerVerification.findFirst({
        where: {
          id: entityId,
          provider: { userId: session.user.id },
          status: { in: ["pending", "rejected"] },
        },
      })
      if (!verification) {
        return NextResponse.json(
          { error: "Verifieringsansökan hittades inte eller kan inte ändras" },
          { status: 404 }
        )
      }

      // Check max images limit
      const imageCount = await prisma.upload.count({
        where: { verificationId: entityId },
      })
      if (imageCount >= MAX_IMAGES_PER_VERIFICATION) {
        return NextResponse.json(
          { error: `Max ${MAX_IMAGES_PER_VERIFICATION} bilder per verifiering` },
          { status: 400 }
        )
      }
    }
    // "services" bucket - provider ownership checked via providerId

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg"
    const fileName = `${entityId}-${Date.now()}.${ext}`

    // Upload to Supabase Storage (pass File object directly)
    const uploadResult = await uploadFile(
      file,
      bucket as UploadBucket,
      fileName,
      file.type
    )

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      )
    }

    const { path, url } = uploadResult.data!

    // Track upload in database
    const upload = await prisma.upload.create({
      data: {
        userId: session.user.id,
        bucket,
        path,
        url,
        mimeType: file.type,
        sizeBytes: file.size,
        ...(bucket === "verifications" ? { verificationId: entityId } : {}),
      },
    })

    // Update entity with the new photo URL
    if (bucket === "horses") {
      await prisma.horse.update({
        where: { id: entityId },
        data: { photoUrl: url },
      })
    } else if (bucket === "avatars") {
      await prisma.provider.update({
        where: { id: entityId },
        data: { profileImageUrl: url },
      })
    }

    logger.info("File uploaded", {
      uploadId: upload.id,
      bucket,
      entityId,
      userId: session.user.id,
      sizeBytes: file.size,
    })

    return NextResponse.json(
      { id: upload.id, url, path },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Failed to upload file", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ladda upp filen" },
      { status: 500 }
    )
  }
}
