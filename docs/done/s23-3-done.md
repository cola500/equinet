---
title: "S23-3 Done: Auto-generera kodkartan"
description: "Script som genererar code-map.md fran faktisk kodstruktur"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S23-3 Done: Auto-generera kodkartan

## Acceptanskriterier

- [x] Script genererar korrekt kodkarta (`scripts/generate-code-map.sh`)
- [x] Output matchar nuvarande code-map.md (238 rader, alla domaner, routes, UI-sidor)
- [x] `npm run codemap` script i package.json

## Vad scriptet gor

1. Skannar `src/domain/*/` for domaner
2. For varje doman: listar Services, Repository (om finns), API Routes (dedup)
3. Listar tvargarande infrastruktur (auth, rate limit, prisma, etc)
4. Listar UI-sidor per sektion (provider, kund, admin)

## Definition of Done

- [x] Scriptet fungerar och genererar korrekt output
- [x] `npm run codemap` registrerat

## Reviews

- Kordes: inga subagenter (verktygsskript, inte produktionskod)
