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

// -----------------------------------------------------------
// Message attachments (S46 — private bucket, signed URLs)
// -----------------------------------------------------------

const MESSAGE_BUCKET = 'message-attachments'
const MESSAGE_MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MESSAGE_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
}

export interface MessageAttachmentValidationError {
  code: 'INVALID_TYPE' | 'TOO_LARGE' | 'MAGIC_BYTES_MISMATCH' | 'NOT_CONFIGURED'
  message: string
}

/**
 * HEIC heuristic: check ftyp box at bytes 4-7 and major brand at bytes 8-11.
 * file-type library does not reliably detect HEIC, so we use this as fallback.
 */
function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false
  const ftyp = buf.subarray(4, 8).toString('ascii')
  if (ftyp !== 'ftyp') return false
  const brand = buf.subarray(8, 12).toString('ascii').toLowerCase()
  return ['heic', 'heix', 'mif1', 'msf1'].includes(brand)
}

/**
 * Validate a message attachment buffer.
 * Fail-closed: if file type cannot be determined, reject the file.
 * Returns null if valid, or an error object.
 */
export async function validateMessageAttachment(
  buffer: Buffer,
  contentTypeMime: string
): Promise<MessageAttachmentValidationError | null> {
  if (!MESSAGE_ALLOWED_MIME.includes(contentTypeMime)) {
    return {
      code: 'INVALID_TYPE',
      message: `Filtypen stöds inte. Tillåtna format: JPEG, PNG, HEIC, WebP.`,
    }
  }

  if (buffer.byteLength > MESSAGE_MAX_SIZE) {
    return {
      code: 'TOO_LARGE',
      message: `Filen är för stor. Max ${MESSAGE_MAX_SIZE / 1024 / 1024} MB.`,
    }
  }

  // Magic bytes validation — fail-closed: reject if type cannot be confirmed
  try {
    const { fileTypeFromBuffer } = await import('file-type')
    const detected = await fileTypeFromBuffer(buffer)

    if (detected) {
      if (!MESSAGE_ALLOWED_MIME.includes(detected.mime)) {
        return {
          code: 'MAGIC_BYTES_MISMATCH',
          message: 'Filinnehållet matchar inte det deklarerade formatet.',
        }
      }
      // Detected and in allowed list — pass
      return null
    }

    // file-type could not detect — only accept HEIC via dedicated heuristic
    if (contentTypeMime === 'image/heic' && isHeicBuffer(buffer)) {
      return null
    }

    return {
      code: 'MAGIC_BYTES_MISMATCH',
      message: 'Filinnehållet matchar inte det deklarerade formatet.',
    }
  } catch {
    return {
      code: 'MAGIC_BYTES_MISMATCH',
      message: 'Kunde inte verifiera filformat. Försök igen.',
    }
  }
}

/**
 * Upload a message attachment to private storage.
 * Path: {bookingId}/{messageId}.{ext}
 * Returns the storage path (not a URL).
 */
export async function uploadMessageAttachment(
  bookingId: string,
  messageId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  const path = `${bookingId}/${messageId}.${ext}`
  const supabase = getSupabase()

  if (!supabase) {
    // Dev fallback: save to public/uploads/message-attachments/
    const dir = nodePath.join(process.cwd(), 'public', 'uploads', MESSAGE_BUCKET)
    await mkdir(dir, { recursive: true })
    await writeFile(nodePath.join(dir, `${messageId}.${ext}`), buffer)
    logger.warn('uploadMessageAttachment: Supabase not configured, saved locally')
    return path
  }

  const { error } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false })

  if (error) {
    logger.error('uploadMessageAttachment failed', error as Error)
    throw new Error('Kunde inte ladda upp bilagan. Försök igen.')
  }

  return path
}

/**
 * Delete a message attachment from private storage.
 */
export async function deleteMessageAttachment(path: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.storage.from(MESSAGE_BUCKET).remove([path])
  if (error) {
    logger.error('deleteMessageAttachment failed', { path, error })
  }
}

/**
 * Create a signed URL for a message attachment (1 hour expiry).
 * Returns null if generation fails.
 */
export async function createMessageSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabase()

  if (!supabase) {
    // Dev fallback: return local URL
    const filename = path.split('/').pop() ?? path
    return `/uploads/${MESSAGE_BUCKET}/${filename}`
  }

  const { data, error } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    logger.error('createMessageSignedUrl failed', { path, error })
    return null
  }

  return data.signedUrl
}

/**
 * Batch-create signed URLs for multiple message attachments (1 hour expiry).
 * Returns one entry per path — null if that path failed.
 * Uses a single Supabase Storage API call instead of N calls.
 */
export async function createMessageSignedUrls(
  paths: string[]
): Promise<(string | null)[]> {
  if (paths.length === 0) return []

  const supabase = getSupabase()

  if (!supabase) {
    return paths.map((p) => {
      const filename = p.split('/').pop() ?? p
      return `/uploads/${MESSAGE_BUCKET}/${filename}`
    })
  }

  const { data, error } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .createSignedUrls(paths, 3600)

  if (error || !data) {
    logger.error('createMessageSignedUrls failed', { paths, error })
    return paths.map(() => null)
  }

  return data.map((item) => item.signedUrl ?? null)
}
