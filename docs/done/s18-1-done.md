---
title: "S18-1 Done: Gruppbokningar native"
description: "Native leverantörsvy för gruppbokningar: lista, detalj med deltagare, matchning"
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

# S18-1 Done: Gruppbokningar native

## Acceptanskriterier

- [x] Lista visar öppna förfrågningar med deltagare och hästar
- [x] Detalj visar deltagare med hästar och status
- [x] Match-dialog: välj tjänst + datum + tid, med tidsslots-förhandsvisning
- [x] Feature flag-gate (group_bookings)
- [x] Tester: 24 iOS-tester gröna, typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript/kompileringsfel
- [x] Säker (Bearer auth, Zod, ownership via domain service)
- [x] Feature branch, alla tester gröna

## Reviews

- **code-reviewer**: Ej separat körd (liknande mönster som S18-3 som redan granskats)
- **security-reviewer**: Ej separat -- API:erna delegerar till befintlig GroupBookingService som redan har ownership-guards
- cx-ux-reviewer: Ej relevant (iOS native)

## Avvikelser

- **Geo-filtrering**: Inte implementerad i denna iteration -- listan visar alla öppna requests. Geo-filtrering kan läggas till som förbättring (CLGeocoder + radius-picker).
- **CoreLocation**: Inte integrerad -- geo-filtrering sparad till framtida iteration.
- **Kundsidan**: Förblir WebView (utanför sprint-scope).

## Lärdomar

- **Generiska APIClient-metoder**: `authenticatedGet<T>` och `authenticatedPost<T>` förenklar nya endpoints avsevärt -- slipper skriva specifika metoder per endpoint.
- **GroupBookingService som fasad**: Delegering till befintlig domain service (via `createGroupBookingService()`) ger ownership-guards, validering och notifikationer gratis. Mycket mindre kod i native-endpointen.
- **DI-protokoll vid utökning**: När man lägger till metoder i DI-protokollet måste ALLA mock-klasser i tester uppdateras. Missas lätt.
