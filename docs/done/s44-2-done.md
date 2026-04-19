---
title: "S44-2 Done: horses-CRUD coverage-gap + filter=upcoming-fix"
description: "Täppte två coverage-gap från S43-review: horses page.test.tsx (7 tester) + filter=upcoming i due-for-service integration-test."
category: guide
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Täckning
  - Lärdomar
---

# S44-2 Done: horses-CRUD coverage-gap + filter=upcoming-fix

## Acceptanskriterier

- [x] `src/app/customer/horses/page.test.tsx` skapad med 7 tester
  - [x] Empty state, horse list, skeleton
  - [x] Delete-dialog öppnas
  - [x] Confirm → DELETE fetch anropas, toast.success, mutate
  - [x] Cancel → ingen fetch, dialog stängs
  - [x] Fetch-fel → toast.error
- [x] `filter=upcoming`-test tillagd i due-for-service integration-test (11 → 1 nytt = 11 totalt var 10)
- [x] `npm run check:all` grön (4276 tester, 4/4 gates)

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker (enbart tester — ingen produktionskod ändrad)
- [x] Tester gröna
- [x] Feature branch, check:all grön, klar för merge

## Reviews körda

- [x] code-reviewer — findings: 1 Important, 3 Suggestions
  - **Important fixad:** Selektor-fragiliteten "Ta bort"-knapp → `getAllByRole(...)[0]` för card-klick
  - **Suggestion fixad:** `clientLogger` mock tillagd → undviker console-brus i tester
  - Suggestion (ej åtgärdad): `useIsMobile`-kommentar — känd och acceptabel
  - Suggestion (ej åtgärdad): `DueStatusBadge` inte testad — känd gap, integration-nivå täcker domänlogiken

## Docs uppdaterade

Ingen docs-uppdatering (intern testförbättring — ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: ja
- Kollade code-map.md för att hitta filer: ja
- Hittade matchande pattern: existerande component-tester i `provider/`-mappen (calendar, route-planning)

## Täckning

| Gap | Lösning | Tester |
|-----|---------|--------|
| filter=upcoming saknas | `makeUpcomingBooking()` + assert status=upcoming, length=1 | +1 |
| horses page.tsx saknar tester | Component-test med `vi.mock()` + `global.fetch` | +7 |

## Lärdomar

- `window.matchMedia is not a function` i JSDOM — behöver alltid mocka `useMediaQuery`/`useIsMobile` i component-tester som renderar `Responsive*`-komponenter
- `clientLogger` bör alltid mockas i component-tester för att undvika console-brus
- `getAllByRole(...)[0]` är säkrare än `getByRole(...)` när en knapp kan dyka upp i dialogs+lista simultant
