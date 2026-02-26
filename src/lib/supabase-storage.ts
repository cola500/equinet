// Supabase Storage client for file uploads
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import { writeFile, mkdir } from "fs/promises"
import nodePath from "path"

const BUCKET_NAME = "equinet-uploads"

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type UploadBucket = "avatars" | "horses" | "services" | "verifications"

interface UploadResult {
  path: string
  url: string
}

interface UploadError {
  message: string
  code: "INVALID_TYPE" | "TOO_LARGE" | "UPLOAD_FAILED" | "NOT_CONFIGURED"
}

let supabaseClient: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return null
  }

  supabaseClient = createClient(url, key)
  return supabaseClient
}

/**
 * Validate file before upload.
 */
export function validateFile(
  mimeType: string,
  sizeBytes: number
): UploadError | null {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      message: `Filtypen ${mimeType} stöds inte. Tillåtna: JPEG, PNG, WebP, PDF.`,
      code: "INVALID_TYPE",
    }
  }

  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      message: `Filen är för stor (${Math.round(sizeBytes / 1024 / 1024)}MB). Max 5MB.`,
      code: "TOO_LARGE",
    }
  }

  return null
}

/**
 * Upload a file to Supabase Storage.
 * Accepts File (from FormData) or Buffer.
 */
export async function uploadFile(
  file: File | Buffer,
  bucket: UploadBucket,
  fileName: string,
  mimeType: string
): Promise<{ data?: UploadResult; error?: UploadError }> {
  const supabase = getSupabase()

  if (!supabase) {
    logger.warn("Supabase not configured, saving to public/uploads for dev")
    // Dev fallback: save to public/uploads/ so Next.js serves the file
    try {
      const dir = nodePath.join(process.cwd(), "public", "uploads", bucket)
      await mkdir(dir, { recursive: true })
      const filePath = nodePath.join(dir, fileName)
      const buffer = file instanceof File
        ? Buffer.from(await file.arrayBuffer())
        : file
      await writeFile(filePath, buffer)
      const mockPath = `${bucket}/${fileName}`
      const mockUrl = `/uploads/${mockPath}`
      return { data: { path: mockPath, url: mockUrl } }
    } catch (err) {
      logger.error("Dev mock upload failed", err instanceof Error ? err : new Error(String(err)))
      return { error: { message: "Mock upload failed", code: "UPLOAD_FAILED" } }
    }
  }

  const path = `${bucket}/${fileName}`

  // Convert File to Buffer if needed (Supabase SDK accepts both)
  let uploadBody: Buffer | File = file
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer()
    uploadBody = Buffer.from(arrayBuffer)
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, uploadBody, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    logger.error("Supabase upload failed", uploadError as Error)
    return {
      error: {
        message: "Kunde inte ladda upp filen. Försök igen.",
        code: "UPLOAD_FAILED",
      },
    }
  }

  const { data: publicUrl } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)

  return {
    data: {
      path,
      url: publicUrl.publicUrl,
    },
  }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(path: string): Promise<boolean> {
  const supabase = getSupabase()

  if (!supabase) {
    logger.warn("Supabase not configured, mock delete")
    return true
  }

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    logger.error("Supabase delete failed", error as Error)
    return false
  }

  return true
}
