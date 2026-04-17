---
title: "S27-8: Testing-guide till markdown -- Done"
description: "Extraherade manuell testningsguide till markdown och minskade admin-sidan"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S27-8: Testing-guide till markdown -- Done

## Acceptanskriterier

- [x] Testing-guide i markdown (`docs/testing/testing-guide.md`) med alla ~120 checklistepunkter
- [x] Admin-sidan krympt: 901 -> 394 rader (TEST_DATA extraherat till `test-data.ts`)
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen ny funktionalitet, bara refaktoring)
- [x] Tester gröna (4071 passed)
- [x] Feature branch, `check:all` grön

## Reviews

Kördes: ingen (ren data-extrahering, ingen logikändring)

## Avvikelser

- Admin-sidan behölls (inte borttagen) -- den har interaktiv progress-tracking med localStorage som markdown inte kan erbjuda. Istället extraherades TEST_DATA (475 rader) till `test-data.ts`.
- Markdown-guiden använder ASCII-substitut (a, o, a) i checklistetexten istället för å, ä, ö. Admin-sidans data har korrekta svenska tecken.

## Lärdomar

- Data-extrahering till separat fil är en enkel och effektiv refaktoring som minskar page.tsx med >50% utan att ändra beteende.
