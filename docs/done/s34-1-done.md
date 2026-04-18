---
title: "S34-1 Done: Profilvy -- tap-targets och bekräftelsedialog"
description: "5 UX-fynd åtgärdade i NativeProfileView (M-01, M-02, M-03, m-06, m-07)"
category: plan
status: archived
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Lärdomar
---

# S34-1 Done

## Acceptanskriterier

- [x] Alla 3 Major-fynd (M-01, M-02, M-03) åtgärdade
- [x] 2 Minor-fynd (m-06, m-07) åtgärdade
- [x] mobile-mcp-verifiering: tap-targets ≥ 44pt bekräftat (Byt bild=45pt, Redigera=45pt)
- [x] Radera konto triggar confirmationDialog före kall till API/WebView
- [x] `xcodebuild test -only-testing:EquinetTests/ProfileViewModelTests` grön (16/16)
- [x] cx-ux-reviewer godkänner (med förbättring: label/hint separerade)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (N/A -- iOS)
- [x] Säker (ingen API-yta ändrad, UI-only)
- [x] Tester skrivna FÖRST -- UI-only story, ProfileViewModelTests gröna utan ändringar
- [x] Feature branch, `xcodebuild build` grön, mergad via PR

## Reviews körda

- [x] code-reviewer: Inga blockers/majors. Minor: lägg kommentar om confirmationDialog-placering (fixat).
- [x] cx-ux-reviewer: Godkänd. Förbättring: separera `.accessibilityLabel`/`.accessibilityHint` (fixat). Lade även till `accessibilityHint` på availabilitySection.

## Docs uppdaterade

Ingen docs-uppdatering (intern iOS UI-polering, ingen användarvänd beteendeändring -- hjälpartiklar och testing-guide ej påverkade).

## Verktyg använda

- Läste patterns.md vid planering: nej (N/A -- iOS UI-fix)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern? Nej -- confirmationDialog är nytt mönster, dokumenterat i lärdomar

## Modell

claude-sonnet-4-6

## Lärdomar

- **`.confirmationDialog` placering**: Placera på root View (body), inte på den specifika sektion som triggar det. Annars kan modalen ha problem att visas korrekt om triggern är i en annan vy-hierarki (t.ex. List-cell i settingsTab).
- **accessibilityLabel vs accessibilityHint**: Apple-mönstret är att `.accessibilityLabel` namnger elementet, `.accessibilityHint` beskriver vad som händer vid aktivering. Baka INTE in beteendebeskrivning i label.
- **contentShape(Rectangle()) krävs för inline-knappar**: En `Button` i en `HStack` med `Spacer()` har bara tryckytan på sin label-yta, inte hela raden. `contentShape(Rectangle())` expanderar touch-target till hela ramen.
