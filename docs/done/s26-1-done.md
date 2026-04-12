---
title: "S26-1 Done: useProviderCustomers refactoring"
description: "Baseline refactoring -- dela 624-raders hook i tre fokuserade hooks"
category: retro
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Experiment-matning
  - Avvikelser
  - Lardomar
---

# S26-1 Done: useProviderCustomers refactoring (BASELINE)

## Acceptanskriterier

- [x] useProviderCustomers.ts under 400 rader (285 rader)
- [x] Utility-funktioner i separat fil (useCustomerNotes.ts 214r, useCustomerHorses.ts 194r)
- [x] Alla befintliga tester passerar (7/7)
- [x] `npm run check:all` gron (4/4 gates, 4038 tester)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Saker (ingen ny attack surface, samma auth-flode)
- [x] Tester skrivna FORST (RED -> GREEN), coverage behalld
- [x] Feature branch, check:all gron

## Reviews

- [x] code-reviewer: 1 important (saknad `clearHorsesForCustomer` i `handleDeleteCustomer` -- fixad), 3 minor/suggestions (pre-existing callback deps, duplicerad type alias, cosmetic cast). Kordes parallellt med check:all.
- Ingen security-reviewer (ingen auth/API-andring)
- Ingen cx-ux-reviewer (ingen UI-andring)

## Experiment-matning

| Matt | Varde |
|------|-------|
| Total tid (start -> check:all gron) | ~8 min |
| Antal subagent-spawns | 0 (baseline) |
| Subagent-blockerings-incidenter | 0 |
| Anvande vi subagentens output? | N/A (baseline) |
| Uppskattat tid UTAN subagent | ~8 min (samma) |

## Avvikelser

- Typfixning behovdes: `GuardMutation`-typen i sub-hookarna var for generisk (`Record<string, unknown>`). Fixades till att anvanda `OfflineMutationOptions` fran `useOfflineGuard`.
- Totala rader okade fran 624 till 691 pga DI-boilerplate och exports, men varje fil ar under 300r.

## Lardomar

- **DI-typ maste matcha exakt**: Generisk `Record<string, unknown>` funkar inte som ersattning for en definierad interface. Importera den riktiga typen fran borjan.
- **Refactoring-overhead**: Hook-extrahering lagger till ~10% overhead i rader (type-definitioner, imports, re-exports). Vardefullt nar filer ar over 400 rader.
