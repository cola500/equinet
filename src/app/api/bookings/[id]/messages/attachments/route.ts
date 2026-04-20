/**
 * @domain conversation
 * POST /api/bookings/[id]/messages/attachments — upload an image attachment
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-dual'
import { rateLimiters, RateLimitServiceError } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { loadBookingForMessaging } from '@/domain/conversation/loadBookingForMessaging'
import { PrismaConversationRepository } from '@/infrastructure/persistence/conversation/PrismaConversationRepository'
import { createMessageNotifier } from '@/domain/notification/MessageNotifierFactory'
import { ConversationService } from '@/domain/conversation/ConversationService'
import {
  validateMessageAttachment,
  uploadMessageAttachment,
  deleteMessageAttachment,
} from '@/lib/supabase-storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params

    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })
    }

    // 2. Feature flag
    if (!(await isFeatureEnabled('messaging'))) {
      return NextResponse.json({ error: 'Ej tillgänglig' }, { status: 404 })
    }

    // 3. Rate limiting (before body parse)
    try {
      const allowed = await rateLimiters.messageUpload(authUser.id)
      if (!allowed) {
        return NextResponse.json(
          { error: 'För många uppladdningar. Försök igen senare.' },
          { status: 429 }
        )
      }
    } catch (err) {
      if (err instanceof RateLimitServiceError) {
        return NextResponse.json({ error: 'Tjänsten är tillfälligt otillgänglig' }, { status: 503 })
      }
      throw err
    }

    // 4. Booking ownership check (IDOR guard)
    const userType = authUser.userType as 'customer' | 'provider'
    const booking = await loadBookingForMessaging(bookingId, authUser.id, userType)
    if (!booking) {
      return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 })
    }

    // 5. Early Content-Length guard — avvisa innan bodyn läses in för att minska DoS-risk
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const declaredSize = parseInt(contentLength, 10)
      if (!isNaN(declaredSize) && declaredSize > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Filen är för stor. Max 10 MB.' }, { status: 413 })
      }
    }

    // 6. Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 })
    }

    // 7. Validate file (MIME + size + magic bytes)
    const buffer = Buffer.from(await file.arrayBuffer())
    const validationError = await validateMessageAttachment(buffer, file.type)
    if (validationError) {
      const status = validationError.code === 'TOO_LARGE' ? 413 : 400
      return NextResponse.json({ error: validationError.message }, { status })
    }

    // 8. Pre-compute storage path so DB and storage stay in sync
    const messageId = crypto.randomUUID()
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp',
    }
    const ext = extMap[file.type] ?? 'jpg'
    const storagePath = `${bookingId}/${messageId}.${ext}`

    // 9. Persist message record first (rollback if upload fails)
    const repo = new PrismaConversationRepository()
    const service = new ConversationService({
      conversationRepository: repo,
      isFeatureEnabled,
      messageNotifier: createMessageNotifier(),
    })
    const senderType = userType === 'customer' ? 'CUSTOMER' : 'PROVIDER'

    const result = await service.sendMessage({
      booking,
      senderType,
      senderId: authUser.id,
      content: '',
      messageId,
      attachment: {
        url: storagePath,
        type: file.type,
        sizeBytes: buffer.byteLength,
      },
    })

    if (result.isFailure) {
      return NextResponse.json({ error: 'Kunde inte skicka meddelandet' }, { status: 422 })
    }

    const msg = result.value

    // 10. Upload to private storage — rollback on failure
    try {
      await uploadMessageAttachment(bookingId, msg.id, buffer, file.type)
    } catch (uploadErr) {
      logger.error('uploadMessageAttachment failed, rolling back message', {
        messageId: msg.id,
        err: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      })
      try {
        await repo.deleteMessage(msg.id)
      } catch (rollbackErr) {
        logger.error('rollback deleteMessage failed — orphaned message row', {
          messageId: msg.id,
          err: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        })
      }
      return NextResponse.json({ error: 'Kunde inte ladda upp bilagan. Försök igen.' }, { status: 500 })
    }

    logger.info('attachment.uploaded', { bookingId, messageId: msg.id, senderType, storagePath })

    return NextResponse.json(
      {
        id: msg.id,
        conversationId: msg.conversationId,
        senderType: msg.senderType,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        readAt: msg.readAt?.toISOString() ?? null,
        attachmentUrl: msg.attachmentUrl,
        attachmentType: msg.attachmentType,
        attachmentSize: msg.attachmentSize,
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Error uploading attachment', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
