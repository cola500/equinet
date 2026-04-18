---
title: "S38-0: iOS messaging audit via mobile-mcp"
description: "Plan för systematisk audit av messaging i iOS-WebView"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet
  - Approach
  - Steg
  - Risker
---

# S38-0: iOS messaging audit via mobile-mcp

## Aktualitet verifierad

**Kommandon körda:** `grep -n "messaging" src/lib/feature-flag-definitions.ts`
**Resultat:** `messaging: defaultEnabled: true` — bekräftat post-S37-rollout. Ingen fix-story har tagit bort flaggan.
**Beslut:** Fortsätt

## Aktualitet

- `messaging: defaultEnabled: true` bekräftat i `feature-flag-definitions.ts` (post-S37)
- Ingen kodändring förväntad — ren audit
- Domän: ios (mobile-mcp)

## Approach

Följer S33-1 (iOS UX-audit) och S36-2 (messaging webb-audit). Systematisk genomgång av 10 audit-punkter med mobile-mcp screenshots och accessibility tree. Utdata: rapport med rekommendation om native-port.

## Steg

1. **Setup**: Bygg iOS-appen (om nödvändigt), starta Simulator, logga in som provider@example.com, skapa testdata (bokning + meddelande)
2. **Audit 10 punkter** (se sprint-38.md):
   - TabBar-inkorg (laddning, skeleton, flash)
   - Tråd-navigering + skrivfält
   - Tangentbord (iOS-keyboard dyker upp, kan skicka)
   - VoiceTextarea (diktering i WebView)
   - Push-notifiering (manuellt trigger i dev)
   - Push deep-link → tråd
   - Offline-läsning (airplane mode)
   - Keyboard-hantering (scroll vid keyboard-öppning)
   - Haptic vid skicka
   - Svenska tecken (å/ä/ö)
3. **Sammanställ rapport**: `docs/retrospectives/<datum>-ios-messaging-audit.md`
4. **Beslut**: Rekommendation om native-port + S38-2+ stories

## Risker

- Push-notifiering kräver enhet eller TestFlight för fullständig test — notera som begränsning i rapporten
- Haptic feedback verifierbar bara på riktig enhet — notera
- mobile-mcp kan behöva UDID för aktuell simulator
