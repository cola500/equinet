import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-dual'
import { rateLimiters, RateLimitServiceError } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { ConversationService } from '@/domain/conversation/ConversationService'
import { mapConversationErrorToStatus } from '@/domain/conversation/mapConversationErrorToStatus'
import { loadBookingForMessaging } from '@/domain/conversation/loadBookingForMessaging'
import { PrismaConversationRepository } from '@/infrastructure/persistence/conversation/PrismaConversationRepository'
import { createMessageNotifier } from '@/domain/notification/MessageNotifierFactory'

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict()

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

// -----------------------------------------------------------
// POST /api/bookings/[id]/messages -- send a message
// -----------------------------------------------------------

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

    // 2. Feature flag (before rate limiting to avoid consuming tokens when disabled)
    if (!(await isFeatureEnabled('messaging'))) {
      return NextResponse.json({ error: 'Ej tillgänglig' }, { status: 404 })
    }

    // 3. Rate limiting per user (before body parse)
    try {
      const allowedUser = await rateLimiters.messageUser(`${authUser.id}:${bookingId}`)
      if (!allowedUser) {
        return NextResponse.json(
          { error: 'För många meddelanden. Försök igen senare.' },
          { status: 429 }
        )
      }
    } catch (err) {
      if (err instanceof RateLimitServiceError) {
        return NextResponse.json({ error: 'Tjänsten är tillfälligt otillgänglig' }, { status: 503 })
      }
      throw err
    }

    // 4. Parse + validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
    }

    const parseResult = sendMessageSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Valideringsfel' }, { status: 400 })
    }

    // 5. Booking ownership check (IDOR guard)
    const userType = authUser.userType as 'customer' | 'provider'
    const booking = await loadBookingForMessaging(bookingId, authUser.id, userType)
    if (!booking) {
      return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 })
    }

    // 6. Per-conversation rate limit
    try {
      const allowedConv = await rateLimiters.messageConversation(
        `${authUser.id}:conv:${bookingId}`
      )
      if (!allowedConv) {
        return NextResponse.json(
          { error: 'För många meddelanden. Försök igen senare.' },
          { status: 429 }
        )
      }
    } catch (err) {
      if (err instanceof RateLimitServiceError) {
        return NextResponse.json({ error: 'Tjänsten är tillfälligt otillgänglig' }, { status: 503 })
      }
      throw err
    }

    // 7. Send message via service
    const senderType = userType === 'customer' ? 'CUSTOMER' : 'PROVIDER'
    const repo = new PrismaConversationRepository()
    const service = new ConversationService({
      conversationRepository: repo,
      isFeatureEnabled,
      messageNotifier: createMessageNotifier(),
    })

    const result = await service.sendMessage({
      booking,
      senderType,
      senderId: authUser.id,
      content: parseResult.data.content,
    })

    if (result.isFailure) {
      return mapConversationErrorToStatus(result.error)
    }

    const msg = result.value
    logger.info('message.sent', { bookingId, conversationId: msg.conversationId, senderType })

    return NextResponse.json(
      {
        id: msg.id,
        conversationId: msg.conversationId,
        senderType: msg.senderType,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        readAt: msg.readAt?.toISOString() ?? null,
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Error sending message', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}

// -----------------------------------------------------------
// GET /api/bookings/[id]/messages -- list messages
// -----------------------------------------------------------

export async function GET(
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

    // 3. Rate limiting per user
    const allowed = await rateLimiters.messageUser(`${authUser.id}:get:${bookingId}`)
    if (!allowed) {
      return NextResponse.json(
        { error: 'För många förfrågningar. Försök igen om en stund.' },
        { status: 429 }
      )
    }

    // 4. Booking ownership check
    const userType = authUser.userType as 'customer' | 'provider'
    const booking = await loadBookingForMessaging(bookingId, authUser.id, userType)
    if (!booking) {
      return NextResponse.json({ error: 'Bokning hittades inte' }, { status: 404 })
    }

    // 5. Parse + validate query params
    const url = new URL(request.url)
    const queryParse = listQuerySchema.safeParse({
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    const { cursor, limit = 50 } = queryParse.success ? queryParse.data : { cursor: undefined, limit: 50 }

    // 6. List messages
    const repo = new PrismaConversationRepository()
    const service = new ConversationService({ conversationRepository: repo, isFeatureEnabled })
    const result = await service.listMessages({ bookingId, cursor, limit })

    const senderType = userType === 'customer' ? 'CUSTOMER' : 'PROVIDER'

    return NextResponse.json({
      messages: result.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderType: m.senderType,
        senderName: m.senderType === 'CUSTOMER' ? booking.customerName : booking.providerName,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
        isFromSelf: m.senderType === senderType,
      })),
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    logger.error('Error listing messages', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
