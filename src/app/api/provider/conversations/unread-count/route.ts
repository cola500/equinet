import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-dual'
import { rateLimiters, RateLimitServiceError } from '@/lib/rate-limit'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { ConversationService } from '@/domain/conversation/ConversationService'
import { PrismaConversationRepository } from '@/infrastructure/persistence/conversation/PrismaConversationRepository'

// -----------------------------------------------------------
// GET /api/provider/conversations/unread-count
// -----------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })
    }

    // 2. Feature flag
    if (!(await isFeatureEnabled('messaging'))) {
      return NextResponse.json({ error: 'Ej tillgänglig' }, { status: 404 })
    }

    // 3. Provider-only
    if (authUser.userType !== 'provider') {
      return NextResponse.json({ error: 'Åtkomst nekad' }, { status: 403 })
    }

    // 4. Rate limiting
    try {
      const allowed = await rateLimiters.api(`provider-unread:${authUser.id}`)
      if (!allowed) {
        return NextResponse.json({ error: 'För många förfrågningar. Försök igen om en stund.' }, { status: 429 })
      }
    } catch (err) {
      if (err instanceof RateLimitServiceError) {
        return NextResponse.json({ error: 'Tjänsten är tillfälligt otillgänglig' }, { status: 503 })
      }
      throw err
    }

    // 5. Fetch unread count
    const repo = new PrismaConversationRepository()
    const service = new ConversationService({ conversationRepository: repo, isFeatureEnabled })
    const count = await service.getTotalUnreadForProvider(authUser.id)

    return NextResponse.json({ count })
  } catch (error) {
    logger.error('Error fetching unread count', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
