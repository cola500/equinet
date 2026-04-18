---
title: "S27-1: Leaflet CSS lazy-load"
description: "Flytta leaflet CSS-import från layout.tsx till RouteMapVisualization.tsx"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Bakgrund
  - Approach
  - Filer som ändras
  - Risker
---

# S27-1: Leaflet CSS lazy-load

## Bakgrund

`import "leaflet/dist/leaflet.css"` ligger i `src/app/layout.tsx` (rad 4), vilket laddar Hippocratic-licenserad CSS på ALLA sidor. Leaflet används bara i ruttplaneringsvyn.

## Approach

1. Ta bort `import "leaflet/dist/leaflet.css"` från `src/app/layout.tsx`
2. Lägg till `import "leaflet/dist/leaflet.css"` i `src/components/RouteMapVisualization.tsx`
3. Verifiera med `npm run check:all`

## Filer som ändras

- `src/app/layout.tsx` -- ta bort import (rad 4)
- `src/components/RouteMapVisualization.tsx` -- lägg till import

## Risker

- Låg risk. Enkel importflytt. Leaflet CSS behövs bara där kartan renderas.
