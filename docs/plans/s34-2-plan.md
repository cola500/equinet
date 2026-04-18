---
title: "S34-2: Bokningsdetalj -- kontakter och knappar"
description: "Fixa 4 UX-fynd i NativeBookingDetailView: kontaktinfo klickbar/44pt, knappar 44pt"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Filer
  - Fynd och fix
  - Approach
  - Risker
---

# S34-2: Plan

## Aktualitet verifierad

**Kommandon körda:** Läste NativeBookingDetailView.swift.
**Resultat:** M-04: e-post visas som Text utan mailto-link och utan minHeight:44. Telefon har tel:-link men saknar minHeight:44. M-05: "Uteblev" och "Avboka" saknar .controlSize(.large). m-05: hästknapp är Text (blå) utan ikon och utan minHeight:44.
**Beslut:** Fortsätt

## Filer

- `ios/Equinet/Equinet/NativeBookingDetailView.swift` (enda fil)

## Fynd och fix

| ID | Problem | Fix |
|----|---------|-----|
| M-04 | E-post ~19pt, ej klickbar | `Link(destination: URL("mailto:..."))` + `frame(minHeight: 44)` på both tel och email |
| M-05 | "Uteblev"/"Avboka" 34pt | `.controlSize(.large)` + `role: .destructive` på Avboka |
| m-05 | Hästnamn-knapp saknar visuell affordance | `Label(horseName, systemImage: "pawprint.fill")` + `frame(minHeight: 44)` |

## Approach

1. UI-only -- inga ändringar i BookingsViewModel eller tester
2. customerSection: wrap email i Link(mailto:) + lägg minHeight:44 på phoneLink
3. confirmedActions: lägg .controlSize(.large) på Uteblev/Avboka, lägg role:.destructive på Avboka
4. horseSection: konvertera Text till Label med pawprint-ikon + minHeight:44
5. Verifiera med BookingDetailViewModelTests (obs: ingen separat ViewModelTest -- BookingsViewModelTests)

## Risker

- mailto: URL måste URL-encoda email-adressen. `URL(string: "mailto:\(email)")` fungerar för standard emails men kan krascha vid specialtecken. Wrappa i guard.
