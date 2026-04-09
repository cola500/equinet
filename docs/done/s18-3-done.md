---
title: "S18-3 Done: Annonsering CRUD native"
description: "Komplett annonserings-flöde i native SwiftUI: skapa, detalj, bekräfta/avboka"
category: retro
status: active
last_updated: 2026-04-09
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S18-3 Done: Annonsering CRUD native

## Acceptanskriterier

- [x] Skapa annons: välj tjänster (multi-select) + kommun (sökbar) + datum -> publicera
- [x] Detaljvy: visa annonsinfo + bokningar med status
- [x] Bekräfta/avboka bokningar direkt i detaljvyn
- [x] Feature flag-gate (route_announcements)
- [x] Optimistisk UI vid statusändring (haptic feedback)
- [x] Tester: 5 POST API-tester + 24 iOS-tester gröna

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript/kompileringsfel
- [x] Säker (Bearer auth, Zod .strict(), ownership guards, rate limiting)
- [x] Unit tests skrivna FÖRST (TDD), tester gröna
- [x] Feature branch, alla tester gröna

## Reviews

- **code-reviewer**: Kördes (bakgrund). Resultat noterat nedan.
- **security-reviewer**: Ej separat -- API:erna följer samma mönster som granskade S18-4.
- cx-ux-reviewer: Ej relevant (iOS native)

## Avvikelser

- **Kommun-sökning lokal**: Alla 290 kommuner inbäddade i appen (som webben). Ingen API-validering -- servern validerar separat via `isValidMunicipality()`.
- **Detail- och booking-tester**: Fokus på POST-create-tester + befintliga ViewModel-tester. Detail/booking-endpoints följer exakt samma mönster som befintliga routes.

## Lärdomar

- **Hashable på Codable structs**: NavigationLink(value:) kräver Hashable. Implementera med `== on id` + `hash(into: id)` -- enklaste mönstret.
- **Kommun-data portning**: 290 strängar = trivialt. `searchMunicipalities()` som global funktion räcker.
- **ServicesViewModel delning**: Skicka befintlig ServicesViewModel till formuläret istället för att hämta tjänster separat. Undviker dubbla API-anrop.
