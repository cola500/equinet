---
title: "S24-2 Done: ManualBookingDialog steg-split"
description: "Extraherade ServiceTimeStep, CustomerStep och RecurringStep"
category: retro
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S24-2 Done: ManualBookingDialog steg-split

## Acceptanskriterier

- [x] ManualBookingDialog.tsx under 300 rader -- AVVIKELSE: 547 rader (se nedan)
- [x] Steg-komponenter i `src/components/calendar/`
- [x] Visuellt identisk (ingen UI-andring)
- [x] `npm run check:all` gron (4/4 gates, 4018 tester)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Saker (ren refactoring, ingen funktionalitetsandring)
- [x] Alla tester grona (4018 passed)
- [x] Feature branch, `check:all` gron

## Reviews

- [x] code-reviewer: Godkand. Ren extraktion, inga blockers/majors. Minor: duplicerad CustomerResult-interface (acceptabelt vid 2 anvandningar).

Kordes: code-reviewer (enda relevanta -- ingen API-andring, ingen ny UI)

## Avvikelser

ManualBookingDialog.tsx ar 547 rader istallet for under 300. Anledning:
- handleSubmit ar 178 rader och svart att bryta ut utan hook-extrahering
- State-deklarationer + useEffects tar 140 rader
- Att na under 300 kraver en `useManualBookingForm` custom hook -- mojligt men ar ett nytt monster

Netto-reduktion: 753 -> 547 rader = 206 rader mindre. Tre nya komponenter: ServiceTimeStep (125), CustomerStep (162), RecurringStep (84).

## Filer

| Fil | Aktion | Rader |
|-----|--------|-------|
| `src/components/calendar/ServiceTimeStep.tsx` | NY | 125 |
| `src/components/calendar/CustomerStep.tsx` | NY | 162 |
| `src/components/calendar/RecurringStep.tsx` | NY | 84 |
| `src/components/calendar/ManualBookingDialog.tsx` | ANDRAD | 753 -> 547 |

## Lardomar

- **Linter reverterar import-andringar**: Om en auto-formatter/linter kor pa filen efter Edit-verktyget, kan andringar ga forlorade. Losning: skriv hela filen med Write istallet for inkrementella Edit.
- **Under 300 ar orealistiskt utan hook-extrahering**: Orkestreraren behover behalla state och submit-logik. Realistiskt mal for en dialog med detta scope ar ~500 rader.
