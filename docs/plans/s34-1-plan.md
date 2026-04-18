---
title: "S34-1: Profilvy -- tap-targets och bekräftelsedialog"
description: "Fixa 5 UX-fynd i NativeProfileView: tap-targets <44pt, saknad confirmationDialog, accessibility-labels, error-state"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Filer
  - Fynd och fix
  - Approach
  - Risker
---

# S34-1: Plan

## Aktualitet verifierad

**Kommandon körda:** Läste NativeProfileView.swift och grep:ade efter M-01/M-02/M-03-mönster.
**Resultat:** Alla 5 fynd bekräftade finnas i koden (PhotosPicker utan frame, Redigera-knappar utan frame, dangerZoneSection utan dialog, settingsTab utan error-branch, linkRow utan accessibilityLabel).
**Beslut:** Fortsätt

## Filer

- `ios/Equinet/Equinet/NativeProfileView.swift` (enda fil)

## Fynd och fix

| ID | Problem | Fix |
|----|---------|-----|
| M-01 | PhotosPicker "Byt bild" saknar minHeight: 44 | Lägg till `frame(minHeight: 44)` + systemImage-ikon |
| M-02 | "Redigera"-knappar i personalInfoSection/businessInfoSection ~18pt | `frame(minHeight: 44)` + `contentShape(Rectangle())` |
| M-03 | "Radera konto" navigerar direkt utan bekräftelse | Lägg till `@State private var showDeleteConfirmation = false` + `.confirmationDialog` |
| m-06 | settingsTab saknar error-state | Lägg till `else if let error = viewModel.error` gren med ErrorBanner |
| m-07 | linkRow saknar accessibilityLabel | Lägg till `.accessibilityLabel("\(title), öppnas i webbläsare")` |

## Approach

1. UI-only -- inga ändringar i ProfileViewModel eller tester
2. Implementera alla 5 fynd i en pass
3. Verifiera med ProfileViewModelTests (ska vara grön utan ändring)
4. Mobile-mcp-verifiering för visuell bekräftelse

## Risker

- `.confirmationDialog` är nytt mönster i native-koden. Använd SwiftUI's inbyggda `.confirmationDialog(titleVisibility:actions:)` modifier. Destruktiv knapp som öppnar WebView (radering sker server-side).
- settingsTab error-state: ProfileViewModel.error kan vara nil under loading. Kolla att loading-check fortfarande är rätt ordning.
