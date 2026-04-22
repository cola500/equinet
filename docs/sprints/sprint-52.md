---
title: "Sprint 52: Upptäckt och transparens"
description: "Stänger de största friktionspunkterna från teatern 2026-04-22: pre-booking messaging, pending-transparens, review-uppmaning. Körs före lansering."
category: sprint
status: planned
last_updated: 2026-04-22
tags: [sprint, discovery, messaging, transparency, pre-launch]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 52: Upptäckt och transparens

## Sprint Overview

**Mål:** Stäng de tre största friktionspunkterna som teaterövningen 2026-04-22 upptäckte. Gör appen bredare än "logistiksystem för redan etablerade relationer" — ta också första-kontakten och efterspelet.

**Teater-kontext:** Johan spelade igenom "boka hovslagare" i fem akter och hittade 9 gap. De tre största:

- **Gap 4 (Akt 2):** Ingen pre-booking messaging — kund kan inte fråga "kommer du hit?" innan bokning
- **Gap 6 (Akt 4):** Pending-tillstånd är ogenomskinligt — kund vet inte om leverantören har sett bokningen
- **Gap 8 (Akt 5):** Ingen pro-aktiv review-uppmaning — kunder glömmer att recensera

Dokumentation: `docs/retrospectives/2026-04-22-theater-booking-flow.md` (skapas av tech lead efter sprinten).

**Timing-beslut (Johan, 2026-04-22):** Körs **före lansering**. Argumentet: lansera med bredare produkt ("hitta, fråga, boka") istället för smalare ("boka"). Extra vecka värt det för förstagångskunders upplevelse.

**Scope-princip:** Pre-booking messaging är stort. Design-spike först (S52-0, 1h) för att undvika att implementationen blir fel från dag 1.

**Procedurbrott-mål:** ≤ 2 (fortsätt S48/S49/S51-trenden).

---

## Stories

### S52-0: Design-spike — pre-booking messaging

**Prioritet:** 0
**Effort:** 1-1.5h
**Domän:** `docs/architecture/pre-booking-messaging.md` (nytt designdokument)

**Bakgrund:** Pre-booking messaging kräver arkitekturbeslut som påverkar hela S52-1-implementationen. `docs/ideas/epic-messaging.md` Slice 5 har en skiss men inga tekniska beslut. Tidigare messaging (S35-S46) är kopplad till `bookingId` — vi måste välja hur förfrågningar utan bokning passar in.

**Aktualitet verifierad:**
- Läs `docs/ideas/epic-messaging.md` Slice 5
- Läs `prisma/schema.prisma` — nuvarande `Conversation` + `Message`-modeller
- Läs `src/app/api/bookings/[id]/messages/route.ts` — nuvarande auth-pattern

**Designbeslut att fatta (D1-D5):**

**D1. Datamodell för pre-booking-förfrågningar:**
- Alternativ A: Ny `Inquiry`-modell med egen livscykel (draft → sent → converted_to_booking | rejected | expired)
- Alternativ B: `Conversation` får nullable `bookingId` + ny `inquiryId` FK
- Alternativ C: "Förfrågningsbokning" — `Booking` med ny status `inquiry`, konverteras till `pending` vid acceptans

**Trade-offs:**
- A är renast men kräver ny domän + repository
- B återanvänder messaging-infra men röriga nullable FK:er
- C är minsta ändring men blandar semantiskt olika tillstånd

**Förväntad rekommendation:** A. Egen livscykel, tydlig semantik, konvertering till `Booking` via explicit service-metod.

**D2. RLS-policies för Inquiry:**
- Kund ser bara sina egna inquiries
- Leverantör ser bara inquiries riktade till sig
- Custom Access Token Hook-claims (`providerId`, `userType`) används som idag
- Följer mönstret från `Conversation` RLS (dokumenterat i S14)

**D3. Leverantörs-UX:**
- Ny flik i leverantörsdashboard: "Förfrågningar" (badge med antal nya)
- Alternativt: inkluderas i befintlig Meddelanden-flik med filter "Bokning" / "Förfrågan"
- Beslut: separat flik — leverantör ska kunna prioritera bekräftade bokningar vs obesvarade förfrågningar

**D4. Kundens vy:**
- `/customer/inquiries` — lista över alla egna förfrågningar
- Status-badges: "Skickad" (grå), "Läst" (blå), "Besvarad" (gul), "Blev bokning" (grön), "Avvisad" (röd)
- Utgång: länka till MessagingDialog-variant som fungerar utan `bookingId`

**D5. Konvertering till bokning:**
- När leverantör säger "OK, vi bokar X-datum" → knapp "Skapa bokning från den här förfrågan" i tråden
- Förifyller BookingDialog med data från förfrågan (tjänst, häst, datum, anteckningar)
- Inquiry markeras `converted_to_booking` + `Booking.inquiryId` referens
- Chat-historik flyttar med (samma `Conversation` får `bookingId` tilldelad)

**Spam-/missbruk-skydd:**
- Rate limit: max 5 nya inquiries per kund per 24h (samma som andra POST-endpoints)
- Auto-expire: inquiries utan svar efter 14 dagar → status `expired`
- Block/mute-funktion på backlog (post-S52)

**Acceptanskriterier:**
- [ ] Designdokument `docs/architecture/pre-booking-messaging.md` committat på main
- [ ] D1-D5 har explicit beslut + kort motivering
- [ ] Schema-skiss (Prisma-syntax) för `Inquiry`-modellen
- [ ] API-endpoint-skiss (`POST /api/inquiries`, `GET /api/inquiries`, `POST /api/inquiries/[id]/convert-to-booking`)
- [ ] UI-skisser (eller text-beskrivning) för kund + leverantör
- [ ] Öppna frågor listade i slutet

**Reviews:**
- `tech-architect` (obligatorisk, designdokument)
- `security-reviewer` (obligatorisk, ny auth-yta)

**Arkitekturcoverage:** Skapar designdokument. S52-1 verifierar coverage av D1-D5.

---

### S52-1: Pre-booking messaging — MVP

**Prioritet:** 1
**Effort:** 1.5-2 dagar
**Domän:** `prisma/schema.prisma`, `src/domain/inquiry/*`, `src/app/api/inquiries/*`, `src/components/customer/*`, `src/app/provider/inquiries/*`, `src/components/provider/*`

**Bakgrund:** Implementation av design från S52-0. Stänger Gap 4 (teatern 2026-04-22).

**Aktualitet verifierad:**
- S52-0 designdokument mergat
- Följ `docs/architecture/pre-booking-messaging.md` D1-D5

**Implementation (följer design):**

**Del 1 — Datamodell + migrering:**
- Ny Prisma-modell (`Inquiry` per D1)
- Migration med RLS-policies (per D2)
- `InquiryRepository` (kärndomän → repository obligatoriskt)

**Del 2 — Domain service + API:**
- `InquiryService.createInquiry(customerId, providerId, message, serviceId?)`
- `InquiryService.markAsRead(inquiryId, providerId)` (auth-check)
- `InquiryService.convertToBooking(inquiryId, bookingData)`
- `InquiryService.expireOldInquiries()` (cron-kandidat, eller enkel lazy check)
- Routes: `POST /api/inquiries`, `GET /api/inquiries`, `POST /api/inquiries/[id]/convert-to-booking`
- Återanvänd `MessageService` för trådar men med `inquiryId` istället för `bookingId`

**Del 3 — Kundens UX:**
- "Kontakta leverantör"-knapp på `/providers/[id]` (bredvid "Boka tid")
- Ny dialog: `InquiryDialog` — förval av tjänst (från leverantörens tjänstelista), fritext, "Skicka förfrågan"
- `/customer/inquiries` — lista med status-badges (D4)
- `/customer/inquiries/[id]` — tråd-vy (återanvänder `MessagingDialog`-komponent med `inquiryId`-prop)

**Del 4 — Leverantörens UX:**
- Ny flik i providernav: "Förfrågningar" med badge (antal olästa)
- `/provider/inquiries` — lista sorterad på "oläst först, äldst sist"
- `/provider/inquiries/[id]` — tråd-vy + "Skapa bokning från förfrågan"-knapp (D5)
- Push-notis till leverantör vid ny förfrågan (återanvänd `PushManager`)

**Del 5 — Konvertering:**
- "Skapa bokning"-knappen öppnar BookingDialog med `inquiryId`-prop
- BookingDialog förifyller tjänst + kund + anteckningar från förfrågan
- Vid submit: `POST /api/bookings` inkluderar `inquiryId` → service markerar inquiry `converted_to_booking`
- `Conversation` får tilldelat `bookingId` så chat-historik fortsätter i bokningstråden

**Del 6 — Tester (TDD):**
- BDD dual-loop för `InquiryService` + routes
- E2E-spec: "kund skickar förfrågan → leverantör svarar → konvertera till bokning"
- Component-tester för `InquiryDialog` + `/customer/inquiries/[id]`

**Acceptanskriterier:**
- [ ] Kund kan skicka förfrågan utan existerande bokning
- [ ] Leverantör får push + ser i "Förfrågningar"-flik
- [ ] Båda kan skriva meddelanden i tråden
- [ ] Konvertering till bokning bevarar tråd-historik
- [ ] Status-badges (D4) fungerar korrekt
- [ ] Rate limit 5/24h aktiv
- [ ] Auto-expire efter 14 dagar (via lazy check vid list-query)
- [ ] `npm run check:all` 4/4 grön
- [ ] E2E-spec grön
- [ ] Feature flag `pre_booking_messaging` (default: false) för att kunna rulla ut gradvis

**Reviews:**
- `code-reviewer` (obligatorisk)
- `security-reviewer` (obligatorisk — ny auth-yta, ny kund-leverantör-interaktion)
- `cx-ux-reviewer` (obligatorisk — nya UI-flöden)
- `tech-architect` (obligatorisk — verifiera arkitekturcoverage D1-D5)

**Arkitekturcoverage:** `docs/architecture/pre-booking-messaging.md` D1-D5

---

### S52-2: Pending-transparens för kund

**Prioritet:** 2
**Effort:** 3-4h
**Domän:** `src/components/customer/BookingCard.tsx`, `src/app/api/bookings/[id]/route.ts`, `src/domain/booking/BookingService.ts`

**Bakgrund:** Stänger Gap 6 (teatern 2026-04-22). Kund med pending-bokning sitter i limbo utan att veta om leverantören har sett den.

**Aktualitet verifierad:**
- Grep efter "pending" i `src/components/customer/` — vilka statusbadges finns idag?
- Kolla `Booking`-modellen — finns `seenAt` eller liknande fält?
- Verifiera att `lastSeenAt` finns på `Provider`-modellen (session tracking)

**Implementation:**

**Del 1 — Datamodell:**
- Nytt fält `Booking.seenByProviderAt DateTime?`
- Uppdateras när leverantör öppnar `/provider/bookings/[id]` första gången
- Migration + repo-uppdatering

**Del 2 — Synlighet i BookingCard (kundvy):**
- Ny indikator under status-badge: "Leverantör har sett den" (med tidsstämpel) eller "Väntar på att leverantör ser den"
- Om `seenByProviderAt > 24h sedan + status = pending` → varning: "Ingen reaktion på 24h. Kontakta leverantören direkt."
- "Senast aktiv"-tid för leverantör (hämtas från `Provider.lastSeenAt` om publik, annars "aktiv nyligen" / "aktiv för några dagar sedan")

**Del 3 — API-uppdatering:**
- `GET /api/bookings/[id]` returnerar `seenByProviderAt` + (härledd) `providerLastActiveLabel`
- `withApiHandler` vid GET i leverantörskontext uppdaterar `seenByProviderAt` om null

**Del 4 — Tester:**
- Unit-test: `BookingService.markAsSeen(bookingId, providerId)` idempotent
- Component-test: `BookingCard` med olika pending-tillstånd
- E2E: valfritt (tidigt skede kan vara manuellt)

**Acceptanskriterier:**
- [ ] `Booking.seenByProviderAt` fylls i när leverantör öppnar bokningen
- [ ] Kundens `BookingCard` visar "Leverantör har sett den (för 2 timmar sedan)" eller motsvarande
- [ ] Efter 24h pending utan respons: varning med CTA
- [ ] Tester gröna
- [ ] `npm run check:all` 4/4 grön

**Reviews:**
- `code-reviewer` (obligatorisk)
- `cx-ux-reviewer` (obligatorisk — UI-komponent)

**Arkitekturcoverage:** N/A (liten förändring)

---

### S52-3: Pro-aktiv review-uppmaning

**Prioritet:** 3
**Effort:** 4-6h
**Domän:** `src/domain/booking/BookingService.ts`, `src/lib/notifications/ReviewReminderNotifier.ts`, `src/components/customer/BookingCard.tsx`, `src/app/api/cron/review-reminders/route.ts`

**Bakgrund:** Stänger Gap 8 (teatern 2026-04-22). Kunder glömmer recensera → leverantörers rating växer långsammare än möjligt.

**Aktualitet verifierad:**
- Läs `src/domain/review/ReviewService.ts` — hur avgörs om bokning är oreviewad?
- Grep efter cron-jobb i `src/app/api/cron/` — finns befintlig mall?
- Verifiera att `Booking.status = 'completed'` sätts konsekvent (manuell vs auto)

**Implementation:**

**Del 1 — Push + in-app banner vid completed-booking:**
- När `Booking.status` ändras till `completed`: fire-and-forget push "Hur var Erik Järnfot? Lämna en recension"
- Banner i `/customer/bookings` ovanför listan om det finns oreviewade completed-bookings senaste 30 dagarna
- Klick → öppnar `ReviewDialog` direkt

**Del 2 — Email-påminnelse via cron (3 dagar senare):**
- Ny cron-route `/api/cron/review-reminders` (körs dagligen via Vercel Cron)
- Scan: `Booking` där `status = completed` + `completedAt > 7 dagar sedan` + `completedAt < 3 dagar sedan` + `review IS NULL` + `reviewReminderSentAt IS NULL`
- Email via Resend: "Det har gått några dagar sedan ditt besök — recensera gärna"
- Fält `Booking.reviewReminderSentAt` så vi bara skickar en gång
- Unsubscribe-länk (användarnivå: `User.emailReviewReminders`)

**Del 3 — Opt-out:**
- Kundinställning: "Skicka mig review-påminnelser" (default: true)
- I profil/inställningar-sida

**Del 4 — Tester:**
- Unit-test för cron-logiken (dates, filter, idempotency)
- Integration-test för push-triggering
- Component-test för banner

**Acceptanskriterier:**
- [ ] Push skickas när bokning markeras completed
- [ ] Banner visas på `/customer/bookings` för oreviewade completed senaste 30d
- [ ] Email skickas 3 dagar efter completed om ej reviewad och ej unsubscribed
- [ ] `reviewReminderSentAt` förhindrar dubbelskick
- [ ] Opt-out i profil fungerar
- [ ] Cron-jobb dokumenterat i `docs/operations/cron-jobs.md`
- [ ] `npm run check:all` 4/4 grön

**Reviews:**
- `code-reviewer` (obligatorisk)
- `security-reviewer` (obligatorisk — email-utskick, unsubscribe)
- `cx-ux-reviewer` (obligatorisk — banner + opt-out UI)

**Arkitekturcoverage:** N/A (feature-add, inget designdokument)

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| S52-0 design tar mer än 1h (svåra trade-offs) | Medel | Timebox: 1.5h max. Om inte klart → fortsätt som S52-spike utan egen story. |
| S52-1 scope skenar (pre-booking messaging är stort) | Hög | Feature flag `pre_booking_messaging` default-off → kan avvakta publicering om incomplete. Defer non-MVP: block-/mute-funktion, rapportering, attachments i inquiries. |
| Design vs implementation-gap upptäcks under S52-1 | Medel | Tech-architect obligatorisk review på S52-1 verifierar arkitekturcoverage. Om D1-D5 inte täcks: tillbaka till S52-0 + uppdatera. |
| Email-review-reminders upplevs som spam | Låg | Opt-out från dag 1 + "en gång per bokning"-regel + text "Du får detta en gång" |
| Teatern missade något avgörande gap | Medel | Spela teater igen efter S52 (t.ex. "leverantörens dag") för att hitta nästa lager av friktion |

---

## Definition of Done (sprintnivå)

- [ ] S52-0 done: designdokument mergat + tech-architect-approved
- [ ] S52-1 done: pre-booking messaging fungerar end-to-end (kund → leverantör → konvertering)
- [ ] S52-2 done: pending-transparens synlig i kundens BookingCard
- [ ] S52-3 done: review-uppmaning (push + banner + email + opt-out) fungerar
- [ ] `npm run check:all` 4/4 grön
- [ ] E2E-spec för pre-booking-flödet grön
- [ ] Feature flag `pre_booking_messaging` testat både on/off
- [ ] Procedurbrott ≤ 2 (fortsätt trend)
- [ ] Sprint-avslut via feature branch + PR (S47-5-regel)

**Inte i scope:**
- Specialitet-filter på `/providers` (Gap 2 — backlog, kan bli S53)
- Klickbara kategori-ikoner på landningssidan (Gap 1 — backlog)
- Geografiskt kontrollerat besöksområde (Gap 3 — backlog, större UX-fråga)
- Ruttplanering synlig för kund (Gap 5 — backlog, kräver produktbeslut)
- Läskvitton i messaging (Gap 7 — redan på backlog som SUGGESTION-2)
- Leverantörs-notis vid inkommande recension (Gap 9 — backlog, liten fix)
- Block/mute i inquiries
- Bilagor i inquiries (återanvänd `message-attachments` vid konvertering till bokning)

**Post-S52-kandidater:**
- Teaterövning 2: "Erik Järnfots dag" (leverantörsperspektiv) — hitta nästa lager av friktion
- Specialitet-filter (Gap 2 — 2-4h, lätt vinst)
- Pre-launch-go-beslut (är vi klara?)
