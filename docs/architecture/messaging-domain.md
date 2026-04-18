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
  id              String    @id @default(cuid())
  bookingId       String    @unique
  booking         Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  createdAt       DateTime  @default(now())
  lastMessageAt   DateTime  @default(now())
  messages        Message[]

  @@index([lastMessageAt])
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
| `Conversation.bookingId @unique` | 1-1 med Booking i MVP. Unique-constraint skapar automatiskt B-tree-index — separat `@@index([bookingId])` vore redundant. Om 1-N behövs i framtiden droppas `@unique` då (se [Decisions](#decisions)). |
| `lastMessageAt` istället för `@updatedAt` | Prisma `@updatedAt` triggas av ändringar på Conversation-modellen — inte automatiskt av nya Messages. `ConversationService.sendMessage()` uppdaterar `lastMessageAt` explicit i samma transaction som Message-insert, vilket ger korrekt inkorg-sortering utan att touchea andra fält. |
| Lazy creation i `sendMessage()` | Inga tomma Conversation-rader. Första meddelandet skapar tråden via `$transaction { upsert Conversation; create Message; }`. Upsert på `@unique bookingId` är atomisk (PostgreSQL garanterar det), transaction-wrappern säkerställer att Message + Conversation skapas som ett logiskt par. |
| `Message.senderId` som String, ej Prisma-relation till User | Identitet används bara för UI-rendering + authz-matchning mot Booking. Namn-lookup sker via Booking-relation (`booking.customer.firstName/lastName` eller `booking.provider.businessName`) — same JOIN som ownership-guard redan gör. Ingen separat `getSenderName`-repo-metod. |
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

**Implementation (N+1-skydd):** Endpoint delegerar till en dedikerad repo-metod `IConversationRepository.getInboxForProvider(providerId)` som gör aggregeringen i en enda query. Två alternativa strategier — S35-1 väljer den som benchmark-testas bäst:

```ts
// Alternativ A: Prisma med nested take:1 + _count
prisma.conversation.findMany({
  where: { booking: { providerId } },
  orderBy: { lastMessageAt: 'desc' },
  select: {
    id: true,
    lastMessageAt: true,
    booking: { select: { id: true, bookingDate: true, customer: { select: { firstName: true, lastName: true } } } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { content: true, createdAt: true, senderType: true },
    },
    _count: { select: { messages: { where: { readAt: null, senderType: 'CUSTOMER' } } } },
  },
})

// Alternativ B: raw SQL med LATERAL JOIN (om A blir långsam på verklig data)
```

**Skrivs uttryckligen i S35-1:** Ingen naiv loop (`for conversation { fetch last; count unread; }`). Repo-metoden är benchmark-testad mot realistisk dataset-storlek (100 konversationer, 50 meddelanden/tråd). Om query-tid > 200ms → byt till raw SQL.

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
--
-- KRITISKT: PostgreSQL RLS har inte kolumn-nivå inom policies, så vi kombinerar
-- två mekanismer:
--   1. REVOKE/GRANT på kolumn-nivå: authenticated får bara UPDATE på "readAt".
--      Försök att uppdatera content/senderType/senderId/createdAt via Supabase-
--      klienten avvisas av GRANT-lagret före RLS ens utvärderas.
--   2. USING + WITH CHECK: policies säkerställer att bara mottagare kan markera.
--
-- Prisma (service_role) bypassar både GRANT och RLS — men `Message.update` i
-- repository-lagret begränsar explicit `data:` till `{ readAt }` som extra skydd.

REVOKE UPDATE ON public."Message" FROM authenticated;
GRANT UPDATE ("readAt") ON public."Message" TO authenticated;

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
  )
  WITH CHECK (
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
  )
  WITH CHECK (
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

Två-lagers limiter på skriv-endpoints: per-user-limit skyddar mot enskild komprometterad session; per-conversation-limit skyddar individuell mottagare mot spam-beteende (relevant om leverantör hanterar 20+ aktiva bokningar).

| Endpoint | Limiter | Quota | Motivering |
|----------|---------|-------|------------|
| POST `/api/bookings/[id]/messages` | `messageLimiter:user` (ny) | 30/min/user | Global burst-gräns |
| POST `/api/bookings/[id]/messages` | `messageLimiter:conversation` (ny) | 10/min/conversation | Skyddar mottagare; namespace per `conversationId` |
| GET-endpoints | existerande läs-limiter | default | Inkorg polling var 30s ≈ 2 req/min per flik |
| PATCH read | existerande läs-limiter | default | Idempotent, låg belastning |

**Placering:** `src/lib/rate-limit.ts` får två nya exporter: `messageUserLimiter` och `messageConversationLimiter`. Båda Upstash Redis. **Fail-closed:** `RateLimitServiceError` → 503.

**Ordning i route:** `auth()` → `messageUserLimiter.check(userId)` → `messageConversationLimiter.check(conversationId)` → Zod-parse → service-call.

**Observation:** 30/min + 10/min är bedömningar utan data. Loggar 429-hits med `logger.warn('message.rate_limit_hit', { userId, conversationId, limiter })` och justerar baserat på verklig användning post-launch.

## Notifier-integration

`MessageNotifier` implementeras i `src/domain/notification/MessageNotifier.ts` enligt samma mönster som `RouteAnnouncementNotifier`. **Viktigt:** Namn-lookup (sender + recipient) sker via Booking-relationen som service-lagret redan laddar för authz-check — ingen separat `getSenderName`-metod.

```ts
interface MessageNotifierDeps {
  notificationService: { createAsync: (input: CreateNotificationInput) => Promise<void> }
  getRecipientUserId: (bookingId: string, recipientRole: 'CUSTOMER' | 'PROVIDER') => Promise<string | null>
}

class MessageNotifier {
  async notifyNewMessage(input: {
    bookingId: string
    conversationId: string
    senderType: MessageSenderType
    senderName: string        // resolverad från Booking i ConversationService innan notifier anropas
    recipientRole: 'CUSTOMER' | 'PROVIDER'
    contentPreview: string    // trunkat till 80 tecken
  }): Promise<void> {
    // bygger title/body/deepLink och delegerar till notificationService.createAsync
  }
}
```

**Integrationsmönster i ConversationService** (följer `ReviewService.sendReviewNotification`):

```ts
// ConversationService.ts (skiss)
async sendMessage(input: SendMessageInput): Promise<Result<Message, ConversationError>> {
  const result = await this.deps.conversationRepository.createMessage(/* ... */)
  if (result.isFailure) return result
  // Privat metod — internhanterar fel, service returnerar success oavsett notifier-utfall
  this.sendMessageNotification(input.booking, result.value)
  return result
}

private sendMessageNotification(booking: Booking, message: Message): void {
  void this.deps.messageNotifier
    .notifyNewMessage({
      bookingId: booking.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderName: resolveSenderName(booking, message),  // från Booking-relationen
      recipientRole: message.senderType === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER',
      contentPreview: truncate(message.content, 80),
    })
    .catch((err) => logger.error('message.notify_failed', { messageId: message.id, err }))
}
```

**Fire-and-forget**: Notifier-fel får ALDRIG bryta meddelande-leveransen. HTTP 201 skickas först, push skjutas asynkront.

**Push-payload**:
- `title`: `"Nytt meddelande från {senderName}"`
- `body`: `truncate(content, 80)` (återanvänder `truncate` från `src/lib/notification-helpers.ts`)
- `deepLink`:
  - Provider-mottagare: `/provider/bookings/{bookingId}/messages`
  - Customer-mottagare: `/customer/bookings/{bookingId}` (använder samma sida som bokningsdetaljer; tråd renderas som sektion)

**Quiet hours, in-app-detektering, sammanslagning av notiser**: **Ej i MVP**. Beslut avvaktas till Slice 3 när vi har data om verklig användning.

## Feature flag

Hela domänen gatas bakom flag `messaging` (default: `false` initialt). Gating sker på två nivåer (defense-in-depth, per `.claude/rules/feature-flags.md`):

1. **Route-nivå**: Varje route returnerar 404 om `!isFeatureEnabled('messaging')`. Fångas även av navigations-UI som döljer "Meddelanden"-fliken.
2. **Service-nivå**: `ConversationService.sendMessage` returnerar `Result.fail(FeatureDisabledError)` om flag saknas — skyddar om route-gaten glöms.

Metadata läggs till i `src/lib/feature-flag-definitions.ts` i S35-1. Flag slås på via admin/system när S35-1 + S35-2 är deployade och E2E är grön.

**Rollout-plan**: Off → staff-only (manuell DB-override) → 10% providers (via admin-UI) → 100%.

## Status-gating

Faktiska `BookingStatus`-värden (från `src/domain/booking/BookingStatus.ts`): `pending`, `confirmed`, `cancelled`, `completed`, `no_show`. **Inget `completedAt`-fält finns** på `Booking` idag — bara `bookingDate`, `createdAt`, `updatedAt`.

| BookingStatus | Skicka meddelande | Läsa historik | Not |
|---------------|-------------------|----------------|-----|
| `pending`   | ✅ | ✅ | Kund + leverantör kan koordinera innan bekräftelse |
| `confirmed` | ✅ | ✅ | Huvud-case |
| `completed` | ⚠️ 30 dagar efter `bookingDate` | ✅ | Tillåter uppföljning efter utförd tjänst. Efter 30 dagar: 409 |
| `cancelled` | ❌ 409 | ✅ | Historik läsbar, ingen ny kommunikation |
| `no_show`   | ❌ 409 | ✅ | Historik läsbar, ingen ny kommunikation |

**30-dagars-fönstret**: Baseras på `bookingDate + 30 days`, inte separat `completedAt`-tidsstämpel (som inte finns). Detta är tillräckligt för MVP — om vi senare vill ha exakt "30 dagar från avslutad tjänst" lägger vi till `completedAt` i separat migration.

**Implementation:** `ConversationService.sendMessage()` läser Booking-status + `bookingDate` och returnerar `Result.fail(new BookingStatusClosedError())` → 409 om skrivning inte är tillåten. Läsning är alltid tillåten om ownership finns (för historik).

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

### D8: Status-gating: terminala statusar stängda (utom completed 30 dagar)
**Datum:** 2026-04-18 · **Status:** Accepted (verifierad mot BookingStatus-enum)
Giltiga statusar: `pending`, `confirmed`, `cancelled`, `completed`, `no_show`. `cancelled` + `no_show` blockeras helt för skrivning. `completed` tillåts i 30 dagar efter `bookingDate`. Inget `completedAt`-fält finns — 30-dagars-fönstret räknas från `bookingDate`, vilket är tillräckligt för MVP.

### D9: Feature flag `messaging` (default: false)
**Datum:** 2026-04-18 · **Status:** Accepted
Två-lagers gating (route + service). Gradvis rollout via admin-UI post-deploy.

### D10: RLS UPDATE skyddas med WITH CHECK + kolumn-nivå GRANT
**Datum:** 2026-04-18 · **Status:** Accepted (från security-reviewer M1)
PostgreSQL RLS har ingen kolumn-nivå-check i policies. För att förhindra content-editing via Supabase-klient: `REVOKE UPDATE ON Message FROM authenticated; GRANT UPDATE (readAt) ON Message TO authenticated;` kombinerat med `WITH CHECK` i UPDATE-policyer. Prisma (service_role) bypassar RLS — repository begränsar explicit `data: { readAt }` i `markMessageAsRead`.

### D11: Två-lagers rate limit (user + conversation)
**Datum:** 2026-04-18 · **Status:** Accepted (från security-reviewer m2)
`messageUserLimiter` (30/min/user) + `messageConversationLimiter` (10/min/conversation). Skyddar både global session-missbruk och per-mottagare-spam.

### D12: `lastMessageAt` istället för `@updatedAt`
**Datum:** 2026-04-18 · **Status:** Accepted (från tech-architect S2)
`@updatedAt` triggas inte av child-insert. Explicit `lastMessageAt` uppdateras i samma transaction som Message-insert för korrekt inkorg-sortering.

## Öppna frågor

Följande punkter kvarstår att verifiera i S35-1 men blockerar inte starten:

1. **`getRecipientUserId`-implementation**: Provider har `providerId` i app_metadata, men mappningen provider → user (för push-token lookup) behöver verifieras mot existerande `PushDeliveryService`-flöde. **S35-1** granskar `PushDeliveryService` innan notifier-integration påbörjas.
2. **`auth.uid()::text` vs `Booking.customerId`**: Existerande policy `booking_customer_read` använder samma kast — verifiera att typerna matchar i praktiken via RLS-bevistest i `src/__tests__/rls/conversation.test.ts`.
3. **Inkorg-query-strategi (A vs B)**: S35-1 benchmark-testar båda alternativen mot realistisk dataset-storlek. Om A > 200ms → byt till raw SQL med LATERAL JOIN.
4. **Customer-inkorg**: I MVP har kund ingen separat inkorg — meddelanden visas på bokningsdetaljsidan. Om kund har flera aktiva bokningar är detta suboptimalt. Lägg till kund-inkorg i Slice 2 om användardata visar behov.
5. **Bulk read-markering optimistic locking**: Inte nödvändigt i MVP. `readAt`-uppdatering är idempotent; race mellan tab-A och tab-B på samma user skapar bara en oskadlig dubbel-skrivning.

Följande minor-punkter från review skjuts till S35-1 som konkreta test-uppgifter snarare än design-beslut:

- **Test: kund kan INTE markera egna meddelanden som lästa** (säkerhets-reviewer m1). Test läggs i `conversation.test.ts`.
- **Test: en kund med flera bokningar kan INTE posta till fel tråd** (säkerhets-reviewer under "Status-gating"). E2E-test.
- **Privacy-note om push-preview** (säkerhets-reviewer m4). Hjälpartikel uppdateras i S35-3.
- **Deep-link-validering i iOS** (säkerhets-reviewer m5). S35-3 säkerställer att native klient inte blint följer deep-link utan ownership-check.

### Bortom MVP (dokumenterat för spårbarhet)

- **Hard-delete för GDPR user-radering** (D7 + säkerhets-reviewer s3): nuvarande Cascade från Booking räcker för MVP. Om Dataskyddsombudet kräver partiell anonymisering (user raderas men bokningar sparas av redovisningsskäl) → separat PR som anonymiserar `senderId` → `"deleted-user"`.
- **Anomali-detektion** (säkerhets-reviewer s2): incident-runbook kompletteras i Slice 3 med manuell disable-procedur för `messageUserLimiter` per user.

## Review-historik

**2026-04-18** — Plan-review i S35-0:
- **tech-architect**: 0 blockers, 3 majors (status-enum, inkorg N+1, RLS UPDATE utan WITH CHECK), 4 minors (redundant index, getSenderName via Booking, feature flag saknad, notifier privat metod), 2 suggestions. Alla majors + relevanta minors åtgärdade i detta dokument.
- **security-reviewer**: 0 blockers, 2 majors (UPDATE content-editing, typkast-verifiering), 5 minors, 3 suggestions. M1 åtgärdad med GRANT + WITH CHECK. M2 blir test-verifiering i S35-1.

Kvarvarande (medvetna uppskjutningar): deep-link-verifiering i iOS (→ S35-3), anomali-detektion (→ post-launch), GDPR partial-radering (→ separat PR vid behov).

## Referenser

- Epic: [docs/ideas/epic-messaging.md](../ideas/epic-messaging.md)
- Sprint: [docs/sprints/sprint-35.md](../sprints/sprint-35.md)
- RLS-mönster: `prisma/migrations/20260404120000_rls_read_policies/migration.sql`
- Notifier-mönster: `src/domain/notification/RouteAnnouncementNotifier.ts`
- Domän-mönster: `src/domain/review/ReviewService.ts`, `src/domain/customer-review/CustomerReviewService.ts`
- API-säkerhet: [.claude/rules/api-routes.md](../../.claude/rules/api-routes.md)
