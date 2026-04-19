---
title: "S45-1 Done: Sprint-avslut-gate"
description: "Pre-commit hook som varnar när ny story startas utan att föregående sprint är avslutad"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S45-1 Done: Sprint-avslut-gate

## Acceptanskriterier

- [x] Varnar när aktiv sprint alla done men retro saknas
- [x] Varnar INTE under pågående sprint (någon story pending/in_progress)
- [x] Varnar INTE när retro finns
- [x] Test mot S43→S44-scenariot — fångades korrekt

## Definition of Done

- [x] Inga TypeScript-fel (bash-script)
- [x] Säker (inga user-inputs interpoleras)
- [x] 4 manuella scenarietester körda och verifierade
- [x] Feature branch, check:all ej tillämpbar (bash-only)
- [x] Ingen slutanvändar-påverkan

## Reviews körda

Kördes: code-reviewer (se nedan)

## Docs uppdaterade

Ingen docs-uppdatering (intern process-infra).

## Verktyg använda

- Läste patterns.md: N/A (trivial)
- Kollade code-map.md: N/A
- Matchande pattern: nej

## Arkitekturcoverage

N/A

## Modell

sonnet

## Lärdomar

- `sed -i` på macOS kräver extension-argument, beter sig annorlunda än Linux. Använde python3 för testmanipulation av filer istället.
- Retro-filnamnsglobbning (`*sprint-45*.md`) är mer robust än exakt namnmatchning.
