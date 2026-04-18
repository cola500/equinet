import { NextResponse } from 'next/server'
import type { ConversationError } from './ConversationService'

export function mapConversationErrorToStatus(error: ConversationError): NextResponse {
  switch (error.type) {
    case 'BOOKING_CLOSED':
      return NextResponse.json(
        { error: 'Kan inte skicka meddelande till avslutad bokning' },
        { status: 409 }
      )
    case 'CONTENT_EMPTY':
    case 'CONTENT_TOO_LONG':
      return NextResponse.json({ error: 'Valideringsfel' }, { status: 400 })
    default:
      return NextResponse.json({ error: 'Internt serverfel' }, { status: 500 })
  }
}
