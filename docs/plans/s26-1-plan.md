---
title: "S26-1: useProviderCustomers refactoring"
description: "Dela upp 624-raders hook i tre fokuserade hooks"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Analys
  - Approach
  - Filer
  - Risker
---

# S26-1: useProviderCustomers refactoring

## Analys

`src/hooks/useProviderCustomers.ts` ar 624 rader med tre tydliga concerns:

1. **Kund-CRUD** (~160 rader): fetch, add, edit, delete kunder + filter/expand state
2. **Anteckningar-CRUD** (~160 rader): fetch, add, edit, delete anteckningar
3. **Hast-CRUD** (~170 rader): fetch, save, delete hastar

Alla tre anvander `guardMutation` fran `useOfflineGuard` for offline-stod.

## Approach

Extrahera notes och horses till separata hooks. Huvudhooken blir en orchestrator.

| Ny fil | Innehall | ~Rader |
|--------|----------|--------|
| `useCustomerNotes.ts` | Notes state + CRUD (fetchNotes, handleAddNote, handleEditNote, handleDeleteNote) | ~170 |
| `useCustomerHorses.ts` | Horse state + CRUD (fetchHorses, handleSaveHorse, handleDeleteHorse) | ~180 |
| `useProviderCustomers.ts` | Kund-CRUD + filter/expand + komponerar notes/horses hooks | ~180 |

### Principer

- **Returntypen andras INTE** -- page.tsx och befintliga tester ska fungera utan andringar
- Nya hooks tar `guardMutation` som parameter (dependency injection, enklare testning)
- Befintliga tester flyttas till ratt hook-testfil

## Filer

| Fil | Andring |
|-----|---------|
| `src/hooks/useProviderCustomers.ts` | Refaktoreras, importerar nya hooks |
| `src/hooks/useCustomerNotes.ts` | NY -- notes logic |
| `src/hooks/useCustomerHorses.ts` | NY -- horses logic |
| `src/hooks/useCustomerNotes.test.ts` | NY -- notes tester |
| `src/hooks/useCustomerHorses.test.ts` | NY -- horses tester |
| `src/hooks/useProviderCustomers.test.ts` | Behalls, testar orchestration |
| `src/app/provider/customers/page.tsx` | INGEN andring |

## Risker

- **Callback-beroenden**: `toggleExpand` anropar bade `fetchNotes` och `fetchHorses`. Losas genom att ta callback-refs fran sub-hooks.
- **Delad state**: `expandedCustomer` anvands av bade notes och horses. Forblir i huvudhooken.
- **handleDeleteCustomer**: Rensar bade notes och horses maps. Behover callbacks fran sub-hooks.
