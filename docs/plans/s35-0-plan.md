---
title: "Plan: S35-0 Conversation-domän design"
description: "Plan-review av ny kärndomän för per-bokning meddelanden (Slice 1 MVP)"
category: plan
status: draft
last_updated: 2026-04-18
sections:
  - Mål
  - Scope
  - Approach
  - Filer
  - Schema-skiss
  - API-kontrakt
  - RLS-policies
  - Risker och öppna frågor
  - Reviews
---

# Plan: S35-0 Conversation-domän design

## Aktualitet verifierad

**Kommandon körda:**
- `grep "model Conversation\|model Message" prisma/schema.prisma` → inga träffar
- `ls src/domain/conversation/` → inte existerande
- `ls src/domain/message/` → inte existerande
- `ls docs/architecture/messaging-domain.md` → inte existerande

**Resultat:** Ingen Conversation/Message-domän finns i kodbasen. Inget arkitekturdokument finns för messaging.

**Beslut:** Fortsätt. S35-0 är första leveransen i messaging-epic.

## Mål

Ta fram en kompatibel arkitektur-skiss för meddelande-domänen (Slice 1 MVP) som tech-architect + security-reviewer kan godkänna **innan** någon kod skrivs. S35-1, S35-2, S35-3 ska kunna starta implementation direkt från detta beslut.

## Scope

**I scope:**
- Prisma schema-skiss: `Conversation` + `Message`
- API-yta: endpoints, metoder, rate limit, Zod-form
- RLS-policies (read + write) för båda tabeller
- Ownership guards (route-nivå) som komplement till RLS
- Notifier-integration (fire-and-forget, följer `RouteAnnouncementNotifier`-mönstret)
- Domän-placering: egen kärndomän vs underordnad Booking

**Ej i scope:**
- Faktisk migration (S35-1)
- Kod för service/repository/route (S35-1+)
- UI-design (S35-1, S35-2)
- Native iOS-vyer (WebView räcker enligt sprint-plan)

## Approach

1. **Studera referens-domäner**: CustomerReview (kärndomän med provider+customer-relation), Review (1-N aggregat med notifier).
2. **Skissa schema** i arkitekturdokumentet (`docs/architecture/messaging-domain.md`) -- inte Prisma-filen än.
3. **Skissa API-kontrakt** med exakta endpoints, Zod-schema, error-mappningar.
4. **Skissa RLS-policies** (SQL-text) för Conversation + Message. Båda tabeller måste ha policies -- "Conversation utan Message-skydd" är en IDOR-risk.
5. **Dokumentera ownership guard-plan**: varför vi har både RLS OCH route-nivå (defense-in-depth, Prisma bypassar RLS).
6. **Kör tech-architect** -- arkitektur, integration med Booking, query-patterns, notifier-DI.
7. **Kör security-reviewer** -- RLS-logik, IDOR-risker, rate limit, input-validering, content-length.
8. **Åtgärda feedback** iterativt tills inga blockers/majors.
9. **Uppdatera epic-messaging.md** med länk till arkitekturdokumentet.
10. **Skriv done-fil** och merga via PR.

## Filer

| Fil | Typ | Ändring |
|-----|-----|---------|
| `docs/architecture/messaging-domain.md` | Ny | Hela arkitektur-skissen |
| `docs/ideas/epic-messaging.md` | Ändring | Lägg till länk under "Nästa steg" |
| `docs/plans/s35-0-plan.md` | Ny | Denna fil |
| `docs/done/s35-0-done.md` | Ny | Vid avslut |
| `docs/sprints/status.md` | Ändring | Markera S35-0 done vid merge |
| `docs/sprints/session-35-docs.md` | Ny | Sessionslogg |

Ingen kod-ändring. `prisma/schema.prisma` är INTE i scope.

## Schema-skiss (för diskussion, inte Prisma-filen)

```prisma
// Enum för avsändar-typ. User-ID styr faktisk authz, enum är bara metadata för UI.
enum MessageSenderType {
  CUSTOMER
  PROVIDER
}

model Conversation {
  id         String    @id @default(cuid())
  bookingId  String    @unique  // 1-1 med Booking (per-bokning-chat)
  booking    Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt  // Senaste aktivitet, för inkorg-sortering
  messages   Message[]

  @@index([bookingId])
  @@index([updatedAt])  // för inkorg ORDER BY
}

model Message {
  id              String             @id @default(cuid())
  conversationId  String
  conversation    Conversation       @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderType      MessageSenderType
  senderId        String             // User.id (customer-user eller provider-user)
  content         String             @db.VarChar(2000)
  createdAt       DateTime           @default(now())
  readAt          DateTime?          // Null = oläst. Sätts när motparten öppnar tråden.

  @@index([conversationId, createdAt])  // för tråd-ORDER BY
  @@index([conversationId, readAt])      // för unread-count i inkorg
}
```

**Designval som tech-architect ska bedöma:**
- **`@unique` på bookingId**: ger 1-1 mellan Booking och Conversation. Alternativt kunde man låta Conversation skapas lazy vid första meddelandet. Val: lazy creation i `sendMessage()` (minimerar tomma rader).
- **`senderId` vs relation**: vi lagrar bara string-IDn, inte Prisma-relation till User. Motivering: avsändar-identitet används bara för UI-namn-rendering + authz-check (match mot bokningens customerId/providerUserId). Relation hade krävt extra JOIN utan värde.
- **`readAt` på Message, inte Conversation**: tillåter per-meddelande-markering om vi senare vill visa "läst-kryss" per rad. I MVP använder vi bara "alla meddelanden från motpart med readAt=null räknas som olästa".
- **`Booking` onDelete: Cascade**: om bokning raderas (GDPR-begäran) försvinner konversationen. Acceptabelt eftersom tråden är per-bokning.

## API-kontrakt (för diskussion)

| Metod | Endpoint | Roll | Syfte |
|-------|----------|------|-------|
| GET  | `/api/bookings/[id]/messages` | customer + provider (beroende på bokning) | Lista alla meddelanden i tråd, ny-till-gammal paginerad |
| POST | `/api/bookings/[id]/messages` | customer + provider | Skicka text-meddelande |
| PATCH| `/api/bookings/[id]/messages/read` | customer + provider | Markera alla olästa från motpart som lästa |
| GET  | `/api/provider/conversations` | provider | Inkorg-aggregering: bokningar med meddelanden + unread-count |
| GET  | `/api/provider/conversations/unread-count` | provider | Badge i BottomTabBar (lättviktig endpoint) |

**Auth**: `auth()` + null-check → 401. `providerId`/`customerId` från session, ALDRIG från body.

**Ownership guard**: Läsa `Booking` först via `findByIdForProvider(bookingId, providerId)` eller `findByIdForCustomer(bookingId, customerId)` (atomisk WHERE). Om null → 404 (inte 403, för att inte läcka existens).

**Zod .strict()**:
```ts
const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict()
```

**Rate limit**: Egen limiter `messageLimiter` (namespace `messages:`), 30 meddelanden per minut per user. Högre än booking-limiter (som är 10/min) för att chat-beteende är burstigt. Fail-closed: `RateLimitServiceError` → 503.

**Felmeddelanden** (svenska, status-koder från `mapConversationErrorToStatus`):
| Fel | Status | Svensk text |
|-----|--------|-------------|
| Ej inloggad | 401 | "Ej inloggad" |
| Åtkomst saknas till bokning | 404 | "Bokning hittades inte" |
| Bokningen har fel status | 409 | "Kan inte skicka meddelande till avslutad bokning" |
| Validering misslyckades | 400 | "Valideringsfel" |
| Rate limit | 429 | "För många meddelanden. Försök igen senare." |
| Rate limiter ur funktion | 503 | "Tjänsten är tillfälligt otillgänglig" |
| Internt fel | 500 | "Internt serverfel" |

**Status-gating**: Tråd är skrivbar för status `CONFIRMED`, `PENDING`, `COMPLETED_PENDING_REVIEW`. Stängd för `CANCELLED`, `COMPLETED` (äldre än 30 dagar). Exakta statusar verifieras i S35-1 mot `BookingStatus`.

## RLS-policies (för diskussion)

**Princip**: Prisma (service_role) bypassar RLS -- policies är **defense-in-depth** för framtida Supabase-klient-skrivningar och skydd mot trasiga route-nivå-guards.

```sql
-- ============================================================================
-- Conversation -- READ
-- ============================================================================

-- Customer reads conversations for bookings they own.
CREATE POLICY conversation_customer_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

-- Provider reads conversations for their bookings.
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
-- Conversation -- WRITE (INSERT only; system creates via sendMessage)
-- ============================================================================

-- Customer creates conversation for own booking.
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
-- Message -- INSERT (sender must match session)
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
-- Message -- UPDATE (only readAt, only for receiver)
-- ============================================================================

-- Customer marks provider's messages as read.
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

-- Provider marks customer's messages as read.
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

ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
```

**Pentest-förankring**: `conversationId` ensamt ger INTE access. Policyer går alltid via `Conversation → Booking → (customerId OR providerId)`. Security-reviewern ombeds verifiera att ingen väg kringgår Booking-ownership.

## Domänplacering: egen kärndomän

**Val**: Egen kärndomän `conversation` (ny katalog `src/domain/conversation/`, repository obligatoriskt).

**Motivering**:
- Conversation har egen livscykel (oberoende av Booking-flödet).
- Slice 5 (förfrågningar FÖRE bokning) kräver att Conversation kan existera utan Booking. Enklare att lyfta bort `bookingId`-kravet om domänen redan är egen.
- Slice 2 (bilagor) adderar `MessageAttachment`-entitet -- hör hemma i conversation-domänen, inte booking-domänen.
- Följer samma mönster som `CustomerReview` (egen kärndomän, kopplad till Booking via FK).

## Notifier-integration

`MessageNotifier` i `src/domain/notification/MessageNotifier.ts`:
- Följer `RouteAnnouncementNotifier`-mönstret (DI med `NotificationService.createAsync`).
- Triggas i `ConversationService.sendMessage()` efter DB-commit.
- Fire-and-forget: `.catch(logger.error)`. Notifier-fel får ALDRIG bryta meddelande-leveransen.
- Push-payload:
  - `title`: "Nytt meddelande från {senderName}"
  - `body`: `truncate(content, 80)` (återanvänd `truncate` från `notification-helpers`)
  - `deepLink`: `/provider/bookings/{bookingId}/messages` eller `/customer/bookings/{bookingId}`
- Quiet hours + in-app-detection **skjuts** till Slice 3.

S35-3 implementerar, men mönstret beskrivs här så S35-1 inte bygger en parallell trigger-struktur.

## Risker och öppna frågor

1. **Conversation 1-1 med Booking vs 1-N**: Om vi i framtiden vill tillåta flera konversationer per bokning (t.ex. separat tråd för "eftervård") bryter `@unique`. **Beslut**: MVP är 1-1. Om behov dyker upp i Slice 2-5 droppas `@unique` då. Låst i arkitekturdokumentet med "Decision Record".

2. **Ägarskap av "initial" Conversation**: Lazy creation i `sendMessage()` betyder att FÖRSTA meddelande-INSERT måste gå i transaktion med Conversation-INSERT. Annars risk för race condition (två samtidiga skick skapar två Conversations → `@unique` kastar fel). **Plan**: `$transaction` med `upsert` på Conversation.

3. **Rate limit 30/min**: Bedömning utan data. **Risk**: för snäv → frustration; för generös → spam-yta. **Plan**: börja på 30/min, logga 429-hits, justera efter data från lansering.

4. **Content-sanitering**: Lagrar rå text. React eskaper vid rendering → ingen XSS. **Plan**: ingen sanitering på write-nivå. Justera om vi senare stödjer markdown/länkar.

5. **Quiet hours för push**: Skjutet till Slice 3. Förtydliga i arkitekturdokumentet så S35-3-implementation inte försöker bygga det.

6. **Status-gating för stängda bokningar**: Ska `CANCELLED`-bokningar tillåta efteråt-meddelanden? **Plan**: Nej initialt. Skriv-endpoint returnerar 409 för `CANCELLED` + `COMPLETED`. Läsning fortsätter fungera (för historik).

7. **iOS push-hantering**: APNs-payload och deep-link-parsing på iOS. **Plan**: S35-3 följer existerande APNs-payload-struktur från `RouteAnnouncementNotifier`. Ingen iOS-kodändring i S35-0.

## Reviews

- **tech-architect** (plan):
  - Arkitektur-placering (egen kärndomän vs Booking-underordnad)
  - Schema-val (1-1 vs 1-N, readAt-placering)
  - Integration med Booking (FK + Cascade, ownership-guards)
  - Query-patterns för inkorg (groupBy, select, undvika N+1)
  - Notifier-DI-mönster (fire-and-forget)
- **security-reviewer** (plan):
  - RLS-policies (sanerade? täcker alla CRUD? ingen väg via endast conversationId?)
  - Ownership guards i route-nivå (`findByIdForProvider`/`findByIdForCustomer`)
  - IDOR-risker (senderId från session, aldrig body)
  - Rate limit på meddelande-nivå
  - Zod .strict() + content length
  - Status-gating (förhindrar meddelanden till avslutade bokningar)
  - GDPR-aspekter (Cascade delete vid bokning-radering)

## Definition of Done

- [ ] `docs/architecture/messaging-domain.md` skriven med schema + API + RLS + notifier
- [ ] tech-architect har godkänt (inga blockers/majors)
- [ ] security-reviewer har godkänt (inga blockers/majors)
- [ ] Alla öppna frågor besvarade eller explicit dokumenterade som "löses i S35-1"
- [ ] `epic-messaging.md` uppdaterat med länk
- [ ] `docs/done/s35-0-done.md` skriven med review-resultat
- [ ] Feature branch mergad via PR
- [ ] `docs/sprints/status.md` uppdaterad
