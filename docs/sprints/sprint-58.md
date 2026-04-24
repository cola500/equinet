---
title: "Sprint 58: Affärsinsikter — release-klar"
description: "Fyra gap-fixar från teateranalysen av business_insights. Definition of done: feature flag borttagen, funktionen alltid aktiv."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, insights, provider, feature-flag]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 58: Affärsinsikter — release-klar

## Sprint Overview

**Mål:** Gör Affärsinsikter tillräckligt bra för att ta bort feature flaggan och släppa funktionen permanent.

**Källa:** Teateranalys 2026-04-24 — fem luckor identifierade när Erik (hovslagare) öppnar Insikter-sidan.

**Definition of done (sprint):** `business_insights`-flaggan är borttagen ur kodbasen. Funktionen är alltid aktiv.

| Story | Gap | Effort | Demovärde |
|-------|-----|--------|-----------|
| S58-1 | Total intäkt saknas — viktigaste affärsmåttet | 1-2h | Hög |
| S58-2 | Delta-indikator på KPIs — ger kontext | 2-3h | Medel-hög |
| S58-3 | Tomtläge + servicebreakdown-rubrik | 1h | Medel |
| S58-4 | Ta bort feature flag (webb-gate + permanent release) | 30 min | Kritisk |

---

## Stories

### S58-1: Total intäkt som KPI-kort

**Prioritet:** 1
**Effort:** 1-2h
**Domän:** webb

**Problem:** KPI-raden visar snittbokningsvärde men inte total intäkt. "Vad tjänade jag den här månaden?" är det mest grundläggande affärsmåttet för en hovslagare — och det saknas helt. `totalRevenue` räknas redan ut i API-routen men returneras aldrig.

**Fix:** Lägg till `totalRevenue` i API-responsen och ett nytt KPI-kort i UI:t.

**Filer:**
- `src/app/api/provider/insights/route.ts` — lägg till `totalRevenue` i `kpis`-objektet
- `src/app/api/native/insights/route.ts` — samma ändring (paritet)
- `src/components/provider/InsightsCharts.tsx` — nytt KPI-kort "Total intäkt"
- `src/app/api/provider/insights/route.test.ts` — verifiera att `totalRevenue` returneras

**Implementation:**
1. I `kpis`-objektet: `totalRevenue: Math.round(totalRevenue)`
2. I `KPIs`-interfacet: `totalRevenue: number`
3. Nytt KPI-kort: label "Total intäkt", value `${kpis.totalRevenue.toLocaleString("sv-SE")} kr`, info "Summa intäkt från genomförda bokningar i perioden."
4. Placera kortet före "Snittbokningsvärde" — det är mer grundläggande.
5. Grid-uppdatering: 6 kort istället för 5 — `md:grid-cols-6` eller radbrytning.

**Acceptanskriterier:**
- [ ] `totalRevenue` returneras från `/api/provider/insights`
- [ ] KPI-kort "Total intäkt" visas på insiktssidan
- [ ] Formaterat med `toLocaleString("sv-SE")` + " kr"
- [ ] Info-popover: "Summa intäkt från genomförda bokningar i perioden."
- [ ] Paritet med native-route (`/api/native/insights`)
- [ ] Test: `totalRevenue` i API-responsen

---

### S58-2: Delta-indikator på KPI-korten

**Prioritet:** 2
**Effort:** 2-3h
**Domän:** webb

**Problem:** Erik ser "15% avbokningsgrad" men vet inte om det är bra eller dåligt — ingen referenspunkt. Period-selectorn finns men ger ingen jämförelse mot föregående period. KPI-korten är informativa men inte handlingsbara.

**Fix:** Hämta föregående periods data och visa delta (↑/↓ X%) under varje KPI-värde. Grön pil = förbättring, röd pil = försämring (riktningslogik per KPI-typ).

**Filer:**
- `src/app/api/provider/insights/route.ts` — lägg till `previousPeriod`-beräkning
- `src/components/provider/InsightsCharts.tsx` — delta-visning i `KPICard`

**Implementation:**
1. API: hämta bookings för föregående period (samma längd, direkt innan nuvarande). Beräkna samma KPIs. Returnera som `previousKpis`.
2. `KPICard`-komponenten: ta emot valfri `delta?: number` och `deltaDirection?: "up-good" | "up-bad"`. Visa `↑ X%` i grönt eller `↓ X%` i rött baserat på riktning.
3. Riktningslogik:
   - `cancellationRate`: upp = dåligt (röd), ned = bra (grön)
   - `noShowRate`: upp = dåligt (röd), ned = bra (grön)
   - `averageBookingValue`: upp = bra (grön), ned = dåligt (röd)
   - `totalRevenue`: upp = bra (grön), ned = dåligt (röd)
   - `uniqueCustomers`: upp = bra (grön), ned = dåligt (röd)
   - `manualBookingRate`: neutral (grå, ingen pil)
4. Om delta < 1%: visa inte pilen (brus).
5. Om `previousPeriod` saknar data (ny leverantör): visa inget delta.

**Acceptanskriterier:**
- [ ] API returnerar `previousKpis` med samma struktur som `kpis`
- [ ] KPI-kort visar delta med pil och färg
- [ ] Riktningslogik är korrekt per KPI-typ
- [ ] Delta < 1% visas inte
- [ ] Ny leverantör (ingen föregående period): inga pilar
- [ ] Test: delta beräknas korrekt i API

---

### S58-3: Tomtläge och servicebreakdown-rubrik

**Prioritet:** 3
**Effort:** 1h
**Domän:** webb

**Problem A:** Ny leverantör utan bokningar ser fem nollor (`0%`, `0 kr`, `0`, `0%`, `0%`) utan förklaring. Det ser trasigt ut.

**Problem B:** "Populäraste tjänster"-grafen baseras bara på *genomförda* bokningar men det framgår inte av rubriken — en leverantör med bara pending-bokningar ser tomma grafer och förstår inte varför.

**Fix A:** Om alla KPI-värden är 0 (ingen data i perioden): visa ett informativt tomtläge ovanför KPI-korten.

**Fix B:** Uppdatera underrubriken på servicebreakdown-kortet.

**Filer:**
- `src/components/provider/InsightsCharts.tsx` — tomtläseslogik + underrubrik

**Implementation:**

Fix A — tomtläge:
```
Om serviceBreakdown.length === 0 && kpis.uniqueCustomers === 0:
  Visa en informationsruta ovanför KPI-korten:
  "Inga bokningar i den valda perioden. Insikterna fylls på allteftersom du får bokningar."
  Visa fortfarande KPI-korten (med nollor) men med tydlig kontext.
```

Fix B — underrubrik:
- Ändra `CardDescription` från "Genomförda bokningar och intäkt per tjänst" till "Genomförda bokningar och intäkt per tjänst (exkl. avbokade och pending)"

**Acceptanskriterier:**
- [ ] Leverantör utan data i perioden ser informativt meddelande, inte bara nollor
- [ ] Servicebreakdown-underrubriken förklarar att bara genomförda räknas
- [ ] Befintlig data-vy är oförändrad

---

### S58-4: Ta bort feature flag

**Prioritet:** 4
**Effort:** 30 min
**Domän:** webb

**Problem:** `business_insights`-flaggan är aktiv men webb-routen `/api/provider/insights` saknar feature gate (native-routen har den). Dessutom: när S58-1–3 är klara finns inga kvarvarande skäl att ha funktionen bakom en flagga.

**Fix:**
1. Fixa webb-route (säkerhetslucka): lägg till `isFeatureEnabled`-check.
2. Ta sedan bort flaggan ur hela kodbasen.

**Filer:**
- `src/app/api/provider/insights/route.ts` — lägg till gate (steg 1), ta bort (steg 2)
- `src/app/api/native/insights/route.ts` — ta bort gate
- `src/app/provider/insights/page.tsx` — ta bort `useFeatureFlag`-check
- `src/lib/feature-flag-definitions.ts` — ta bort `business_insights`-entry
- `src/components/layout/ProviderNav.tsx` — ta bort `featureFlag`-prop på Insikter-länken
- `docs/sprints/backlog.md` — flytta till arkiv

**Implementation:**
Steg 1 (säkerhetslucka, innan borttag):
```typescript
if (!(await isFeatureEnabled("business_insights"))) {
  return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
}
```

Steg 2 (ta bort flaggan):
- Sök på `business_insights` i hela `src/` — ta bort alla träffar
- Ta bort entry ur `feature-flag-definitions.ts`
- ProviderNav: ta bort `featureFlag: "business_insights"` på Insikter-länken (länken är alltid synlig)
- Insiktssidan: ta bort `useFeatureFlag`-blocket som returnerar "inte tillgänglig"-vy

**Acceptanskriterier:**
- [ ] `business_insights` finns inte i `feature-flag-definitions.ts`
- [ ] Inga `isFeatureEnabled("business_insights")`-anrop i kodbasen
- [ ] Inga `useFeatureFlag("business_insights")`-anrop i kodbasen
- [ ] Insikter-länken visas alltid i navbaren (ingen feature-gate)
- [ ] `npm run check:all` grön
