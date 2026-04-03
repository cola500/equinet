---
title: "S12-2 Done: Migrera booking routes till dual-auth"
description: "Alla booking API routes migrerade fran auth() till getAuthUser()"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Laerdomar
---

# S12-2 Done: Migrera booking routes till dual-auth

## Acceptanskriterier

- [x] `/api/bookings` GET och POST migrerade till `getAuthUser()`
- [x] `/api/bookings/[id]` PUT och DELETE migrerade
- [x] `/api/bookings/[id]/payment` GET och POST migrerade
- [x] `/api/bookings/manual` POST migrerad
- [x] Alla befintliga tester uppdaterade och grona
- [x] Integrationstester uppdaterade och grona

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (validering, error handling, ingen XSS/SQL injection)
- [x] Tester skrivna och grona (3986 totalt, 4/4 quality gates)
- [x] Feature branch, alla tester grona

## Reviews

Kordes: code-reviewer (enda relevanta -- mekanisk migrering, ingen ny sakerhet/UI)

## Avvikelser

- Integrationstester (2 filer) behevde ocksa uppdateras -- inte planerat men upptacktes vid slutverifiering.
- PUT i `[id]/route.ts` hade manuell dual-auth (Bearer + session) som forenklades till ett enda `getAuthUser()`-anrop. Nettoreduktion -98 rader.

## Laerdomar

- **Integrationstester glomda i planen**: Planen listade bara unit-testfiler men det fanns 2 integrationstester som ocksa mockade `auth()`. Kontrollera ALLTID med `grep` efter den gamla importen i hela katalogen.
- **Mekanisk migrering ar snabb**: 7 handlers + 6 testfiler pa under 15 minuter. Monster bevisat i S11-4 betalade sig.
- **requireAuth wrapper-borttagning**: `requireAuth(auth())` kastade Response vid null. `getAuthUser()` returnerar null istallet -- renare kontrollflode utan exceptions.
