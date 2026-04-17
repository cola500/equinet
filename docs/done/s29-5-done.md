---
title: "S29-5 Done: iOS-learnings med mobile-mcp-mönster"
description: "Dokumenterade mobile-mcp, offline-testning och debug-mekanismer i ios-learnings.md"
category: retro
status: active
last_updated: 2026-04-17
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs
---

# S29-5 Done: iOS-learnings med mobile-mcp-mönster

## Acceptanskriterier

- [x] `.claude/rules/ios-learnings.md` utökad med mobile-mcp-sektion
- [x] Länkad från `docs/architecture/patterns.md` (2 rader i testning-sektionen)
- [x] Exempel-skript från S29-1 refererat

## Definition of Done

- [x] Inga TypeScript-fel (N/A -- docs-only)
- [x] Säker (N/A)
- [x] Tester (N/A -- docs-only)
- [x] Feature branch (N/A -- lifecycle-docs, direkt till main per commit-strategy.md)

## Reviews

Kördes: ingen (docs-story, inga subagenter behövs per review-matris).

## Docs

Uppdaterade:
- `.claude/rules/ios-learnings.md` -- 2 nya sektioner: "Mobile-mcp och simulator-verifiering" + "iOS offline-testning"
- `docs/architecture/patterns.md` -- 2 nya rader i testning-tabellen

## Innehåll (sammanfattning)

### Mobile-mcp-sektionen

- Beslutsmatris: när XCTest vs mobile-mcp vs shell-skript vs XCUITest
- Grundflöde (screenshot -> list elements -> click -> screenshot)
- 5 gotchas: WebDriverAgent timeout, SecureField osynligt, type_keys med \n, koordinat-beroende, parallella sessioner
- Debug-autologin dokumenterat (--debug-autologin launch argument)

### Offline-testsektionen

- Arkitektur-diagram: simctl defaults write -> UserDefaults -> NetworkMonitor poll -> override -> callbacks -> UI
- 3 testnivåer: XCTest (<1s), shell-skript (~20s), mobile-mcp (interaktiv)
- 4 fallgropar: cache-beroende fetch, clearDashboardCache, polling-overhead, CI-begränsning
