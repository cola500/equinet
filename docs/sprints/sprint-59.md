---
title: "Sprint 59: Gruppbokningar release-klar"
description: "Täpper de sex UX- och integritetsluckor som teateranalysen hittade. DoD: ta bort group_bookings feature flag."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, group-bookings, ux, security]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 59: Gruppbokningar release-klar

## Sprint Overview

**Mål:** Täppa de sex luckor teateranalysen identifierade och släpp `group_bookings` utan feature flag.

**Källa:** Teateranalys 2026-04-24 — leverantör + kund i samspel med koden.

**Nuläge:** Grundflödet är solitt (skapa request → dela kod → gå med → leverantör matchar → N bokningar skapas). Tre UX-brister gör demot opresentabelt: döda requests i leverantörslistan, ingen delnings-UX för koden, och kunden ser ingenting efter match. Därtill en atomicitetsbugg vid concurrent join och saknad rate limiting på öppen endpoint.

**DoD:** `group_bookings` feature flag borttagen. Funktionen alltid aktiv.

| Story | Gap | Effort |
|-------|-----|--------|
| S59-1 | GAP 4 — Döda requests filtreras aldrig bort från leverantörslistan | 30 min |
| S59-2 | GAP 1 — Ingen delnings-UX för inbjudningskoden | 45 min |
| S59-3 | GAP 6 — Kunden ser ingenting efter match (tid, leverantör saknas) | 45 min |
| S59-4 | GAP 2+3 — Rate limiting på preview-endpoint + atomisk join-validering | 45 min |
| S59-5 | DoD — Ta bort group_bookings feature flag | 15 min |

**Inte i sprint:** GAP 5 (redigerings-UI för skapare) — route finns, värdet för demo är lågt. Kan komma i nästa sprint.

---

## Stories

### S59-1: Filtrera bort döda requests från leverantörslistan (GAP 4)

**Prioritet:** 1
**Effort:** 30 min
**Domän:** webb

**Problem:** `GET /api/group-bookings/available` returnerar alla requests med status `open` oavsett om datumet passerat. Leverantören ser requests från förra veckan utan att förstå att de är inaktuella.

**Fix:** Lägg till filter i frågan: `dateFrom >= today OR dateTo >= today`. Om `joinDeadline` finns och har passerat: filtrera även bort den. Serverside i route, ingen UI-ändring.

**Filer:**
- `src/app/api/group-bookings/available/route.ts` — lägg till date-filter i query

**Acceptanskriterier:**
- [ ] Requests där `dateTo` (eller `dateFrom` om `dateTo` saknas) är äldre än idag visas inte
- [ ] Requests där `joinDeadline` passerat visas inte
- [ ] Aktiva requests visas fortfarande korrekt
- [ ] Test: `GET /available` med passerat datum returnerar tom lista

---

### S59-2: Delnings-UX för inbjudningskoden (GAP 1)

**Prioritet:** 2
**Effort:** 45 min
**Domän:** webb

**Problem:** Kunden skapar en grupprequest och ser inbjudningskoden som råtext. Ingen knapp för att kopiera, ingen delningsfunktion. Hög friktionspunkt — målet med funktionen är att dela med grannar.

**Fix:** På `/customer/group-bookings/[id]` (och i bekräftelsen direkt efter skapande):
- Knapp "Kopiera kod" med clipboard-feedback ("Kopierad!")
- På mobil: `navigator.share()` om tillgänglig (Web Share API), fallback till copy
- Koden visas tydligt i ett avgränsat fält (inte bara inline i text)

**Filer:**
- `src/app/customer/group-bookings/[id]/page.tsx` — lägg till copy/share-UI
- `src/app/customer/group-bookings/new/page.tsx` — visa koden med copy-knapp i bekräftelsesteg

**Acceptanskriterier:**
- [ ] "Kopiera kod"-knapp finns och fungerar (visar bekräftelse i 2s)
- [ ] På mobil: Web Share API används om `navigator.share` finns
- [ ] Inbjudningskoden visas synligt avgränsad (inte gömd i text)
- [ ] Fungerar utan JavaScript-fel i console

---

### S59-3: Visa bokningsdetaljer efter match (GAP 6)

**Prioritet:** 3
**Effort:** 45 min
**Domän:** webb

**Problem:** När leverantören matchar en request (status → `matched`) ser kunden bara att "leverantör matchat" och en länk till `/customer/bookings`. Varken tid, tjänst eller leverantörens namn visas direkt på sidan. Kunden måste navigera bort för att få svar på grundfrågan "när är min bokning?".

**Fix:** På `/customer/group-bookings/[id]` vid status `matched`: hämta `bookingId` från sin participant-rad och visa bokningsinformation inline — datum, tid, tjänst, leverantörens namn. Länken till `/customer/bookings` finns kvar men är sekundär.

**Filer:**
- `src/app/customer/group-bookings/[id]/page.tsx` — matched-state visar bokningsdetaljer
- `src/app/api/group-bookings/[id]/route.ts` — kontrollera att participant.bookingId + booking-data returneras

**Acceptanskriterier:**
- [ ] Vid status `matched`: datum, tid, tjänst och leverantörsnamn visas direkt på sidan
- [ ] Data hämtas från befintliga fält (participant.bookingId → booking)
- [ ] Länk till `/customer/bookings` finns kvar
- [ ] Vid status `open` eller `cancelled`: befintligt UI oförändrat

---

### S59-4: Rate limiting på preview + atomisk join (GAP 2+3)

**Prioritet:** 4
**Effort:** 45 min
**Domän:** webb

**Problem A (GAP 2):** `GET /api/group-bookings/preview?code=` är öppen utan auth och utan rate limiting. Svag kodestruktur + ingen begränsning = möjlig enumeration.

**Problem B (GAP 3):** Join-validering är inte atomisk. `isUserParticipant`-check och `participantCount`-check är separata queries — två simultana joins kan båda gå igenom och bryta `maxParticipants`.

**Fix A:** Lägg till rate limiting på preview-endpointen (t.ex. 10 requests/minut per IP). Använd befintligt `rateLimit`-mönster.

**Fix B:** Wrap join-logiken i en Prisma-transaktion med en atomisk count-check innan INSERT.

**Filer:**
- `src/app/api/group-bookings/preview/route.ts` — lägg till rate limiting
- `src/app/api/group-bookings/join/route.ts` — wrap i transaktion
- `src/domain/group-booking/GroupBookingService.ts` — atomisk count i joinRequest()

**Acceptanskriterier:**
- [ ] Preview-endpoint returnerar 429 vid >10 requests/minut från samma IP
- [ ] Join med maxParticipants nådd returnerar 409 även vid concurrent requests
- [ ] Befintliga join-tester passerar
- [ ] Test: concurrent join simuleras (two simultaneous calls, only one succeeds)

---

### S59-5: Ta bort group_bookings feature flag (DoD)

**Prioritet:** 5
**Effort:** 15 min
**Domän:** webb

**Problem:** Funktionen är feature-flaggad. Mål med sprint 59 är att göra den alltid aktiv.

**Fix:** Ta bort `group_bookings`-flaggan från alla platser:
- Feature flag-definition
- Alla `isFeatureEnabled("group_bookings")`-anrop i API-routes
- Alla `useFeatureFlag("group_bookings")`-anrop i UI
- Nav-komponenter (ProviderNav, CustomerNav)
- `feature-flag-definitions.ts`

**Filer:**
- `src/lib/feature-flag-definitions.ts`
- `src/components/layout/ProviderNav.tsx`
- `src/components/layout/CustomerNav.tsx`
- Alla routes i `src/app/api/group-bookings/**` och `src/app/api/native/group-bookings/**`

**Acceptanskriterier:**
- [ ] Sökning på `group_bookings` ger noll träffar i `src/`
- [ ] Grupp-bokningar syns i nav utan feature flag-toggle
- [ ] `npm run check:all` grön
- [ ] Inga console-errors relaterade till saknad flagga

---

## Förväntat resultat

| Vad | Före | Efter |
|-----|------|-------|
| Leverantörslistan | Visar döda requests | Visar bara aktuella |
| Dela inbjudningskod | Råtext, ingen knapp | Copy + Web Share |
| Post-match info | "Leverantör matchat" + länk | Datum, tid, tjänst, leverantör direkt |
| Preview-endpoint | Öppen, obegränsad | Rate-limitad |
| Concurrent join | Race condition möjlig | Atomisk transaktion |
| Feature flag | På | Borttagen |
