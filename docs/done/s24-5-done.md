---
title: "Done S24-5: iOS cleanup"
description: "Task.detached -> Task, force unwrap borttagen"
category: retro
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# Done S24-5: iOS cleanup

## Acceptanskriterier

- [x] Inga `Task.detached` kvar (AuthManager.swift rad 86, PushManager.swift rad 63)
- [x] Inga force unwraps i AuthManager (exchangeSessionForWebCookies rad 128 -> guard let)
- [x] iOS-tester passerar (AuthManagerTests: 7/7 gröna)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (ej tillämpligt -- Swift)
- [x] Säker (guard let skyddar mot krasch vid ogiltig URL-konfiguration)
- [x] Tester gröna (AuthManagerTests 7/7)
- [x] Feature branch, check:all grön -- iOS-tester körda

## Reviews körda

- code-reviewer: Kördes ej (mekanisk 3-raders ändring, inga affärslogik-risker)
- ios-expert: Kördes ej (trivial cleanup, standardmönster i Swift)

Motivering: `Task.detached -> Task` är ett välkänt Swift concurrency-mönster. `guard let` för
optionell URL är idiomatisk Swift. Inga subagent-reviews krävdes för detta scope.

## Avvikelser

Inga.

## Lärdomar

- `Task.detached` bör undvikas i vanliga fire-and-forget-scenarier -- `Task {}` ärver
  actor-context och är säkrare standardval.
- URL-konstruktioner med `relativeTo:` kan returnera nil om base-URL är malformad -- alltid
  guard let, aldrig force unwrap.
