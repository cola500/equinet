---
title: "Messaging-domän (Conversation + Message)"
description: "Arkitekturbeslut för per-bokning tvåvägs text-chat mellan kund och leverantör (Slice 1 MVP)"
category: architecture
status: draft
last_updated: 2026-04-18
tags: [messaging, conversation, rls, domain, ddd]
depends_on:
  - docs/ideas/epic-messaging.md
  - docs/architecture/booking-flow.md
  - docs/architecture/database.md
related:
  - .claude/rules/api-routes.md
  - .claude/rules/prisma.md
sections:
  - Syfte och scope
  - Domänplacering
  - Schema
  - API-kontrakt
  - Ownership och auth
  - RLS-policies
  - Rate limiting
  - Notifier-integration
  - Status-gating
  - Observability
  - Decisions
  - Öppna frågor
---

# Messaging-domän (Conversation + Message)

## Syfte och scope

Denna domän levererar **Slice 1 MVP** av epic [Bokningskommunikation](../ideas/epic-messaging.md): tvåvägs text-chat mellan kund och leverantör, kopplad till en specifik bokning, uppdaterad via SWR-polling.

**Inkluderat:**
- `Conversation` (1-1 per Booking) + `Message` (1-N per Conversation)
- REST-API för kund- och leverantör-flöden + inkorg-aggregering
- RLS-policies för läsning, skrivning och läs-markering
- Push-notifiering vid nytt meddelande (via `MessageNotifier`)

**Explicit ej i scope (senare slices):**
- Bilagor (bilder) → Slice 2
- Realtid (Supabase Realtime) → Slice 3 (polling räcker i MVP)
- Röstmeddelanden → Slice 4
- Förfrågningar FÖRE bokning → Slice 5
- Native iOS-vyer (WebView räcker initialt)
- Quiet hours / in-app-detektering för push
- Läskvitton per meddelande (endast aggregerad unread-count i MVP)

## Domänplacering

**Beslut:** Egen kärndomän `conversation` (`src/domain/conversation/`), repository obligatoriskt.

**Motivering:**
1. Conversation har egen livscykel. Slice 5 (pre-booking-förfrågningar) kräver att Conversation kan existera utan Booking. Att lyfta bort `bookingId`-kravet senare är enklare om domänen redan är egen.
2. Slice 2 introducerar `MessageAttachment` — hör hemma i conversation-domänen, inte booking-domänen.
3. Följer `CustomerReview`-mönstret: egen kärndomän kopplad till Booking via FK.

**Struktur:**

```
src/domain/conversation/
├─ ConversationService.ts          # findOrCreateForBooking, sendMessage, markAsRead
├─ ConversationService.test.ts     # BDD dual-loop integration-tester
├─ mapConversationErrorToStatus.ts # Result → HTTP status

src/infrastructure/persistence/conversation/
├─ IConversationRepository.ts
├─ MockConversationRepository.ts
├─ PrismaConversationRepository.ts
├─ ConversationMapper.ts           # Prisma → domain

src/domain/notification/
└─ MessageNotifier.ts              # Fire-and-forget push trigger
```

## Schema

```prisma
enum MessageSenderType {
  CUSTOMER
  PROVIDER
}

model Conversation {
  id         String    @id @default(cuid())
  bookingId  String    @unique
  booking    Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  messages   Message[]

  @@index([bookingId])
  @@index([updatedAt])
}

model Message {
  id              String             @id @default(cuid())
  conversationId  String
  conversation    Conversation       @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderType      MessageSenderType
  senderId        String
  content         String             @db.VarChar(2000)
  createdAt       DateTime           @default(now())
  readAt          DateTime?

  @@index([conversationId, createdAt])
  @@index([conversationId, readAt])
}
```

### Schema-designval

| Val | Motivering |
|-----|------------|
| `Conversation.bookingId @unique` | 1-1 med Booking i MVP. Om 1-N behövs i framtiden droppas `@unique` då (se [Decisions](#decisions)). |
| Lazy creation i `sendMessage()` | Inga tomma Conversation-rader. Första meddelandet skapar tråden via `$transaction` + upsert (skyddar mot race). |
| `Message.senderId` som String, ej Prisma-relation till User | Identitet används bara för UI-rendering + authz-matchning mot Booking. Relation hade krävt extra JOIN utan värde. |
| `Message.readAt` på meddelande-nivå, inte Conversation-nivå | Tillåter per-meddelande-markering i framtiden. MVP läser bara "senderType=motpart AND readAt IS NULL" för unread-count. |
| `onDelete: Cascade` från Booking | GDPR-alignat. Bokning raderas → tråd försvinner. Acceptabelt eftersom tråden är per-bokning. |
| `@@index([conversationId, readAt])` | Inkorg räknar olästa per tråd. Index på `(conversationId, readAt)` tillåter partial-scan. |
| `@db.VarChar(2000)` | Hård gräns på DB-nivå för att backa upp Zod-gränsen. |

### Varför inte `Booking.conversationId`?

Alternativ: lägg FK på Booking istället för Conversation. **Avvisat** eftersom:
- Conversation utan Booking (Slice 5) kräver att relationen står på Conversation-sidan.
- `onDelete: Cascade` från Booking → Conversation är semantiskt tydligare när FK är på child-tabellen.

## API-kontrakt

| Metod | Endpoint | Roll | Syfte | Rate limit |
|-------|----------|------|-------|-----------|
| GET  | `/api/bookings/[id]/messages` | customer + provider | Lista meddelanden i tråd, ny-till-gammal paginerad | läs-limiter |
| POST | `/api/bookings/[id]/messages` | customer + provider | Skicka text-meddelande | 30/min |
| PATCH| `/api/bookings/[id]/messages/read` | customer + provider | Markera alla olästa från motpart som lästa | läs-limiter |
| GET  | `/api/provider/conversations` | provider | Inkorg: bokningar med meddelanden + unread-count + senaste snippet | läs-limiter |
| GET  | `/api/provider/conversations/unread-count` | provider | Lätt-endpoint för BottomTabBar-badge | läs-limiter |

### Request/response-kontrakt (förslag, verifieras i S35-1)

**POST `/api/bookings/[id]/messages`**

```ts
// Zod .strict()
const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict()

// Response (201)
interface SendMessageResponse {
  id: string
  conversationId: string
  senderType: 'CUSTOMER' | 'PROVIDER'
  content: string
  createdAt: string  // ISO 8601
}
```

**GET `/api/bookings/[id]/messages?cursor=<messageId>&limit=50`**

```ts
interface ListMessagesResponse {
  messages: {
    id: string
    senderType: 'CUSTOMER' | 'PROVIDER'
    senderName: string        // från JOIN, t.ex. "Anna Karlsson"
    content: string
    createdAt: string
    readAt: string | null
    isFromSelf: boolean       // beräknat serverside mot session
  }[]
  nextCursor: string | null
}
```

**GET `/api/provider/conversations`**

```ts
interface InboxResponse {
  conversations: {
    conversationId: string
    bookingId: string
    bookingDate: string       // för sortering/visning
    customerName: string
    lastMessage: {
      content: string           // trunkat till 120 tecken
      createdAt: string
      senderType: 'CUSTOMER' | 'PROVIDER'
    }
    unreadCount: number
  }[]
}
```

**PATCH `/api/bookings/[id]/messages/read`**

Tom body. Markerar alla `Message` i tråden med `senderType ≠ session-roll` och `readAt IS NULL` som `readAt = NOW()`. Idempotent.

### Svenska felmeddelanden

| Fel | Status | Text |
|-----|--------|------|
| Ej inloggad | 401 | `"Ej inloggad"` |
| Bokning ej åtkomlig | 404 | `"Bokning hittades inte"` |
| Fel bokningsstatus | 409 | `"Kan inte skicka meddelande till avslutad bokning"` |
| Validering | 400 | `"Valideringsfel"` |
| Rate limit | 429 | `"För många meddelanden. Försök igen senare."` |
| Rate limiter nere | 503 | `"Tjänsten är tillfälligt otillgänglig"` |
| Internt fel | 500 | `"Internt serverfel"` |

## Ownership och auth

**Princip (defense-in-depth):** RLS + route-nivå ownership guards + session-baserad senderId.

1. **Session-baserad identitet**: `auth()` + null-check → 401. `senderId` och `senderType` härleds **alltid** från session — aldrig från request body.
2. **Booking ownership före Conversation-access**: Varje route börjar med
   ```ts
   const booking = await bookingRepo.findByIdForProvider(bookingId, session.providerId)
   // eller .findByIdForCustomer(bookingId, session.userId)
   if (!booking) return 404  // Inte 403 — undvik existens-läcka
   ```
   `conversationId` ensamt ger ALDRIG access. Alla queries går via Booking-relationen.
3. **Cross-role check i sendMessage**: Service validerar att `session.role === 'PROVIDER'` matchar `booking.providerId === session.providerId`, eller `session.role === 'CUSTOMER'` matchar `booking.customerId === session.userId`.

## RLS-policies

RLS är **defense-in-depth**. Prisma (service_role) bypassar RLS, men policyer skyddar mot framtida Supabase-klient-skrivningar och mot trasiga route-nivå-guards.

```sql
ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Conversation -- READ
-- ============================================================================

CREATE POLICY conversation_customer_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY conversation_provider_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- ============================================================================
-- Conversation -- INSERT (endast för bokning man äger)
-- ============================================================================

CREATE POLICY conversation_customer_insert ON public."Conversation"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY conversation_provider_insert ON public."Conversation"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- ============================================================================
-- Message -- READ (via Conversation → Booking ownership)
-- ============================================================================

CREATE POLICY message_customer_read ON public."Message"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY message_provider_read ON public."Message"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- ============================================================================
-- Message -- INSERT (sender-identitet matchas mot session)
-- ============================================================================

CREATE POLICY message_customer_insert ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderType" = 'CUSTOMER'
    AND "senderId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY message_provider_insert ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- ============================================================================
-- Message -- UPDATE (bara readAt, bara för mottagaren)
-- ============================================================================

-- Kund markerar leverantörens meddelanden som lästa
CREATE POLICY message_customer_read_update ON public."Message"
  FOR UPDATE TO authenticated
  USING (
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

-- Leverantör markerar kundens meddelanden som lästa
CREATE POLICY message_provider_read_update ON public."Message"
  FOR UPDATE TO authenticated
  USING (
    "senderType" = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );
```

**Inga DELETE-policies** i MVP. Radering sker bara via Cascade från Booking → Conversation → Message. Om hard-delete behövs senare (GDPR user-radering) läggs policy till då.

**Pentest-krav:** `conversationId` ensamt ger ingen access. Verifiering: `SELECT` med mismatched JWT returnerar 0 rader. Bevis skrivs i S35-1 (`src/__tests__/rls/conversation.test.ts`).

## Rate limiting

| Endpoint | Limiter | Quota | Motivering |
|----------|---------|-------|------------|
| POST `/api/bookings/[id]/messages` | `messageLimiter` (ny) | 30/min/user | Chat-beteende är burstigt; 30 räcker för snabba konversationer |
| GET-endpoints | existerande läs-limiter | default | Inkorg polling var 30s ≈ 2 req/min per flik |
| PATCH read | existerande läs-limiter | default | Idempotent, låg belastning |

**Placering:** `src/lib/rate-limit.ts` får ny export `messageLimiter`. Namespace `messages:` i Upstash Redis. **Fail-closed:** `RateLimitServiceError` → 503.

**Observation:** 30/min är utan data. Vi loggar 429-hits och justerar baserat på verklig användning post-launch.

## Notifier-integration

`MessageNotifier` implementeras i `src/domain/notification/MessageNotifier.ts` enligt samma mönster som `RouteAnnouncementNotifier`:

```ts
interface MessageNotifierDeps {
  notificationService: { createAsync: (input: CreateNotificationInput) => Promise<void> }
  getRecipientUserId: (bookingId: string, recipientRole: 'CUSTOMER' | 'PROVIDER') => Promise<string | null>
  getSenderName: (senderId: string, senderType: MessageSenderType) => Promise<string>
}

class MessageNotifier {
  async notifyNewMessage(input: {
    bookingId: string
    conversationId: string
    senderId: string
    senderType: MessageSenderType
    contentPreview: string  // trunkat till 80 tecken
  }): Promise<void> {
    // ... bygger title/body/deepLink och delegerar till notificationService.createAsync
  }
}
```

**Trigger**: `ConversationService.sendMessage()` efter DB-commit kör `void notifier.notifyNewMessage(...).catch(err => logger.error(...))` — **fire-and-forget**. Notifier-fel får ALDRIG bryta meddelande-leveransen (HTTP 201 skickas först, push skjutas asynkront).

**Push-payload**:
- `title`: `"Nytt meddelande från {senderName}"`
- `body`: `truncate(content, 80)` (återanvänder `truncate` från `src/lib/notification-helpers.ts`)
- `deepLink`:
  - Provider-mottagare: `/provider/bookings/{bookingId}/messages`
  - Customer-mottagare: `/customer/bookings/{bookingId}` (använder samma sida som bokningsdetaljer; tråd renderas som sektion)

**Quiet hours, in-app-detektering, sammanslagning av notiser**: **Ej i MVP**. Beslut avvaktas till Slice 3 när vi har data om verklig användning.

## Status-gating

| BookingStatus | Skicka meddelande | Läsa historik | Not |
|---------------|-------------------|----------------|-----|
| `PENDING` | ✅ | ✅ | Kund + leverantör kan koordinera innan bekräftelse |
| `CONFIRMED` | ✅ | ✅ | Huvud-case |
| `COMPLETED_PENDING_REVIEW` | ✅ | ✅ | Uppföljning efter utförd tjänst |
| `COMPLETED` | ⚠️ 30 dagar | ✅ | Skrivs öppet i 30 dagar efter completion; sedan 409 |
| `CANCELLED` | ❌ 409 | ✅ | Historik läsbar, ingen ny kommunikation |

**Implementation:** `ConversationService.sendMessage()` läser Booking-status och returnerar `Result.fail(new BookingStatusClosedError())` → 409. Exakta statusar bekräftas i S35-1 mot `BookingStatus`-enum.

## Observability

- **Logger**: `logger.info('message.sent', { bookingId, conversationId, senderType })` — **ingen content**.
- **Sentry**: fångar alla service-fel via `withApiHandler`. Inga PII i Sentry-events.
- **Metrics** (framtid, Slice 3): antal meddelanden/dag, average response time, unread accumulation.

## Decisions

### D1: Egen kärndomän (inte underordnad Booking)
**Datum:** 2026-04-18 · **Status:** Accepted (pending tech-architect review)
Conversation blir `src/domain/conversation/` med eget repository. Motivering: Slice 2 + Slice 5 kräver att domänen är självständig.

### D2: 1-1 Booking ↔ Conversation i MVP
**Datum:** 2026-04-18 · **Status:** Accepted
`@unique` på `bookingId`. Om 1-N behövs (t.ex. separat "eftervård"-tråd) droppas `@unique` senare — icke-destruktiv migration.

### D3: Lazy creation i sendMessage
**Datum:** 2026-04-18 · **Status:** Accepted
Inga tomma Conversation-rader. Första meddelandet skapar tråden via `$transaction` + `upsert`. Skyddar mot race condition vid samtidiga skick.

### D4: senderId som plain String (ingen Prisma-relation till User)
**Datum:** 2026-04-18 · **Status:** Accepted
`senderType` + `senderId` räcker för UI-rendering och authz. Sparar JOIN. Name-lookup sker via separat call i repository (`getSenderName`).

### D5: readAt på Message-nivå
**Datum:** 2026-04-18 · **Status:** Accepted
Tillåter per-meddelande-markering i framtiden. MVP aggregerar till unread-count per tråd.

### D6: Rate limit 30/min
**Datum:** 2026-04-18 · **Status:** Tentative
Bedömning utan data. Loggas och justeras post-launch baserat på 429-hit-frekvens.

### D7: Inga DELETE-policies i MVP
**Datum:** 2026-04-18 · **Status:** Accepted
Radering via Cascade från Booking räcker. Hard-delete för GDPR user-radering planeras som separat PR om behov uppstår.

### D8: Status-gating: CANCELLED stängd, COMPLETED öppen 30 dagar
**Datum:** 2026-04-18 · **Status:** Tentative (bekräftas i S35-1 mot faktisk BookingStatus-enum)
CANCELLED blockeras helt för skrivning (historik läsbar). COMPLETED tillåts 30 dagar för uppföljningsfrågor.

## Öppna frågor

Följande punkter kvarstår att bekräfta i S35-1:

1. **Exakt BookingStatus-enum**: `BookingStatus.ts` innehåller aktuella värden; status-gating-tabellen ovan ska mappas exakt mot dessa.
2. **`getRecipientUserId`-implementation**: Provider har `providerId` i app_metadata, men mappningen provider → user (för push-token lookup) behöver verifieras mot existerande `PushDeliveryService`-flöde.
3. **Inkorg-filter**: Ska inkorg visa BARA bokningar med minst ett meddelande, eller även "tomma" (utan konversation ännu)? **Förslag:** bara med minst ett meddelande — inkorgen ska kännas aktiv, inte som en dubblerad boknings-lista.
4. **Customer-inkorg**: I MVP har kunden bara en leverantör per bokning, så ingen separat inkorg. De ser meddelanden direkt på bokningsdetaljsidan. Om kund har flera aktiva bokningar kan vi i senare slice lägga till kund-inkorg.
5. **Bulk read-markering**: PATCH `/api/bookings/[id]/messages/read` gör UPDATE på många rader. Behöver vi optimistic locking? **Förslag:** nej — read-markering är idempotent och inte konfliktkänslig.

## Referenser

- Epic: [docs/ideas/epic-messaging.md](../ideas/epic-messaging.md)
- Sprint: [docs/sprints/sprint-35.md](../sprints/sprint-35.md)
- RLS-mönster: `prisma/migrations/20260404120000_rls_read_policies/migration.sql`
- Notifier-mönster: `src/domain/notification/RouteAnnouncementNotifier.ts`
- Domän-mönster: `src/domain/review/ReviewService.ts`, `src/domain/customer-review/CustomerReviewService.ts`
- API-säkerhet: [.claude/rules/api-routes.md](../../.claude/rules/api-routes.md)
