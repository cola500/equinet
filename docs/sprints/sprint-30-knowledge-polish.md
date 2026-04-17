---
title: "Sprint 30: Kunskap & Polish"
description: "Djupdokumentera guldkorn i patterns-katalogen, fixa licensrisken, rensa content-as-code"
category: sprint
status: archived
last_updated: 2026-04-17
tags: [sprint, docs, patterns, tech-debt]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 30: Kunskap & Polish

## Sprint Overview

**Mål:** Samla guldkornen i patterns-katalogen så framtida sessioner hittar dem, fixa sista licensrisken (Leaflet), och rensa 2100 rader content-as-code (hjälpartiklar).

**Bakgrund:** Efter S27-S29 är backloggen till stor del "process-polerad" -- få snabba vinster kvar. Pattern-katalogen skapad i PR #171 men fyllda bara på grundläggande nivå. Tre guldkorn väntar på djupdokumentation. Hjälpartiklar-migreringen har legat i tech-debt sedan S22 -- dags att ta den.

---

## Sessionstilldelning

En session kör hela sprinten sekventiellt. Om parallellt önskas:

- **Session 1** (webb/docs): S30-1, S30-2/3/4, S30-6, S30-7
- **Session 2** (webb): S30-5 (hjälpartiklar) -- rör `src/lib/help/`, ingen överlapp med session 1

Men det är bara ~8h totalt, så en session räcker.

---

## Stories

### S30-1: Leaflet CSS lazy-load (licensrisk)

**Prioritet:** 1
**Effort:** 15 min
**Domän:** webb

`leaflet.css` importeras i `src/app/layout.tsx` -- laddas därför på ALLA sidor, även de som inte använder kartor. Leaflet är Hippocratic-licensierad (icke-OSI-godkänd). Flytta till `RouteMapVisualization.tsx` (lazy).

**Implementation:**
- Ta bort `import "leaflet/dist/leaflet.css"` från `layout.tsx`
- Lägg till i `RouteMapVisualization.tsx` istället
- Verifiera att ruttplanering fortfarande fungerar

**Verifiera aktualitet först:** Kontrollera att import:en fortfarande finns i layout.tsx (kan ha flyttats i någon annan ändring).

**Acceptanskriterier:**
- [ ] Leaflet CSS importeras BARA i RouteMapVisualization
- [ ] Ruttplanering fungerar
- [ ] Ingen leaflet-CSS på andra sidor
- [ ] `npm run check:all` grön

---

### S30-2: Pattern-djupdok -- Dubbelt skyddslager (auth + RLS)

**Prioritet:** 2
**Effort:** 1h
**Domän:** docs

Skriv `docs/architecture/auth-rls-defense-in-depth-pattern.md` som förklarar:
- Applikationslagerskydd: `findByIdForProvider`, ownership guards
- Databaslagerskydd: RLS-policies
- Varför båda behövs (fångar varandras luckor)
- Konkreta exempel från Booking, Horse, Provider
- När pattern är överkurs (publika endpoints, stöddomäner)

**Källor:**
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts`
- `docs/architecture/database.md` (RLS-sektion)
- Pentest-rapporten

**Acceptanskriterier:**
- [ ] Pattern-dokument skapat med "när använda, implementationssteg, när INTE"
- [ ] Rad i `patterns.md` uppdaterad med länk till djupdok
- [ ] Konkreta kodreferenser inkluderade

---

### S30-3: Pattern-djupdok -- AI Service-mönster

**Prioritet:** 3
**Effort:** 1h
**Domän:** docs

Skriv `docs/architecture/ai-service-pattern.md` som förklarar den generella mallen:
- Zod-validering på AI-output (`safeParse` + `.default()`)
- Prompt injection-skydd (validera referens-ID mot känd kontext)
- Rate limiting (kostnadsskydd)
- Dependency injection för testbarhet

**Källor:**
- `src/domain/voice-log/VoiceInterpretationService.ts`
- `src/domain/customer-insight/CustomerInsightService.ts`

**Mål:** Nästa AI-feature (t.ex. "föreslå bokningstid") ska kunna kopiera mallen.

**Acceptanskriterier:**
- [ ] Pattern-dokument skapat
- [ ] Rad i `patterns.md` uppdaterad
- [ ] Två befintliga implementationer refererade som exempel

---

### S30-4: Pattern-djupdok -- Gateway abstraction

**Prioritet:** 4
**Effort:** 1h
**Domän:** docs

Skriv `docs/architecture/gateway-abstraction-pattern.md` som förklarar:
- Interface + implementation-struktur
- Mock-gateway för testning
- När Gateway motiveras vs YAGNI
- Fortnox-relevans (kommande integration behöver detta)

**Källor:**
- `src/domain/payment/PaymentGateway.ts` + `StripePaymentGateway.ts`
- `src/domain/subscription/SubscriptionGateway.ts` + `StripeSubscriptionGateway.ts`
- `src/domain/accounting/AccountingGateway.ts` + `FortnoxGateway.ts`

**Acceptanskriterier:**
- [ ] Pattern-dokument skapat
- [ ] Rad i `patterns.md` uppdaterad
- [ ] Tre befintliga implementationer refererade

---

### S30-5: Hjälpartiklar till markdown

**Prioritet:** 5
**Effort:** 0.5 dag
**Domän:** webb

`articles.provider.ts` (1335 rader) och `articles.customer.ts` (788 rader) -- totalt 2123 rader hjälpartiklar hårdkodade i TypeScript. Flytta till markdown.

**Verifiera aktualitet först:** Bekräfta att filerna fortfarande finns som TS-arrays (inte redan migrerade i annan sprint).

**Implementation:**
- Skapa `src/lib/help/articles/provider/<slug>.md` per artikel (28 artiklar enligt S18-2)
- Skapa `src/lib/help/articles/customer/<slug>.md` per artikel
- Ny loader som läser markdown vid build/runtime (behåll samma API-struktur)
- Behåll `types.ts` för TypeScript-typer
- Ta bort de gamla TypeScript-filerna
- UI:t ska fungera identiskt (webb + iOS native help)

**Acceptanskriterier:**
- [ ] Artiklar i markdown-filer, en per artikel
- [ ] 2000+ rader TypeScript borttagna
- [ ] Hjälpsidorna (webb + iOS native) fungerar identiskt
- [ ] Tester uppdaterade
- [ ] `npm run check:all` grön

---

### S30-6: Pattern-katalog -- 5 medel-prioritet-rader

**Prioritet:** 6
**Effort:** 2h
**Domän:** docs

Kortare entries i `patterns.md` för 5 mönster:

1. **Circuit breaker (generaliserat)** -- finns i `sync-engine.ts`, beskriv som generell retry-skydd
2. **Feature flag prioritet (env > DB > code)** -- kort förklaring av varför tre lager
3. **Optimistic UI med revert** -- iOS-pattern, porter-bar till webb
4. **Fire-and-forget notifier (utökning)** -- utöka befintlig rad med "varför DI, varför .catch"
5. **E2E-spec-taggning för cleanup** -- rad som länkar till `e2e.md`

**Format:** Korta djupdok-avsnitt direkt i `patterns.md` under respektive kategori, INTE separata filer. Håll koncist.

**Acceptanskriterier:**
- [ ] 5 utbyggda entries i patterns.md med "när, varför, kodreferens"
- [ ] Fungerande länkar till kod-exempel
- [ ] `npm run docs:validate` grön

---

### S30-7: Feature flag → fil-mapping i kodkartan

**Prioritet:** 7
**Effort:** 1h
**Domän:** infra

Utöka `scripts/generate-code-map.sh` att även generera en "feature flag → filer"-sektion. För varje flagga i `feature-flag-definitions.ts`, gör en grep och lista filerna som refererar den.

**Implementation:**
- Extendera scriptet med ny sektion
- Grep-baserat, enkelt skript
- Output i samma `code-map.md`-fil under ny H2

**Acceptanskriterier:**
- [ ] 20 feature flags listade med sina filer
- [ ] `npm run codemap` regenererar både domän- och flagga-sektion
- [ ] Dokumentation uppdaterad om nödvändigt

---

## Exekveringsplan

```
S30-1 (15 min) -> S30-2 (1h) -> S30-3 (1h) -> S30-4 (1h) -> S30-5 (0.5 dag) -> S30-6 (2h) -> S30-7 (1h)
```

**Total effort:** ~8h.

**Parallellisering möjlig:** S30-5 (hjälpartiklar i `src/lib/help/`) kan köras av andra sessionen medan session 1 kör pattern-djupdoken. Ingen filöverlapp.

## Definition of Done (sprintnivå)

- [ ] Leaflet CSS lazy-loaded (licensrisk borta)
- [ ] 3 pattern-djupdok skapade (Auth+RLS, AI Service, Gateway)
- [ ] 5 pattern-rad-entries utbyggda
- [ ] 2100+ rader content-as-code borta
- [ ] Feature flag-mapping i kodkartan
- [ ] `npm run check:all` grön
- [ ] `npm run codemap` uppdaterar feature flags-sektion
