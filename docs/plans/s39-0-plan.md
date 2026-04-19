---
title: "Plan S39-0: ProviderNav ↔ NativeMoreView sync-gate"
description: "Utöka check-docs-updated.sh med varning vid ProviderNav-ändring utan NativeMoreView-synk"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# Plan S39-0: ProviderNav ↔ NativeMoreView sync-gate

## Aktualitet verifierad

**Kommandon körda:**
- `grep -n "messaging" src/components/layout/ProviderNav.tsx` → rad 49 och 71 har messaging
- `grep -n "message\|Message" ios/Equinet/Equinet/NativeMoreView.swift` → rad 38 har messaging
- Bekräftat: båda är synkade (post S38-2 fix). Problemet är LÖST men gaten för att FÖRHINDRA att det händer igen är fortfarande saknad.

**Resultat:** Gate finns inte. Implementera.

**Beslut:** Fortsätt — gate behövs som förebyggande check.

## Approach

Lägg till ny check-sektion i `scripts/check-docs-updated.sh` som varnar (inte blockerar) när:
- `src/components/layout/ProviderNav.tsx` är staged
- `ios/Equinet/Equinet/NativeMoreView.swift` INTE är staged

Varning (inte exit 1) — rättvisare att varna vid interna badge/styling-ändringar som inte kräver iOS-synk.

Dokumentera i `.claude/rules/parallel-sessions.md` under "Delade filer"-sektionen.

## Filer som ändras

1. `scripts/check-docs-updated.sh` — ny sync-check-sektion
2. `.claude/rules/parallel-sessions.md` — not om ProviderNav/NativeMoreView-koppling

## Risker

- Inga (varning, inte blockerar — ingen risk för false positive som stoppar arbete)
