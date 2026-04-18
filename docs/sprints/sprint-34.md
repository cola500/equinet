---
title: "Sprint 34: Messaging Slice 1 (MVP)"
description: "Per bokning: tvåvägs text-chat mellan kund och leverantör, polling, push"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, messaging, conversation, mvp, post-launch]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
  - Risker och oklarheter
---

# Sprint 34: Messaging Slice 1 (MVP)

## Sprint Overview

**Mål:** Leverera Slice 1 av messaging-epic -- tvåvägs text-kommunikation mellan kund och leverantör, kopplad till specifik bokning. Polling, push, ingen realtid, inga bilagor.

**Bakgrund:** Epic formulerad och slicad 2026-04-18 enligt Seven Dimensions (se [epic-messaging.md](../ideas/epic-messaging.md)). Slice 1 bedömd till 4-5 dagar och bryts här ner i 4 värde-drivna user stories enligt rekursiv tillämpning av processen.

**Primär persona:** Leverantör (hög smärta av context-switching mellan SMS/samtal/Messenger).

**Success-mått:** Upplevd professionalism, ekosystem-retention, minskad kognitiv belastning.

**Avgränsning (ej i scope):**
- Realtid (Supabase Realtime) -- Slice 3
- Bilagor (bilder) -- Slice 2
- Röstmeddelanden -- Slice 4
- Förfrågningar FÖRE bokning -- Slice 5
- Leverantör ↔ leverantör -- separat epic
- Native iOS-vy -- WebView räcker initialt, native i senare sprint

---

## Sessionstilldelning

Stories är sekventiella pga beroende: S34-0 (schema) → S34-1 (kund-flöde) → S34-2 (leverantör-flöde) → S34-3 (push).

En session räcker. Om parallellt önskas: S34-3 (push) kan köras av iOS-session efter S34-2 är mergad.

---

## Stories

### S34-0: Plan-review av Conversation-domän

**Prioritet:** 0 (förarbete, kör först)
**Effort:** 2-3h (plan + review, ingen kod)
**Domän:** docs (`docs/architecture/` + schema-skiss)

Innan någon kod skrivs: tech-architect + security-reviewer granskar hela designen för Conversation-domänen. Detta är en NY kärndomän -- repository obligatoriskt, RLS-policies, ownership guards.

**Implementation:**

**Steg 1: Skissa domänmodell**
- `Conversation` (per bokning, en per relation kund-leverantör-bokning)
- `Message` (innehåll, sender, createdAt, read-markör)
- Relation: `Booking` 1-1 `Conversation`, `Conversation` 1-N `Message`
- Sender: enum (`CUSTOMER` | `PROVIDER`) med `senderId` (User-ID)

**Steg 2: Skissa API**
- `GET /api/bookings/[id]/messages` (båda parter kan läsa)
- `POST /api/bookings/[id]/messages` (skicka meddelande)
- `GET /api/provider/conversations` (leverantörens inkorg, aggregerad)
- Rate limiting: vilken limiter? (message-specific, lägre än booking)
- Zod .strict(): `content` (max 2000 tecken), `type` ("text")

**Steg 3: Skissa RLS-policies**
- Kund kan läsa/skriva meddelanden där de är `customerId` på bokningen
- Leverantör kan läsa/skriva meddelanden där de är `providerId` på bokningen
- Ingen annan kan läsa
- Pentest-reminder: verifiera att `conversationId` ensamt inte ger access -- alltid gå via booking ownership

**Steg 4: Plan-review**
- **tech-architect:** arkitektur-bedömning (ny kärndomän, integration med Booking, query-patterns)
- **security-reviewer:** RLS-design, ownership guards, IDOR-risker

**Steg 5: Dokumentera i `docs/architecture/messaging-domain.md`**

**Acceptanskriterier:**
- [ ] `docs/architecture/messaging-domain.md` finns med schema + API + RLS-skiss
- [ ] tech-architect har godkänt (inga blockers)
- [ ] security-reviewer har godkänt (inga blockers)
- [ ] Prisma schema-utkast inkluderat (faktisk migration i S34-1)
- [ ] Epic-dokumentet uppdaterat med länk till arkitekturbeslut

---

### S34-1: Kund kan skicka meddelande till leverantör om bokning

**Prioritet:** 1
**Effort:** 1-1.5 dag
**Domän:** webb (nytt Prisma schema, ny domän, ny API, kund-UI)

Första halvan av MVP-värdet: kunden kan initiera och skicka text-meddelanden kopplade till en bokning. Meddelandet sparas och blir läsbart av leverantören (i S34-2).

**Aktualitet verifierad:**
- Backlog-story, inte tidigare implementerad. Grep-verifiera att inga `Conversation`/`Message`-modeller redan finns i `prisma/schema.prisma`.

**Implementation:**

**Steg 1: Prisma schema + migration**
- Lägg till `Conversation` + `Message`-modeller enligt S34-0 design
- Skapa migration, kör lokalt, verifiera

**Steg 2: Repository + Service (TDD)**
- `IConversationRepository`, `MockConversationRepository`, `PrismaConversationRepository`
- `ConversationService.sendMessage()`, `ConversationService.findOrCreateForBooking()`
- BDD dual-loop: yttre integrationstest → inre unit-tester

**Steg 3: API**
- `POST /api/bookings/[id]/messages` med auth (session), ownership-check, rate limit, Zod .strict()
- Svenska felmeddelanden
- Tester enligt api-routes.md checklista

**Steg 4: Kund-UI**
- På kundens bokningsdetaljsida: ny sektion "Meddelanden"
- Skriv-fält + skicka-knapp
- Lista: kundens egna skickade meddelanden (provider har inte svarat än i denna slice)
- Responsiv (mobile-first med ResponsiveDialog-pattern om modal)

**Steg 5: Tester**
- API-tester (integration + unit)
- E2E: kund skapar bokning → navigerar till detalj → skickar meddelande → bekräftelse visas
- Svenska strängar verifierade

**Acceptanskriterier:**
- [ ] Kund kan skicka text-meddelande från bokningsdetalj-vy
- [ ] Meddelandet sparas i DB med korrekt sender, createdAt, bookingId
- [ ] RLS förhindrar kund från att skicka till annan kunds bokning
- [ ] Rate limit på endpoint (max X meddelanden/minut)
- [ ] E2E grön, `check:all` grön

**Docs-matris:**
- `docs/architecture/messaging-domain.md` (uppdatera om schema-ändring)
- Hjälpartikel `src/lib/help/articles/customer/meddelanden.md` (ny, MVP-beskrivning)
- Testing-guide scenario

**Reviews:** tech-architect (plan om S34-0 ändrades), security-reviewer (kod), code-reviewer

---

### S34-2: Leverantör kan läsa och svara i inkorg

**Prioritet:** 2
**Effort:** 1.5-2 dagar
**Domän:** webb (leverantör-UI, inkorg-aggregering, svarsflöde)

Andra halvan av MVP-värdet: leverantören ser alla sina inkommande meddelanden samlat och kan svara.

**Aktualitet verifierad:** S34-1 levererar grunden. Denna story adderar leverantör-sidan.

**Implementation:**

**Steg 1: API för inkorg-aggregering**
- `GET /api/provider/conversations?unread=true|false` returnerar lista av bokningar med senaste meddelande, olästa-count, motpart
- `PATCH /api/bookings/[id]/messages/[messageId]/read` (markera läst)
- Select-block optimerat (inga include, bara fält UI:t visar)
- groupBy i DB, inte JS-loop

**Steg 2: Inkorg-vy (`/provider/messages`)**
- Lista aktiva bokningar som har meddelanden
- Sortering: olästa först, sedan senast aktivitet
- Tom-state: "Inga meddelanden just nu"
- SWR-polling var 30s

**Steg 3: Tråd-vy (`/provider/bookings/[id]/messages`)**
- Meddelande-historik (kund + leverantör)
- Skriv-fält + skicka-knapp (reuses API från S34-1, men tillåter sender=PROVIDER)
- Auto-markera olästa som lästa vid öppning
- Ankara nedåt (chat-look)

**Steg 4: Bottom-tab / navigation**
- Lägg till "Meddelanden"-ikon i provider-BottomTabBar med unread-badge
- Badge-count via SWR

**Steg 5: Tester**
- API-tester (inkorg, read-markering)
- E2E: leverantör loggar in → ser inkorg-badge → öppnar tråd → svarar → kund ser svaret (återanvänd S34-1 kund-flöde)

**Acceptanskriterier:**
- [ ] Leverantör ser inkorg med alla aktiva bokningar som har meddelanden
- [ ] Unread-badge visar korrekt antal
- [ ] Tråd-vy visar full historik, båda parters meddelanden
- [ ] Leverantör kan svara, meddelandet når kund
- [ ] Read-markering fungerar (badge minskar)
- [ ] E2E tvåvägs-flöde grön, `check:all` grön

**Docs-matris:**
- Hjälpartikel `src/lib/help/articles/provider/meddelanden.md` (ny)
- Admin testing-guide scenario
- README.md om ny feature

**Reviews:** cx-ux-reviewer (inkorg + tråd är nya UI-flöden), security-reviewer, code-reviewer

---

### S34-3: Push-notifiering vid nytt meddelande

**Prioritet:** 3
**Effort:** 0.5 dag
**Domän:** webb (notifier-integration, event-trigger)

När nytt meddelande skickas: notifier skickar push till mottagaren (leverantör eller kund, beroende på sender).

**Aktualitet verifierad:**
- Push-infra finns (APNs för iOS, Web Push). Grep för existerande `PushNotifier`/`NotificationService` för återanvändning.

**Implementation:**

**Steg 1: MessageNotifier**
- Följ fire-and-forget-mönstret från `RouteAnnouncementNotifier` (DI + `.catch(logger.error)`)
- Trigger i `ConversationService.sendMessage()` efter DB-commit
- Svensk text: "Nytt meddelande från {{namn}} om bokning {{datum}}"

**Steg 2: Push-payload**
- Deep-link till tråd (`/provider/bookings/[id]/messages` eller `/customer/bookings/[id]`)
- Quiet hours? Skip om mottagaren redan är aktiv i appen? (skjut -- senare slice)

**Steg 3: Tester**
- Unit: MessageNotifier skickas vid send
- Integration: mock push-gateway, verifiera payload

**Acceptanskriterier:**
- [ ] Push skickas till mottagare vid nytt meddelande
- [ ] Push-payload har deep-link till tråd
- [ ] Fire-and-forget: notifier-fel stör inte meddelande-leverans
- [ ] `check:all` grön

**Docs-matris:**
- `docs/architecture/messaging-domain.md` (uppdatera med notifier-flöde)

**Reviews:** code-reviewer (trivial om S34-1/2 etablerat mönstret)

---

## Exekveringsplan

```
S34-0 (2-3h, plan-review) -> S34-1 (1-1.5 dag, kund) -> S34-2 (1.5-2 dag, leverantör) -> S34-3 (0.5 dag, push)
```

**Total effort:** ~4-5 dagar (matchar epic-skattningen).

**Parallelliseringsmöjlighet:** S34-3 kan köras parallellt av iOS-session EFTER S34-2 är mergad.

## Risker och oklarheter

1. **Domän-scope:** Hör `Conversation` till Booking-domänen eller är det egen kärndomän? S34-0:s tech-architect-review avgör. Om underordnad Booking: enklare, men kopplad för nära. Om egen: mer kod, men följer Slice 5-förändringar bättre.

2. **Rate limit-nivå:** Vi har inte tidigare rate-limitat på meddelande-nivå. Välja konservativt (t.ex. 10/min) och justera efter verklig användning.

3. **Moderation:** Ingen i MVP. Om spam/missbruk upptäcks: reaktiv flagga-knapp i senare slice.

4. **iOS-konvertering:** WebView räcker för MVP. Om native önskas som del av S34: +1-2 dagar per sida (följer Native Screen Pattern + Feature Inventory).

## Definition of Done (sprintnivå)

- [ ] S34-0: domänarkitektur godkänd av tech-architect + security-reviewer
- [ ] S34-1: kund kan skicka meddelande, E2E grön
- [ ] S34-2: leverantör kan läsa + svara, inkorg fungerar, E2E grön
- [ ] S34-3: push skickas vid nytt meddelande
- [ ] `npm run check:all` grön, `npm run test:e2e:smoke` grön
- [ ] Hjälpartiklar + admin testing-guide uppdaterade (per docs-matris)
- [ ] `docs/architecture/messaging-domain.md` reflekterar slutlig implementation
- [ ] Metrics-rapport genererad vid sprint-avslut
