/**
 * POST /api/native/provider/upload - Upload profile image for native iOS app
 *
 * Auth: Bearer > Supabase (via getAuthUser)
 * Input: multipart/form-data with "file" field
 * Output: { url } (201)
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { validateFile, uploadFile } from "@/lib/supabase-storage"

export async function POST(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    if (!user.providerId) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

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

    const file = formData.get("file")
    if (!file || typeof file === "string" || (file as File).size === 0) {
      return NextResponse.json(
        { error: "Ingen fil uppladdad" },
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

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg"
    const fileName = `${user.providerId}-${Date.now()}.${ext}`

    // Upload to Supabase Storage
    const uploadResult = await uploadFile(file, "avatars", fileName, file.type)

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500 }
      )
    }

    const { path, url } = uploadResult.data!

    // Track upload in database
    await prisma.upload.create({
      data: {
        userId: user.id,
        bucket: "avatars",
        path,
        url,
        mimeType: file.type,
        originalName: file.name || null,
        sizeBytes: file.size,
      },
    })

    // Update provider profile image
    await prisma.provider.update({
      where: { id: user.providerId },
      data: { profileImageUrl: url },
    })

    logger.info("Native profile image uploaded", {
      providerId: user.providerId,
      sizeBytes: file.size,
    })

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    logger.error("Native upload failed", error as Error)
    return NextResponse.json(
      { error: "Kunde inte ladda upp filen" },
      { status: 500 }
    )
  }
}
