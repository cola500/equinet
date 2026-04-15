---
title: "Licensgranskning inför lansering"
description: "Granskning av alla prod-dependencies licenser -- identifierade risker och åtgärder"
category: security
status: active
last_updated: 2026-04-15
tags: [security, license, launch, legal]
sections:
  - Sammanfattning
  - Licensöversikt
  - Flaggade paket
  - Rekommendationer
---

# Licensgranskning inför lansering

**Datum:** 2026-04-15
**Granskare:** Tech lead (Claude Code)
**Metod:** `npx license-checker --production` + manuell granskning av flaggade paket

## Sammanfattning

50 prod-dependencies granskade. Inga blockerare för lansering.

| Resultat | Antal |
|----------|-------|
| Inga problem (MIT, Apache-2.0, ISC, BSD) | 456 |
| Att bevaka (Hippocratic) | 2 |
| OK med villkor (LGPL) | 1 |
| Bara build-tool (FSL) | 2 |
| Egen kod (UNLICENSED) | 1 |

## Licensöversikt

| Licens | Antal | Kommersiellt OK |
|--------|-------|-----------------|
| MIT | 349 | Ja |
| Apache-2.0 | 64 | Ja |
| ISC | 33 | Ja |
| BSD-3-Clause | 4 | Ja |
| BSD-2-Clause | 4 | Ja |
| BlueOak-1.0.0 | 3 | Ja |
| 0BSD | 1 | Ja |
| MIT AND ISC | 1 | Ja |
| (MIT OR CC0-1.0) | 1 | Ja |
| CC-BY-4.0 | 1 | Ja (med attribution) |
| Hippocratic-2.1 | 2 | Se nedan |
| FSL-1.1-MIT | 2 | Ja (bara CLI-verktyg) |
| LGPL-3.0-or-later | 1 | Ja (med villkor) |
| UNLICENSED | 1 | Egen kod (equinet) |

## Flaggade paket

### react-leaflet + @react-leaflet/core (Hippocratic-2.1)

**Paket:** `react-leaflet@4.2.1`, `@react-leaflet/core@2.1.0`
**Används i:** `src/components/RouteMapVisualization.tsx`, `src/app/layout.tsx` (CSS-import)
**Feature flag:** `route_planning` (default on, men kräver Mapbox-token som saknas)

**Risk: MEDEL.** Hippocratic-licensen är inte OSI-godkänd. Den förbjuder användning som "skadar andra" (bred formulering). Vissa jurister avråder från kommersiell användning pga juridisk osäkerhet.

**Status idag:** Ruttplanering fungerar inte utan Mapbox-token. Komponenten laddas men visar tom karta. Leaflet-CSS importeras i layout.tsx (laddas alltid).

**Åtgärd:**
1. **Inför lansering:** Flytta leaflet CSS-importen till RouteMapVisualization (lazy-load). Ingen risk om komponenten aldrig renderas.
2. **Vid ruttplanering-lansering:** Byt till Mapbox GL JS (BSD-licens) enligt plan i backloggen. Ta bort react-leaflet helt.

### @img/sharp-libvips (LGPL-3.0-or-later)

**Paket:** `@img/sharp-libvips-darwin-arm64@1.2.4`
**Används av:** Next.js bildoptimering (automatisk dependency)

**Risk: LÅG.** LGPL tillåter kommersiell användning utan att din kod behöver vara open source, så länge du inte modifierar biblioteket. sharp är en server-side dependency som körs på Vercel -- den distribueras aldrig till slutanvändare.

**Åtgärd:** Ingen. Standard Next.js-dependency.

### @sentry/cli (FSL-1.1-MIT)

**Paket:** `@sentry/cli@2.58.4`, `@sentry/cli-darwin@2.58.4`
**Används:** Bara i build/CI för source map-upload.

**Risk: INGEN.** FSL (Functional Source License) konverterar till MIT efter 2 år. CLI:t används aldrig i runtime -- bara vid build. Distribueras inte till användare.

**Åtgärd:** Ingen.

### equinet (UNLICENSED)

**Paket:** `equinet@0.2.0`
**Status:** Korrekt. `"license": "UNLICENSED"` i package.json signalerar proprietär kod.

**Åtgärd:** Ingen. Behåll UNLICENSED.

## Rekommendationer

### Före lansering

- [ ] Flytta `import "leaflet/dist/leaflet.css"` från `layout.tsx` till `RouteMapVisualization.tsx` (eliminerar leaflet-CSS för alla som inte använder ruttplanering)

### Vid ruttplanering-lansering

- [ ] Byt react-leaflet till Mapbox GL JS (BSD-licens)
- [ ] Ta bort react-leaflet och leaflet från dependencies
- [ ] Kör `npx license-checker --production` igen och verifiera

### Löpande

- [ ] Kör `npx license-checker --production --summary` vid varje major dependency-uppgradering
- [ ] Överväg att lägga till license-check i CI (GitHub Action)

---

*Nästa granskning: vid nästa major dependency-ändring eller inför App Store-publicering.*
