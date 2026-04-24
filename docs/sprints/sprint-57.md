---
title: "Sprint 57: Ruttsynlighet för nya kunder"
description: "Fyra gap-fixar från teater-analysen 'Anna letar efter en hovslagare i Strängnäs': ruttannonseringar synliga utan platsdata, rutt-kontext i bokningsdialogens header, notis vid ruttändring, och ruttar publika på leverantörsprofil."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, routes, ux, customer, notifications]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 57: Ruttsynlighet för nya kunder

## Sprint Overview

**Mål:** Fixa fyra konkreta GAP identifierade i teater-analysen "Anna letar efter en hovslagare i Strängnäs" (2026-04-24).

**Källa:** Teateranteckning — 4 GAP identifierade när Stina (ny kund, ingen platsdata, ingen follow) försöker hitta en hovslagare som redan är planerad för hennes område.

| Story | Gap | Effort | Värde |
|-------|-----|--------|-------|
| S57-1 | GAP C — NearbyRoutesBanner kräver platsdata — osynlig för nya kunder | 1-2h | Hög |
| S57-2 | GAP D — Ruttar når bara följare, inte nya kunder | 2-3h | Hög |
| S57-3 | GAP A — Bokningskalendern visar inte var leverantören är under dagen | 1-2h | Medel |
| S57-4 | GAP B — Ingen notis vid ruttändring (bara vid ny rutt) | 2-3h | Medel |

**Prioritetsordning:** S57-1 och S57-2 löser Stinas problem (ny kund, ingen platsdata, ingen follow). S57-3 förbättrar Annas upplevelse (befintlig kund som bokar). S57-4 är en notis-gap som påverkar alla.

---

## Stories

### S57-1: Visa kommande ruttar på leverantörsprofil utan platsdata (GAP C)

**Prioritet:** 1
**Effort:** 1-2h
**Domän:** webb

**Problem:** `NearbyRoutesBanner` anropas med `?latitude=...&longitude=...` och renderas bara om appen känner till kundens position. Stina har aldrig godkänt plats-tillstånd — hon ser ingen banner. En hovslagare som planerat ett besök i hennes kommun tio dagar framåt är helt osynlig för henne.

**Fix:** På leverantörsprofilen — visa kommande ruttar som en textrad under leverantörsbeskrivningen, utan att kräva GPS-data. Kommunnamnet räcker: "Planerat besök i Södermanland, 12–13 maj".

**Filer:**
- `src/app/providers/[id]/page.tsx` (eller motsvarande profilsida) — lägg till sektion för kommande ruttar
- `src/app/api/providers/[id]/route-announcements/route.ts` (eller befintlig endpoint) — ny endpoint (eller använd befintlig utan lat/lng)

**Implementation:**
1. Ny GET-endpoint: `/api/providers/[id]/upcoming-routes` — returnerar kommande ruttannonseringar för en specifik leverantör (datum, kommuner/regioner). Ingen auth krävs (publik profil).
2. På profilsidan: hämta och visa dessa rutter som en lista om de finns. Format per rad: `📅 [datum] · [kommuner]`. Visa max 3 framtida ruttar.
3. Befintlig `NearbyRoutesBanner` kan leva kvar för det geo-baserade fallet — detta är ett komplement, inte en ersättare.

**Acceptanskriterier:**
- [ ] Kommande ruttar visas på leverantörsprofilen utan att kunden behöver ha godkänt plats-tillstånd
- [ ] Datum och kommuner/regioner visas per rutt
- [ ] Max 3 kommande ruttar visas (närmast i tid)
- [ ] Sektionen döljs om inga kommande ruttar finns
- [ ] Integrationstest för den nya endpoint

---

### S57-2: Ruttar synliga för alla på leverantörsprofilen, inte bara följare (GAP D)

**Prioritet:** 2
**Effort:** 2-3h
**Domän:** webb

**Problem:** Erik annonserade sin rutt — hans följare fick in-app-notis. Men Stina hittar Erik via sökning precis nu och följer honom inte. Inga av Eriks ruttar är synliga för henne, och hon fick aldrig notisen. Systemet är optimerat för återkommande kunder, inte för nya.

**Fix:** Gör ruttannonseringar publik tillgängliga på leverantörsprofilen — synliga för alla besökare, inte bara notifierade följare. S57-1 levererar den tekniska grunden; denna story ser till att presentationen är välgjord och att ruttar är sökbara.

**Filer:**
- `src/app/providers/[id]/page.tsx` — förbättra rutt-sektionen från S57-1
- `src/app/providers/page.tsx` — leverantörskort i söklistan kan visa "Planerat besök: 12–13 maj" som undertext om rutt finns

**Implementation:**
1. Leverantörskort i sökresultaten (`/providers`): lägg till en liten pill/badge "Kommer snart till [region]" om leverantören har en rutt inom 30 dagar.
2. Profilsidan (bygger på S57-1): rutt-sektionen ska vara tydlig och framträdande, inte gömd. Placering: ovanför eller direkt under bio, med tydlig rubrik "Kommande besök".
3. Ingen ändring av notis-systemet — det är en separat fråga. Fokus är synlighet på profil + sökresultat.

**Acceptanskriterier:**
- [ ] Leverantörskort i sökresultaten visar "Kommer snart till [region]" om rutt finns inom 30 dagar
- [ ] Leverantörsprofil visar kommande ruttar framträdande (ovan fold)
- [ ] Synligt för icke-inloggade besökare och kunder som inte följer leverantören
- [ ] Integrationstest för leverantörslistan med rutt-filter

---

### S57-3: Rutt-kontext i bokningsdialogens header (GAP A, MVP)

**Prioritet:** 3
**Effort:** 1-2h
**Domän:** webb

**Problem:** Anna öppnar bokningsdialogen via "Boka på rutten" — men kalenderslotsen visar Eriks ordinarie tillgänglighet för hela veckorna, inte bara de tider som är kopplade till ruttens geografiska plats. Anna kan inte avgöra om 10:00 måndag är i Strängnäs eller Nyköping.

**Fix (MVP):** Visa en informationstext i bokningsdialogens header när dialogen öppnades via en rutt-länk: "Erik är planerad för Södermanland-området dessa dagar". Filtrera inte bort slots — bara informera.

**Filer:**
- `src/app/customer/bookings/new/` (eller bokningsdialogen) — identifiera om den öppnades via ruttkontext
- URL-parameter: `?routeId=<id>` skickas troligtvis redan vid "Boka på rutten"

**Implementation:**
1. Kontrollera om `routeId` finns i URL när bokningsdialogen öppnas.
2. Om ja: hämta ruttens datum och kommuner/regioner via `/api/route-orders/[routeId]`.
3. Visa en informations-banner i toppen av kalender-steget: "Du bokar via Eriks planerade tur i Södermanland (12–13 maj). Välj en tid som passar — leverantören bekräftar om den passar rutten."
4. Om `routeId` saknas: ingen förändring mot idag.

**Acceptanskriterier:**
- [ ] Informationsbanner visas i bokningsdialogens kalender-steg om `routeId` finns i URL
- [ ] Bannern visar ruttens datum och region
- [ ] Om `routeId` saknas: dialogen ser ut exakt som idag (ingen regression)
- [ ] Bannern är dismissible eller stängs efter val av tid

---

### S57-4: Notis vid ruttändring (GAP B)

**Prioritet:** 4
**Effort:** 2-3h
**Domän:** webb

**Problem:** Om Erik annonserar en ny rutt skickas notis till hans följare. Men om han ändrar en existerande rutt (datum, kommuner) — ingen notis. Bekräftade bokningar påverkas inte synligt av ruttändringar; kunden sitter med en bokning utan att veta att förutsättningarna ändrats.

**Fix:** Skicka notis till påverkade kunder när en rutt ändras. "Påverkade kunder" = kunder med bekräftade bokningar under den ändrade ruttens datum.

**Filer:**
- `src/app/api/route-orders/[id]/route.ts` (PUT/PATCH) — trigga notis vid ruttändring
- `src/domain/route-order/RouteOrderService.ts` (eller motsvarande) — notis-logik
- Befintligt notis-system (Notification-modellen + push-infrastruktur)

**Implementation:**
1. I ruttens UPDATE-handler: jämför gamla och nya datum/kommuner.
2. Om datum eller kommuner ändrats: hämta alla bokningar under rutt-perioden med status "confirmed".
3. Skicka notis till berörda kunder: "Erik Järnfot har uppdaterat sin rutt i Södermanland. Kontrollera att din bokning fortfarande stämmer."
4. Fire-and-forget-mönster (`.catch(logger.error)`) — notis-fel blockerar inte ruttändringen.

**Acceptanskriterier:**
- [ ] Notis skickas till kunder med bekräftade bokningar när ruttens datum ändras
- [ ] Notis skickas om kommuner/regioner ändras på rutten
- [ ] Notis-fel blockerar inte ruttändringen (fire-and-forget)
- [ ] Ingen notis skickas om rutten inte ändrades (idempotent)
- [ ] Integrationstest för notis-triggern vid ruttändring
