---
title: "S40-1 Done: Feature flag smart_replies + unit-tester"
description: "Feature flag för gradvis rollout + TDD-tester för expandTemplate"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Avvikelser och lärdomar
---

# S40-1 Done

## Acceptanskriterier

- [x] `smart_replies` flag definierad, `defaultEnabled: false`, `category: "provider"` (fixat från initial "shared" efter code-review)
- [x] ThreadView renderar chips BARA om flag enabled
- [x] 7 unit-tester för `expandTemplate` (alla gröna)
- [x] Feature-flag-tester fortfarande gröna (uppdaterade med smart_replies: false)
- [x] `npm run check:all` grön (4174 tester, 4/4 gates)

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker (inga API-ändringar, feature flag-gating är klient-side UI-feature)
- [x] TDD: tester skrivna, gröna
- [x] `check:all` grön
- [x] Feature branch + PR

## Reviews körda

- [x] code-reviewer: Kördes. Findings:
  - **Important (fixad)**: `category: "shared"` → `category: "provider"` (smart_replies är enbart leverantörs-UI)
  - **Important (fixad)**: Testfall 4 var redundant (`{}` identisk med test 2) -- omskrivet till `datum: undefined` för explicit undefined-test
  - **Minor (deferred)**: Docs (hjälpartikel + testing-guide) tas i S40-2
  - **Suggestion**: Test 6 `.not.toThrow()` är svagt -- accepterat som "contract test" (verifierar att templates körs utan runtime-fel)

## Docs uppdaterade

Ingen docs-uppdatering i denna story -- flaggan är `defaultEnabled: false`. Hjälpartikel och testing-guide uppdateras i S40-2 när featuren dokumenteras för administratörer.

## Verktyg använda

- Läste patterns.md vid planering: nej (feature-flags.md är primär referens för detta)
- Kollade code-map.md: nej
- Hittade matchande pattern: useFeatureFlag-mönster från feature-flags.md

## Arkitekturcoverage

N/A

## Modell

sonnet

## Avvikelser och lärdomar

- `category: "provider"` är rätt val när featuren enbart berör en roll -- `"shared"` antyder att båda rollerna berörs.
- E2E feature-flag-toggle.spec.ts testar inte enskilda flaggnamn -- ingen uppdatering behövdes.
