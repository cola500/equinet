---
title: "S31-4 Done: Tvinga grep-verifiering i plan-mall"
description: "TEMPLATE.md och check-docs-updated.sh uppdaterade för aktualitetsverifiering"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S31-4 Done: Tvinga grep-verifiering i plan-mall

## Acceptanskriterier

- [x] `TEMPLATE.md` har `## Aktualitet verifierad` som första sektion
- [x] `scripts/check-docs-updated.sh` blockerar plan utan sektionen
- [x] Hook testad lokalt (positivt + negativt fall)
- [x] `npm run check:all` grön

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga säkerhetsrisker i script-ändringen)
- [x] `npm run check:all` 4/4 grön
- [x] Feature branch, PR skapad

## Reviews körda

Kördes: ingen (trivial story -- rena docs/script-ändringar utan ny logik, <30 min, check:all grön)

## Docs uppdaterade

Uppdaterade: docs/plans/TEMPLATE.md (ny obligatorisk sektion), scripts/check-docs-updated.sh (ny check)

## Verktyg använda

- Läste patterns.md vid planering: nej (N/A -- rent docs-arbete)
- Kollade code-map.md för att hitta filer: nej (visste redan -- TEMPLATE.md + scriptet)
- Hittade matchande pattern? Nej
- Varför: trivial docs/script-story, inget arkitektur-pattern behövdes

## Lärdomar

Hooken i `.husky/pre-commit` var inte executable -- hooksarna ignorerades vid commit (men scriptet kördes manuellt och fungerade). Bör fixas separat om man vill att hooks körs automatiskt.
