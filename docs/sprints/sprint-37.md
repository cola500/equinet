---
title: "Sprint 37: Messaging-rollout"
description: "Åtgärda MAJOR-1 + MAJOR-2 från S36-2-audit, sätt messaging-flag default: true, observera"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, messaging, rollout, security]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
  - Rollout-plan
---

# Sprint 37: Messaging-rollout

## Sprint Overview

**Mål:** Gör messaging tillgängligt för alla användare genom att åtgärda de två återstående MAJOR-fynden från S36-2-audit och sätta `messaging: default: true`.

**Bakgrund:** S35 levererade messaging-MVP bakom feature flag. S36-2-audit hittade 2 MAJOR som blockerar flag-rollout. S37 stänger dessa och slår på.

**Princip:** Liten sprint, lågt risk, hög feature-tillgänglighet. Observationsperiod efter rollout för att fånga skevheter i verklig användning.

---

## Stories

### S37-1: Suspense skeleton i ThreadView

**Prioritet:** 1
**Effort:** 30 min
**Domän:** webb (`src/app/provider/messages/[bookingId]/page.tsx`)

MAJOR-1 från S36-2-audit: `<Suspense fallback={null}>` (rad 197) ger blank vy medan `useSearchParams()` löser upp. Ersätt med enkel skeleton-komponent.

**Aktualitet verifierad:**
- Grep `fallback={null}` i `src/app/provider/messages/` — bekräfta att gap fortfarande finns
- Verifiera mot S36-2-audit-rapport (`docs/retrospectives/2026-04-18-messaging-ux-audit.md`)

**Implementation:**

**Steg 1: Skapa `ThreadSkeleton`-komponent**

Enkel skeleton med samma struktur som riktig ThreadView — header + 3 meddelande-rader + skriv-fält placeholder.

Använd Tailwind `animate-pulse` för skimmer-effekt. Placera i `src/components/provider/messages/ThreadSkeleton.tsx` eller inline om <30 rader.

**Steg 2: Byt ut `fallback={null}` → `<ThreadSkeleton />`**

I `src/app/provider/messages/[bookingId]/page.tsx` rad 197.

**Steg 3: Verifiera visuellt**

Playwright MCP: ladda sidan, se att skeleton visas kort (ej blank flash).

**Acceptanskriterier:**
- [ ] `ThreadSkeleton`-komponent skapad
- [ ] `fallback` ersatt i ThreadView
- [ ] Visuell verifiering: ingen blank flash
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (trivial, kan skippas enligt review-gating)

**Arkitekturcoverage:** N/A (direkt implementation av audit-fynd).

---

### S37-2: Hämta kundnamn/tjänst från API (query-param injection-fix)

**Prioritet:** 2
**Effort:** 1-1.5h
**Domän:** webb (`src/app/provider/messages/[bookingId]/page.tsx` + ev. ny API-route eller utvidgning)

MAJOR-2 från S36-2-audit: `customerName` och `serviceName` läses från query-params och renderas direkt. Query-param injection-risk. Flytta till API-hämtning.

**Aktualitet verifierad:**
- Kolla om `/api/bookings/[id]` redan returnerar kundnamn + tjänst-namn eller om det behöver utökas
- Grep nuvarande query-param-användning i `src/app/provider/messages/` — bekräfta exakt var det finns

**Implementation:**

**Steg 1: Identifiera API-källa**
- Kolla om befintlig endpoint (`/api/bookings/[id]`) returnerar data, eller om vi behöver utvidga `select`-block
- Alternativt: använd `/api/provider/conversations` om data finns där

**Steg 2: Lägg till SWR/hook för data-hämtning**
- Ersätt `useSearchParams()`-läsning med SWR-hämtning
- Visa skeleton (från S37-1) medan data laddas
- Felhantering: 404 → "Bokning hittades inte"-sida

**Steg 3: Ta bort query-param-källor**
- Både läs-sidan och länkarna som skapar query-params (provider/messages inkorg)
- Verifiera att inga andra platser läser samma query-params

**Steg 4: Tester**
- Enhetstest för ny hook om skapad
- E2E: navigera till tråd, verifiera korrekt namn visas utan query-params

**Acceptanskriterier:**
- [ ] Inga `useSearchParams()`-läsningar för kundnamn/tjänst i ThreadView
- [ ] Data hämtas från API (verifierat i nätverks-fliken)
- [ ] Felfallet (ogiltig booking) hanteras
- [ ] `npm run check:all` grön + `test:e2e:smoke` grön

**Reviews:** security-reviewer (primär — query-param injection-fix är säkerhetsändring), code-reviewer

**Arkitekturcoverage:** N/A (direkt fix av audit-fynd, ingen ny design).

---

### S37-3: Slå på messaging-flag + rollout-observation

**Prioritet:** 3
**Effort:** 15 min + observationsperiod
**Domän:** infra (`src/lib/feature-flag-definitions.ts` + deploy)

Sätt `messaging: { defaultEnabled: true }` och dokumentera observationsplan.

**Aktualitet verifierad:**
- Bekräfta att S37-1 och S37-2 är mergade
- Verifiera att `npm run test:e2e:smoke` är grön på main
- Bekräfta att post-rollout-rollback är möjlig (admin toggle finns)

**Implementation:**

**Steg 1: Uppdatera feature-flag-definitions.ts**
```ts
messaging: {
  key: "messaging",
  label: "Meddelanden",
  description: "Tvåvägs text-kommunikation mellan kund och leverantör per bokning",
  defaultEnabled: true,  // var false, nu true
  clientVisible: true,
  category: "shared",
},
```

**Steg 2: Testa-mocks uppdaterade**
- `src/lib/feature-flags.test.ts`
- `src/app/api/feature-flags/route.test.ts`

**Steg 3: Rollout-plan dokumenterad**

Skapa `docs/operations/messaging-rollout.md` med:
- Rollback-procedur (admin toggle `messaging=false`)
- Observationer att kolla första veckan:
  - Antal skickade meddelanden per dag (logs)
  - `MessageNotifier`-fel (Sentry)
  - Support-rapporter om UI-problem
- Metrics-förslag (ej blockerande): messaging-aktivering-rate per user

**Acceptanskriterier:**
- [ ] `messaging: defaultEnabled: true` committad
- [ ] Alla feature-flag-tester gröna
- [ ] `docs/operations/messaging-rollout.md` skapad med rollback + observation
- [ ] `npm run check:all` grön + `test:e2e:smoke` grön
- [ ] Deploy-lista uppdaterad (ingen migration krävs — bara kod-ändring)

**Reviews:** code-reviewer (trivial), cx-ux-reviewer (valfritt — kolla att UI funkar som förväntat för användare utan admin-toggle)

**Docs-matris:**
- README.md: lägg till "Meddelanden mellan kund och leverantör" under Implementerade Funktioner
- `docs/guides/feature-docs.md`: ny rad för messaging
- Hjälpartikel redan finns (`src/lib/help/articles/customer/meddelanden.md` från S35-1)

**Arkitekturcoverage:** N/A (bara flag-flipp).

---

## Exekveringsplan

```
S37-1 (30 min, skeleton) -> S37-2 (1-1.5h, injection-fix) -> S37-3 (15 min, flag on)
```

**Total effort:** ~2h + observationsperiod.

Sekventiell körning rekommenderas — S37-3 kräver att S37-1 + S37-2 är mergade först.

## Rollout-plan

**Dag 1-7 efter S37-3:**
- Kolla Sentry för `MessageNotifier`-fel
- Kolla loggar för antal meddelanden/dag
- Fånga support-rapporter (om några)

**Om problem:** admin toggle `messaging=false` (1 klick, omedelbar återkallelse)

**Efter 7 dagar utan problem:** rollout-komplett. Överväg Slice 2 (bilagor) i nästa sprint om användning är hög.

## Definition of Done (sprintnivå)

- [ ] S37-1/2/3 merged
- [ ] `messaging: defaultEnabled: true` deployad
- [ ] `docs/operations/messaging-rollout.md` finns
- [ ] README.md + feature-docs.md uppdaterade
- [ ] Inga Sentry-fel från MessageNotifier första 24h
