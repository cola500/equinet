---
title: "Done S39-0: ProviderNav ↔ NativeMoreView sync-gate"
description: "Pre-commit varning när ProviderNav.tsx ändras utan NativeMoreView.swift"
category: plan
status: archived
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# Done S39-0: ProviderNav ↔ NativeMoreView sync-gate

## Acceptanskriterier

- [x] Hook varnar vid ProviderNav utan NativeMoreView-ändring
- [x] Hook varnar INTE vid bara NativeMoreView-ändring
- [x] Hook varnar INTE vid ändring av båda
- [x] Manuell test genomförd (alla 3 scenarion testade)
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (script-ändring, ingen säkerhetspåverkan)
- [x] `check:all` grön
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: ingen (trivial story — script-tillägg utan ny logik, <45 min, check:all grön)

## Docs uppdaterade

Uppdaterade: `.claude/rules/parallel-sessions.md` (nav-sync-koppling not tillagd)

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Lärdomar

Check-scriptet är enkelt att utöka med varningsblock. Varning (inte exit 1) är rätt val för sync-gate — det finns legitima ProviderNav-ändringar (badge, styling) som inte kräver NativeMoreView-synk.
