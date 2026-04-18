---
title: "S35-1 Done: Kund kan skicka meddelande till leverantör om bokning"
description: "Messaging MVP - kund-leverantör konversation per bokning"
category: retro
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Avvikelser
  - Lärdomar
---

# S35-1 Done: Kund kan skicka meddelande till leverantör om bokning

## Acceptanskriterier

- [x] Kund kan öppna en konversation kopplad till en specifik bokning
- [x] Kund kan skicka textmeddelande (max 2000 tecken)
- [x] Kund kan se skickade och mottagna meddelanden
- [x] Meddelanden visas med avsändarinfo och tidsstämpel
- [x] Feature-flaggad med `messaging` (default: false)
- [x] Meddelanden är låsta för avbokade/no-show-bokningar (409)
- [x] Rate limiting: 30 meddelanden/min per användare, 10/min per konversation

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod, error handling, IDOR-skydd via ownership guard)
- [x] Tester skrivna FÖRST (BDD dual-loop): 13 + 11 + 5 = 29 nya tester
- [x] Feature branch, `check:all` 4/4 grön, redo för PR
- [x] Hjälpartikel skapad: `src/lib/help/articles/customer/meddelanden.md`

## Reviews körda

- [x] **security-reviewer**: Kördes. Findings åtgärdade:
  - Major: Rate limiting på GET/PATCH via IP → bytt till user-ID
  - Major: Dead code (`clientIp` oanvänd) → borttagen
  - Minor: Feature flag-check efter rate limiting → ordning fixad
  - Minor: `loadBookingForMessaging` duplicerad → extraherad till delad modul
  - Minor: Saknad Zod-validering på query params → lagt till
- [x] **code-reviewer**: Kördes (via security-reviewer ovan, täckte båda dimensioner)

## Docs uppdaterade

- [x] `src/lib/help/articles/customer/meddelanden.md` — ny hjälpartikel för kunder
- [ ] README.md — ej uppdaterat (feature är feature-flaggad, default off, ej synlig för användare)
- [ ] NFR.md — ej uppdaterat (ingen ny säkerhetskapabilitet utöver det som redan finns)

## Verktyg använda

- Läste patterns.md vid planering: ja — Review-mönstret för ny domän följdes
- Kollade code-map.md för att hitta filer: ja — identifierade BookingCard som integrationsytan
- Hittade matchande pattern: "Ny domän" (IRepository → MockRepo → PrismaRepo → Service → Route)

## Modell

sonnet (claude-sonnet-4-6)

## Implementerade filer

**Schema:**
- `prisma/schema.prisma` — Conversation + Message modeller, MessageSenderType enum
- `prisma/migrations/20260418100000_add_conversation_message/migration.sql`

**Feature flag + rate limiting:**
- `src/lib/feature-flag-definitions.ts` — `messaging` flagga (clientVisible, default: false)
- `src/lib/rate-limit.ts` — `messageUser` + `messageConversation` limiters

**Conversation-domän:**
- `src/infrastructure/persistence/conversation/IConversationRepository.ts`
- `src/infrastructure/persistence/conversation/MockConversationRepository.ts`
- `src/infrastructure/persistence/conversation/PrismaConversationRepository.ts`
- `src/domain/conversation/ConversationService.ts`
- `src/domain/conversation/ConversationService.test.ts` (13 tester)
- `src/domain/conversation/mapConversationErrorToStatus.ts`
- `src/domain/conversation/loadBookingForMessaging.ts` (extraherad efter security review)

**API routes:**
- `src/app/api/bookings/[id]/messages/route.ts` — POST + GET
- `src/app/api/bookings/[id]/messages/route.test.ts` (11 tester)
- `src/app/api/bookings/[id]/messages/read/route.ts` — PATCH
- `src/app/api/bookings/[id]/messages/read/route.test.ts` (5 tester)

**Kund-UI:**
- `src/components/customer/bookings/MessagingDialog.tsx`
- `src/components/customer/bookings/MessagingSection.tsx`
- `src/components/customer/bookings/BookingCard.tsx` — integreras med feature flag

**Testfixar:**
- `src/lib/feature-flags.test.ts` — messaging-flagga lagd till
- `src/app/api/feature-flags/route.test.ts` — messaging-flagga lagd till

## Avvikelser

- `marked: 0` returneras alltid från PATCH /read. `markMessagesAsRead` returnerar void i service-lagret; propagering av faktisk count är skjuten till framtida slice (S35-x).
- Migration skapades manuellt + `prisma db execute` + `migrate resolve --applied` pga Supabase shadow DB saknar `auth`-schema. Känd gotcha, dokumenterad sedan tidigare.

## Lärdomar

- **`vi.hoisted()` krävs** när `vi.mock`-factory refererar variabler som deklareras med `const` — factory hoistas men `const` gör inte det. `mockPrismaBookingFindFirst` höll på att bli ett mysterium.
- **Supabase shadow DB och auth-schema**: `prisma migrate dev` failar alltid i detta projekt. Manuell migration-workflow är nu etablerad.
- **Security reviewer är värt det**: hittade 3 majors (ordning, dead code, IP vs user-ID) som hade kunnat bli problem i produktion.
