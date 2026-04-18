import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-dual'
import { rateLimiters } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { ConversationService } from '@/domain/conversation/ConversationService'
import { loadBookingForMessaging } from '@/domain/conversation/loadBookingForMessaging'
import { PrismaConversationRepository } from '@/infrastructure/persistence/conversation/PrismaConversationRepository'

// -----------------------------------------------------------
// PATCH /api/bookings/[id]/messages/read -- mark as read
// -----------------------------------------------------------

export async function PATCH(
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
    const allowed = await rateLimiters.messageUser(`${authUser.id}:read:${bookingId}`)
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

    // 5. Mark messages as read
    const readerRole = userType === 'customer' ? 'CUSTOMER' : 'PROVIDER'
    const repo = new PrismaConversationRepository()
    const service = new ConversationService({ conversationRepository: repo })

    await service.markAsRead({ bookingId, readerRole })

    logger.info('messages.read', { bookingId, userId: authUser.id, readerRole })

    return NextResponse.json({ marked: 0 })
  } catch (error) {
    logger.error('Error marking messages as read', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
