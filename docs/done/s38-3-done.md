---
title: "S38-3 Done: Messaging-knapp i native bokningsdetalj"
description: "Acceptanskriterier och Definition of Done för S38-3"
category: guide
status: active
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

# S38-3 Done: Messaging-knapp i native bokningsdetalj

## Acceptanskriterier

- [x] "Meddelanden"-knapp visas i NativeBookingDetailView när `featureFlags["messaging"] == true`
- [x] Knappen döljs för cancelled/no_show (hanteras via `generalActions` som inte anropar `messagingButton`)
- [x] Knapp navigerar till `/provider/messages/{bookingId}` via `onNavigateToWeb`-callback
- [x] Knappen visas för pending, confirmed och completed bokningar
- [x] `featureFlags` prop-drillas korrekt: AppCoordinator → AuthenticatedView → NativeBookingsView → NativeBookingDetailView
- [x] Visuellt verifierad i iOS Simulator: knappen syns i bokningsdetaljen under "Lägg till anteckning"

## Definition of Done

- [x] Inga TypeScript/kompileringsfel — BUILD SUCCEEDED verifierat
- [x] Säker (ingen ny API-yta, ingen auth-påverkan, feature-flag-gated)
- [x] Inga nya tester behövs (trivial UI-ändring, feature-flag-gated, ingen ny logik)
- [x] Visuell verifiering med mobile-mcp — knappen bekräftad i simulator

## Reviews körda

- code-reviewer: Kördes. Inga blockerare. Suggestions: (1) kommentar i default-gren för cancelled/no_show-exkludering, (2) `var` vs `let` featureFlags-inkonsistens mellan NativeProfileView och de nya filerna. Inget blockerar merge.
- security-reviewer: Kördes ej (ingen API-yta, ingen auth-påverkan)
- cx-ux-reviewer: Kördes ej (trivial UI-tillägg, visuellt verifierad med mobile-mcp)
- ios-expert: Kördes ej (trivial prop drilling + @ViewBuilder, korrekt mönster bekräftat av code-reviewer)

## Docs uppdaterade

Ingen docs-uppdatering (intern iOS UI-ändring, ingen ny feature som slutanvändaren möter utöver att knappen nu är tillgänglig — feature-flaggen `messaging` var redan dokumenterad i S38-1).

## Verktyg använda

- Läste patterns.md vid planering: nej (välkänt prop-drilling-mönster, inget nytt)
- Kollade code-map.md för att hitta filer: nej (filerna kända sedan tidigare sessioner)
- Hittade matchande pattern: "iOS Feature Flag-mönster" (prop drilling av featureFlags) — befintligt mönster

## Arkitekturcoverage

Designdokument: `docs/plans/s38-3-plan.md`
Alla beslut implementerade: ja
- Prop drilling AppCoordinator → AuthenticatedView → NativeBookingsView → NativeBookingDetailView: ✓
- messagingButton dold för cancelled/no_show: ✓
- URL-mönster `/provider/messages/{bookingId}`: ✓
- Placering sist i actionsSection efter noteButton: ✓

## Modell

sonnet

## Lärdomar

- **Swift trailing closure + extra parameter**: Om struct-definitionen har en optional closure-parameter (t.ex. `onNavigateToWeb`) följt av ytterligare parametrar (`featureFlags`), kan man INTE använda trailing closure-syntax och skicka den extra parametern — Swift kräver att trailing closure är sist. Lösning: använd explicit label (`onNavigateToWeb: { ... }, featureFlags: ...`). Alternativ: lägg `featureFlags` FÖRE closure-parametern i struct-definitionen.
- **SDK/runtime-mismatch vid Xcode-uppgradering**: Xcode 26.4.1 (SDK 23E252) kräver iOS 26.4.1 runtime. Äldre runtime (26.4.0, 23E244) visas inte som eligible destination. Fix: `xcodebuild -downloadPlatform iOS`.
- **"exit code 0" från bakgrundsbygge ≠ BUILD SUCCEEDED**: Verifiera alltid via `grep "BUILD SUCCEEDED"` i output-filen.
