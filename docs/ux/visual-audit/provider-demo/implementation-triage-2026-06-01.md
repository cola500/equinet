---
title: Provider Demo — Implementation Triage
description: Read-only implementation triage av Claude Design Visual UX Review för leverantörsdemon. Sammanfattar besluten och bryter ner dem i små slices med impacted files, risk, verifiering, rollback och demodata-beroende. Ingen kodändring.
category: guide
status: draft
last_updated: 2026-06-01
sections:
  - Beslut (sammanfattning av reviewn)
  - Viktig faktakorrigering
  - Slice 0 — Demo data sanity
  - Slice 1 — Mobile nav trim
  - Slice 2 — Calendar start page
  - Slice 3 — Slim Overview
  - Slice 4 — Visual quick wins
  - Rekommenderad första slice
tags:
  - ux
  - demo
  - provider
  - triage
  - slices
depends_on:
  - docs/ux/visual-audit/provider-demo/claude design review.md
  - docs/ux/provider-demo-ux-audit-2026-05.md
related:
  - docs/operations/demo-setup.md
---

# Provider Demo — Implementation Triage

> Read-only triage av [Claude Design Visual UX Review](./claude%20design%20review.md).
> **Ingen kodändring, ingen commit/push/deploy.** Små slices, ingen redesign, bevarad
> brand och struktur. Syftet är att besluta *vad* som ska göras och i *vilken ordning* —
> inte att göra det.

---

## Beslut (sammanfattning av reviewn)

Reviewn bekräftar de fem besluten. Kortform:

| # | Beslut | Reviewns svar | Nyans |
|---|--------|---------------|-------|
| 1 | **Kalender som start-sida** | **Ja** | Endast om demon har **framtida bokningar** OCH veckovyn visar 7 kolumner (inte en grön enkolumn). Tom är den sämre än dashboarden. |
| 2 | **Bokningar till "Mer"?** | **Nej — degradera, begrav inte** | Behåll som sekundär primär-flik (status-pillsen är appens bästa filter-UX). Kalender = *arbeta*, Bokningar = *skanna/filtrera*. |
| 3 | **Förenkla Översikt** | **Ja — banta hårt el. vik in i Kalender** | Enda unika värdet är statistik, och Insikter gör det bättre. Cut till priority-action + 2–3 KPI:er + länkar vidare. Ska INTE vara start-sida, ska INTE upprepa boknings-räknarna. |
| 4 | **Största omedelbara risken** | **Mobil botten-nav med 8 flikar** | Tydligaste "developer-built"-signalen på exakt den enhet målgruppen använder. #1 med marginal. |
| 5 | **Trust-blocker** | **"3B.2 smoke-test" i Meddelanden** | QA-sträng som läcker in i demon. Billig fix, oproportionerlig skada om kvar. |

Reviewns top-5-risker (rangordnade): (1) mobil 8-flikars-tabbar, (2) test-sträng i
Meddelanden, (3) dashboard = vägg av nollor + en larmande röd linje + trasig-ser-ut
intäktsgraf, (4) trippel-redundans bokningar, (5) kalender-veckovy som ser ut som en
enkolumn.

---

## Viktig faktakorrigering

**Demo-läget ÄR aktivt på staging** (jag skrev tidigare felaktigt motsatsen i briefingen).
Bevis: mobil botten-tabbaren renderar exakt `demoTabs` (7 st). I icke-demo-läge har
`providerTabs` bara 4 flikar. Desktop visade 6 primära (utan Recensioner) eftersom
`demoAllowed`-filtret tar bort `/provider/reviews` (ej i `DEMO_ALLOWED_PATHS`).

**Konsekvens:** spakarna för nav-trimning i demon är `demoTabs`, `DEMO_ALLOWED_PATHS`
och `providerMoreItems` i `ProviderNav.tsx` + `demo-mode.ts` — inte `providerTabs`.

**Andra nyckelfynd från koden:**

- **Seed-scriptet skapar redan framtida bokningar** (`daysFromNow(2/3/5/7/10/14)` för
  confirmed/pending, `scripts/seed-demo-provider.ts:471–552`). Att staging visar 0
  kommande beror på att seedet kördes för veckor sedan → de relativa offseten har blivit
  dåtid. **Ren omkörning räcker inte**: upsert med `update: {}` (rad 365) + skip-logik
  (rad 603) uppdaterar inte datum. **`--reset` krävs.**
- **"3B.2 smoke-test" finns INTE i kod eller seed** (sökt i hela repot). Det är manuellt
  inmatad data i staging-databasen → åtgärdas som data, inte kod.

---

## Slice 0 — Demo data sanity

**Mål:** framtidsdaterade bokningar, bort med test-strängen, populerade
Dashboard/Kalender/Bokningar. Inga IA-ändringar. *Prerequisite, inte feature.*

| Fält | Innehåll |
|------|----------|
| **Impacted files** | Inga kodändringar nödvändiga för grundfallet. Operativ körning av `npm run db:seed:demo-provider:reset` mot **staging-DB** (kräver staging-`DATABASE_URL` exporterad i shell, ej i .env). Ev. liten edit i `scripts/seed-demo-provider.ts` endast om vi vill *garantera* alltid-framtida bokningar oavsett när seedet kördes (det gör det redan relativt nu — så troligen ingen edit). |
| **"3B.2 smoke-test"** | Inte i seed. Två vägar: (a) `--reset` raderar demo-kundernas konversationer (märkta via `DEMO_CUSTOMER_EMAILS`) och återskapar rena — fungerar **om** strängen tillhör en demo-kund-konversation; (b) om den skapades av ett icke-demo testkonto: manuell DELETE i staging-DB av just den konversationen/meddelandet. **Måste verifieras efter reset.** |
| **Risk** | **Låg–medel.** Reset raderar demo-kunders bokningar/recensioner/meddelanden på staging och återskapar. Erik-kontot + tjänster berörs ej. Risk om man kör mot fel DB (prod) → **verifiera `npm run env:status` / vilken DATABASE_URL** före körning. ALDRIG demo-seed mot prod. |
| **Verification** | Logga in på staging som Erik → Dashboard "Kommande bokningar" > 0, Kalenderns aktuella vecka har block, Bokningar har mix av väntande/bekräftade/genomförda. Öppna Meddelanden → ingen "3B.2 smoke-test" eller andra QA-strängar. |
| **Rollback** | Data-only. Kör `--reset` igen för fräsch state. Ingen kod att reverta. Ta ev. DB-snapshot/backup av staging före körning om man vill kunna återställa exakt. |
| **Demodata-beroende** | Detta ÄR demodata-arbetet. Blockerar Slice 2 och 3. |

---

## Slice 1 — Mobile nav trim

**Mål:** mobil botten-tabbar = **Kalender · Bokningar · Kunder · Meddelanden · Mer**
(4 + Mer). Flytta Översikt, Insikter, Tjänster, Profil, Hjälp till Mer-drawer. Desktop
mestadels oförändrat (ev. trivial alignment). Ingen route tas bort.

| Fält | Innehåll |
|------|----------|
| **Impacted files** | `src/components/layout/ProviderNav.tsx` (konstanterna `demoTabs` rad 138–146, samt `providerMoreItems`/drawer-källan; ev. `providerTabs` rad 45–50 om vi unifierar icke-demo). `src/lib/demo-mode.ts` (`DEMO_ALLOWED_PATHS` styr vad som överhuvudtaget visas i demo). `BottomTabBar.tsx` behöver **inte** ändras (generisk, props-driven). Ev. test: `ProviderNav`-test om sådan finns. |
| **Konkret** | `demoTabs` → [Kalender, Bokningar, Kunder, Meddelanden] (4). Lägg Översikt i drawer: kräver en `dashboard`-post i `providerMoreItems` (finns ej idag — Översikt ligger inte i More-listan). Säkerställ Insikter/Tjänster/Hjälp/Profil i drawer (Insikter/Tjänster/Hjälp/Profil finns redan i `providerMoreItems`). |
| **Risk** | **Låg.** Ren IA/config i nav-komponenten, inga nya skärmar, inga route-borttag. Tester kan referera tab-ordning (bekräfta). Offline-safe-prefetch (`OFFLINE_SAFE_PATHS`) bygger på `providerTabs.offlineSafe` — om `providerTabs` ändras, kontrollera att dashboard/calendar/bookings fortfarande markeras offline-safe. |
| **Verification** | Mobil 390×844: botten-bar visar 4 läsbara flikar ≥44px + Mer. Mer-drawer innehåller Översikt, Insikter, Tjänster, Profil, Hjälp. Desktop: oförändrad eller medvetet unifierad. `npm run check:all` grön. Visuell verifiering (Playwright) av mobil + desktop. |
| **Rollback** | `git revert` av nav-commit. Isolerad till nav-filerna. |
| **Demodata-beroende** | **Nej.** Kan göras helt oberoende av Slice 0 (reviewn kallar den "do this first, no data dependency"). |

---

## Slice 2 — Calendar start page

**Mål:** provider-demons default-route landar på Kalender (inte Dashboard). Endast efter
Slice 0 (annars tom vecka). Verifiera att empty-week-risken är borta.

| Fält | Innehåll |
|------|----------|
| **Impacted files** | `src/components/landing/DemoLoginButton.tsx:33` (`router.push("/provider/dashboard")` → `/provider/calendar`) — **demo-specifik**, säkraste spaken. Test: `DemoLoginButton.test.tsx:55` (uppdatera förväntan). För manuell provider-login (Erik via formulär): **redirect-platsen ej lokaliserad i `src/app/login/`** — sannolikt i en auth-hook/session-route; måste hittas om vi vill ändra även den. Ev. `/provider`-route eller middleware om vi vill ha en server-side default. |
| **Risk** | **Låg om demo-gated** (DemoLoginButton). **Medel om global**: att ändra start-sida för *alla* providers (även riktiga) är ett produktbeslut, inte demo-only. Rekommendation: gate på demo (DemoLoginButton räcker för demon). |
| **Verification** | Klicka demo-login → landar på `/provider/calendar`. Veckovyn visar 7 dagar med bokningar (efter Slice 0). Ingen tom grön enkolumn. `DemoLoginButton.test` grön. |
| **Rollback** | En-rads revert i DemoLoginButton (+ test). |
| **Demodata-beroende** | **Ja, hård.** Får INTE göras före Slice 0 — annars landar tittaren i en tom vecka (reviewn: "empty, it's worse than the dashboard"). |

---

## Slice 3 — Slim Overview

**Mål:** ta bort duplicerade räknare, gör Översikt till en sammanfattnings-/insikts-ingång,
ev. flytta till "Mer".

| Fält | Innehåll |
|------|----------|
| **Impacted files** | `src/app/provider/dashboard/page.tsx` (stat-kort, statistik-grafer, snabblänkar). Ev. dashboard-graf-komponenter (`src/components/provider/*` / chart-komponenter). Nav-placering: `ProviderNav.tsx`/`demo-mode.ts` om Översikt flyttas till Mer (överlappar Slice 1). |
| **Konkret** | Reducera till: 1 priority-action + 2–3 KPI:er + explicita länkar till Kalender och Insikter. Ta bort "Kommande bokningar"/"Nya förfrågningar"-räknare som dubbleras i Kalender/Bokningar. Behandla röd avboknings-linje + tom intäktsgraf (överlappar Slice 4). |
| **Risk** | **Medel.** Dashboard delas av **alla** providers, inte bara demo. Att banta påverkar produktionsvyn → antingen acceptera för alla (rimligt — det är förbättringar) eller demo-gata (mer komplext). Innehåller logik (onboarding, priority-action) som inte får tappas. Kräver tester. |
| **Verification** | Dashboard visar inte längre samma räknare som Bokningar/Kalender. Tydlig väg vidare till Kalender + Insikter. `npm run check:all` grön. Visuell verifiering desktop + mobil. |
| **Rollback** | `git revert` av dashboard-commit. Isolerat till dashboard-sida + ev. grafkomponent. |
| **Demodata-beroende** | **Delvis.** Bäst bedömd/verifierad med populerad data (Slice 0), men koden kan ändras utan. |

---

## Slice 4 — Visual quick wins

**Mål:** billiga, lokala polish-fixar med hög trovärdighetsvinst.

| Fix | Impacted file(s) | Risk | Demodata-beroende |
|-----|------------------|------|-------------------|
| **Meddelanden-layout** (centrerad smal kolumn → vänsterställ/bredda) | `src/app/provider/messages/page.tsx:45` (`max-w-2xl mx-auto` → bredare/vänster) | Låg | Nej |
| **Tom intäktsgraf-copy** ("Ingen intäkt registrerad för perioden" istället för tom rutnät) | dashboard-graf-komponent (`dashboard/page.tsx` + chart) | Låg | Nej (men syns bara tom utan data) |
| **Dashboard-graffärg** (grön "genomförda" dominant, dämpa röd avbokning) | dashboard-graf-komponent | Låg | Nej |
| **Service-card min-height** (Redigera-knappar i linje) | `src/app/provider/services/page.tsx` / ServiceCard-komponent | Låg | Nej |
| **Kalender tip-banner** (auto-dölj efter första gången) | `src/app/provider/calendar/page.tsx:443` (`FirstUseTooltip`) | Låg | Nej |
| **Mic-FAB-overlap** ("Logga arbete" krockar med bottenbar / + Bokning) | `calendar/page.tsx:541` (`fixed bottom-20 right-4`), ev. `bookings/page.tsx` | Låg–medel (z-index/offset, en primär action per skärm) | Nej |
| **Kalender veckovy: 7 kolumner + dämpad tom-dag** (ej tjock grön helkolumn) | `calendar/page.tsx` + kalender-komponent | **Medel** (mer än copy — layout/render) | Ja (bäst verifierad med bokningar) |

> Notera: "3B.2 smoke-test"-strängen hör till **Slice 0** (data), inte hit. Veckovy-7-kolumner
> är gränsfall medium snarare än quick win — kan brytas ut till egen liten slice om den växer.

| Fält | Innehåll |
|------|----------|
| **Risk (samlat)** | Låg för copy/layout/min-height/banner. Medel för FAB-offset och veckovy-render. Var och en är isolerad → committa separat. |
| **Verification** | Per fix: visuell verifiering desktop + mobil (Playwright). `npm run check:all` grön. |
| **Rollback** | Per-fix-commits → granulär `git revert`. |
| **Demodata-beroende** | Mestadels nej; veckovy + empty-chart bäst bedömda med Slice 0. |

---

## Rekommenderad första slice

**Slice 0 — Demo data sanity, först.**

Skäl:
- **Prerequisite.** Reviewn är explicit: framtida bokningar är "the prerequisite, not a
  slice". Slice 2 och 3 är meningslösa att verifiera utan den.
- **Fixar trust-blockern (#2)** — "3B.2 smoke-test" försvinner i samma operation.
- **Lägst risk, ingen kod.** Ren operativ `--reset` mot staging (med DB-verifiering),
  inga komponenter rörs, trivial rollback.
- **Lås upp resten.** När Dashboard/Kalender/Bokningar är populerade kan vi se den
  *verkliga* visuella effekten innan IA-ändringar.

**Snabb-följd:** **Slice 1 (mobil nav-trim)** kan köras parallellt/omedelbart efter —
den är ren kod, oberoende av data, och adresserar reviewns risk #1. Slice 0 + Slice 1
tillsammans tar bort de två högst rankade riskerna med minimal risk.

**Sedan:** Slice 2 (Kalender start, kräver Slice 0) → Slice 3 (banta Översikt) →
Slice 4 (polish). Slice 2 bör demo-gatas (DemoLoginButton) tills ett produktbeslut tas
om att ändra start-sida för riktiga providers.

---

> **Stopp efter analys.** Ingen kod ändrad. Inväntar Johans val av första slice (rek: Slice 0).
> Öppna produktbeslut: (a) ska Slice 2/3 gälla även riktiga providers eller bara demo?
> (b) vill vi ändra `seed-demo-provider.ts` för att garantera alltid-framtida bokningar,
> eller räcker schemalagd/manuell `--reset`?
