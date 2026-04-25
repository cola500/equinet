---
title: "Sprint 60: Förfallen service release-klar"
description: "Täpper de sex UX-, test- och notifikationsluckor teateranalysen hittade. DoD: ta bort due_for_service feature flag."
category: sprint
status: planned
last_updated: 2026-04-25
tags: [sprint, due-for-service, tdd, ux, notifications]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 60: Förfallen service release-klar

## Sprint Overview

**Mål:** Täppa de sex luckor teateranalysen identifierade och släpp `due_for_service` utan feature flag.

**Källa:** Teateranalys 2026-04-25 — leverantör + kund + iOS i samspel med koden.

**Nuläge:** Domänlogiken (3-nivå intervallprioritering, `calculateDueStatus`) är väldesignad men otestad. Demo-värdet begränsas av att leverantören inte kan redigera intervall direkt i listan — den primära åtgärden på sidan kräver navigation bort. Notifikationer saknas trots att beräkningsinfrastrukturen redan finns (`DueForServiceLookup`).

**DoD:** `due_for_service` feature flag borttagen. Funktionen alltid aktiv.

| Story | Gap | Effort |
|-------|-----|--------|
| S60-1 | GAP 5 — DueForServiceCalculator + Service saknar tester | 45 min |
| S60-2 | GAP 1 — Kan inte redigera intervall direkt i leverantörslistan | 60 min |
| S60-3 | GAP 3 — Ingen guard mot extrema intervallvärden (kund) | 30 min |
| S60-4 | GAP 4 — Ingen proaktiv notifikation när hästar förfaller | 45 min |
| S60-5 | GAP 6 — Native route returnerar 404 istället för tom lista | 15 min |
| S60-6 | DoD — Ta bort due_for_service feature flag | 15 min |

**Inte i sprint:** GAP 2 (optimistisk UI vid intervallredigering) — full reload fungerar, polish kan vänta.

---

## Stories

### S60-1: Tester för DueForServiceCalculator och DueForServiceService (GAP 5)

**Prioritet:** 1
**Effort:** 45 min
**Domän:** webb

**Problem:** `DueForServiceCalculator.calculateDueStatus()` och `DueForServiceService` innehåller projektets mest komplexa domänlogik — 3-nivå intervallprioritering, tröskelberäkning för "overdue"/"upcoming", deduplicering per (horseId, serviceId) — men har noll testtäckning. Ingen test för övergångarna, edge cases (precis på gränsen, saknat intervall, ingen bokningshistorik) eller prioriteringslogiken.

**Fix:** TDD bakåt — skriv tester som fångar nuvarande korrekt beteende och de viktigaste edge cases.

**Tester att skriva:**
- `calculateDueStatus`: overdue (daysUntilDue < 0), upcoming (0–14), ok (>14), exakt på gränsen
- Intervallprioritering: CustomerHorseServiceInterval > HorseServiceInterval > Service.recommendedIntervalWeeks
- `DueForServiceService`: deduplicering väljer senaste bokning per (horseId, serviceId)
- `DueForServiceService`: häst utan bokningshistorik returneras inte
- `DueForServiceService`: status "ok" filtreras bort (returnerar bara overdue + upcoming)

**Filer:**
- `src/domain/due-for-service/DueForServiceCalculator.test.ts` — ny fil
- `src/domain/due-for-service/DueForServiceService.test.ts` — ny fil

**Acceptanskriterier:**
- [ ] Minst 8 unit-tester (RED → GREEN per TDD)
- [ ] Alla edge cases täcks: exakt på gränsen, saknat intervall, tom bokningshistorik
- [ ] Intervallprioritering verifieras explicit i ett test
- [ ] `npx vitest run src/domain/due-for-service` grön

---

### S60-2: Redigera intervall direkt i leverantörslistan (GAP 1)

**Prioritet:** 2
**Effort:** 60 min
**Domän:** webb

**Problem:** Leverantören ser i listan att en häst har fel intervall men kan inte ändra det på plats. Måste navigera till hästtidslinjen (`/provider/horse-timeline/[horseId]`) — ett helt annat ställe. Det vanligaste use caset (justera intervall för specifik häst) är onödigt omständigt.

**Fix:** Lägg till inline redigering av intervall per rad i leverantörslistan. Klick på intervallvärdet öppnar ett litet input (eller en popover med slider/input) för att sätta `revisitIntervalWeeks`. Sparar till `HorseServiceInterval` via befintlig API (eller ny PUT-route om den saknas).

**Kontrollera först:** Om det finns en `PUT /api/provider/horses/[horseId]/intervals`-route eller liknande — använd den. Annars: skapa en enkel route.

**Filer:**
- `src/app/provider/due-for-service/page.tsx` — inline edit-UI per rad
- `src/app/api/provider/horses/[horseId]/interval/route.ts` — finns redan (se code-map), verifiera att PUT fungerar

**Acceptanskriterier:**
- [ ] Klick på intervallvärdet i listan öppnar redigeringsläge
- [ ] Spara uppdaterar `HorseServiceInterval` och listan reflekterar det nya värdet
- [ ] Avbryt återställer utan att spara
- [ ] Intervall valideras: 1–52 veckor (leverantörsgräns, inte kund)
- [ ] Visar "Sparat" som feedback vid lyckat sparande

---

### S60-3: Guard mot extrema intervallvärden för kund (GAP 3)

**Prioritet:** 3
**Effort:** 30 min
**Domän:** webb

**Problem:** Kunden kan sätta 104 veckor (2 år) som intervall för sin häst utan varning. Det osynliggör hästen i leverantörens lista i nästan 2 år. Ingen hjälptext förklarar vad ett rimligt värde är eller vad konsekvensen av ett högt värde är.

**Fix:**
- Lägg till hjälptext vid intervall-input: "Rekommenderat intervall för [tjänst] är [X] veckor"
- Varna (inte blockera) vid värden > 26 veckor: "Hästen syns inte i leverantörens påminnelselista förrän om [N] månader"
- Validera minimum 1 vecka på både klient och server (1 vecka är redan i backend, synka till UI)

**Filer:**
- `src/app/customer/horses/[id]/page.tsx` — lägg till hjälptext + varning
- `src/app/api/customer/horses/[horseId]/intervals/route.ts` — verifiera att min 1 vecka är validerat

**Acceptanskriterier:**
- [ ] Hjälptext med rekommenderat intervall visas vid input
- [ ] Varning visas vid värde > 26 veckor (ej blockerande)
- [ ] Minimum 1 vecka valideras i UI och API
- [ ] Ingen change i affärslogik — bara UX-förbättring

---

### S60-4: Proaktiv notifikation när hästar förfaller (GAP 4)

**Prioritet:** 4
**Effort:** 45 min
**Domän:** webb

**Problem:** Systemet vet vilka hästar som är försenade (`DueForServiceLookup` finns och används redan av `RouteAnnouncementNotifierFactory` för mejlnotifikationer). Men ingen notifikation skickas proaktivt till leverantören. Leverantören måste aktivt navigera till sidan för att upptäcka förfallna hästar.

**Fix:** Lägg till en cron-baserad notifikation (eller daglig sammanfattning) som skickar ett push-meddelande till leverantören vid nya "overdue"-hästar. Använd befintligt push-infrastruktur (`PushDeliveryService`) och `DueForServiceLookup`.

**Enklaste implementation:** Lägg till ett anrop i befintlig cron-route (om det finns en) eller skapa `GET /api/cron/due-for-service-notify` med Vercel Cron (dagligen, t.ex. kl 08:00).

**Kontrollera först:** Finns `src/app/api/cron/`-katalogen och hur är befintliga cron-routes satta upp?

**Filer:**
- `src/app/api/cron/due-for-service-notify/route.ts` — ny cron-route
- `vercel.json` — lägg till cron-schema (eller `vercel.ts`)

**Acceptanskriterier:**
- [ ] Cron-route kör dagligen och hämtar alla leverantörer med förfallna hästar
- [ ] Push-notifikation skickas till leverantörer med ≥1 overdue-häst
- [ ] Om inga overdue-hästar: ingen notifikation
- [ ] Route är skyddad (Vercel Cron auth-header eller intern secret)
- [ ] Test: mock av DueForServiceLookup + PushDeliveryService verifierar att rätt leverantörer notifieras

---

### S60-5: Native route returnerar tom lista istället för 404 (GAP 6)

**Prioritet:** 5
**Effort:** 15 min
**Domän:** webb

**Problem:** `GET /api/native/due-for-service` returnerar HTTP 404 när `due_for_service`-flaggan är av. Webb-endpointen returnerar `{ items: [] }`. iOS-appen hanterar inte 404 elegant och visar inget istället för tom lista.

**Fix:** Ändra native-routen så att den returnerar `{ items: [] }` med 200 när flaggan är av — konsekvent med webb-beteendet. (Tas bort i S60-6 ändå, men bör fixas för korrekthet.)

**Filer:**
- `src/app/api/native/due-for-service/route.ts` — returnera `{ items: [] }` när flagga är av

**Acceptanskriterier:**
- [ ] `GET /api/native/due-for-service` med flagga av returnerar `200 { items: [] }`
- [ ] Test uppdaterat om det finns ett för feature-flag-disabled-fallet

---

### S60-6: Ta bort due_for_service feature flag (DoD)

**Prioritet:** 6
**Effort:** 15 min
**Domän:** webb

**Problem:** Funktionen är feature-flaggad. Mål med sprint 60 är att göra den alltid aktiv.

**Fix:** Ta bort `due_for_service`-flaggan från alla platser:
- `src/lib/feature-flag-definitions.ts`
- `src/app/api/provider/due-for-service/route.ts`
- `src/app/api/customer/due-for-service/route.ts`
- `src/app/api/customer/horses/[horseId]/intervals/route.ts`
- `src/app/api/native/due-for-service/route.ts`
- `src/components/layout/ProviderNav.tsx`
- `src/app/customer/horses/[id]/page.tsx`
- `src/hooks/useDueForService.ts`

**Acceptanskriterier:**
- [ ] Sökning på `due_for_service` ger noll träffar i `src/`
- [ ] "Förfallen service" syns i nav utan feature flag-toggle
- [ ] `npm run check:all` grön
- [ ] Inga console-errors relaterade till saknad flagga

---

## Förväntat resultat

| Vad | Före | Efter |
|-----|------|-------|
| Domäntester | 0 tester | ≥8 unit-tester (Calculator + Service) |
| Redigera intervall | Navigera till hästtidslinjen | Inline i listan |
| Extrema intervallvärden | Ingen vägledning | Hjälptext + varning vid >26 veckor |
| Proaktiv notifikation | Saknas | Daglig cron-push vid overdue-hästar |
| Native 404 | Kraschar tyst | `{ items: [] }` med 200 |
| Feature flag | På | Borttagen |
