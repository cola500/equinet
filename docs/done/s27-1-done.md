---
title: "S27-1 Done: Leaflet CSS lazy-load"
description: "Leaflet CSS flyttad från layout.tsx till RouteMapVisualization.tsx"
category: retro
status: active
last_updated: 2026-04-16
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S27-1 Done: Leaflet CSS lazy-load

## Acceptanskriterier

- [x] Leaflet CSS importeras BARA i RouteMapVisualization
- [x] Ruttplanering fungerar fortfarande (samma komponent, bara importflytt)
- [x] Ingen leaflet-CSS på andra sidor
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen funktionalitetsändring)
- [x] Tester gröna (4045 passed)
- [x] Feature branch, check:all grön

## Reviews

Kördes: Inga subagenter (mekanisk importflytt, 2 rader ändrade).

## Lärdomar

Inget oväntat. Enklaste möjliga story -- ren importflytt.
