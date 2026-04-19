---
title: "S45-2 Done: Multi-commit-gate"
description: "Pre-push hook som varnar när feature branch har <2 commits över main"
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

# S45-2 Done: Multi-commit-gate

## Acceptanskriterier

- [x] Varnar när feature branch har <2 commits (testat: 1 commit → varning)
- [x] Varnar INTE för main-branch (mönster ^feature/ hoppar över main)
- [x] Push fortsätter oavsett (exit 0 bevaras alltid)
- [x] Test mot S43-1-scenariot (0 commits hela storyn) — fångas korrekt

## Definition of Done

- [x] Inga TypeScript-fel (bash-only ändring)
- [x] Säker (inga user-inputs interpoleras)
- [x] 3 manuella scenarietester körda
- [x] Feature branch, check:all ej tillämpbar (bash-only)
- [x] Ingen slutanvändar-påverkan

## Reviews körda

Kördes: code-reviewer

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

- `git rev-list --count main..HEAD` ger korrekt antal commits även när main inte är synkad med remote — räcker för lokalt användningsfall.
- Varningen triggar korrekt vid push av denna feature-branch (1 commit) — det är det avsedda beteendet.
