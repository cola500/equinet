---
title: "S7-1 Done -- Ownership Guards"
description: "Avslutningsdokument för ownership guards i repositories"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lärdomar
---

# S7-1 Done -- Ownership Guards

## Acceptanskriterier

- [x] `findByIdForProvider()` och `findByIdForCustomer()` finns i BookingRepository
- [x] Samma mönster i CustomerReview (`findByIdForProvider`) och Subscription (`updateWithAuth`, `deleteWithAuth`)
- [x] Routes migrerade: quick-note + voice-log/confirm använder `findByIdForProvider()`
- [x] ESLint-regel aktiv: `no-restricted-syntax` varnar vid `prisma.booking.findUnique/findFirst` i API routes
- [x] Alla tester gröna: 3876 pass (10 nya)
- [x] `npm run check:all` passerar (4/4 gröna)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (atomisk WHERE med ownership i alla nya metoder)
- [x] Unit-tester skrivna FÖRST (BDD dual-loop), integration + unit gröna
- [x] Feature branch, alla tester gröna

## Avvikelser

1. **Reviews/CustomerReviews routes inte migrerade.** Dessa injicerar `getBooking`-lambdor i domain services som redan gör ownership-check. Att ändra lambdan till ownership-scoped kräver ändring av domain service-interfacet -- en större refaktorering. Risken är låg (defense-in-depth via service).

2. **Horse/Service/Provider/Follow redan korrekta.** Ingen ändring behövdes -- de hade redan `findByIdForOwner()`/`findByIdForProvider()` eller composite key-access.

3. **Admin-routes triggar ESLint-warning.** Avsiktligt -- admin behöver cross-tenant access. Kan undantas med `// eslint-disable-next-line` vid behov.

## Lärdomar

1. **BDD dual-loop fungerade bra.** Yttre integrationstest (route returnerar 404 vid fel ownership) drev implementationen. Alla 3 yttre tester failade av rätt anledning i RED-steget.

2. **Mock-uppdateringar tar tid.** Quick-note-testet hade 10 `vi.mocked(prisma.booking.findUnique)` som alla behövde ändras. Enhetlig mock-strategi (repository-mocks istället för prisma-mocks) minskar denna kostnad.

3. **Befintligt skydd var bättre än väntat.** Analys av 83+ access-punkter visade att de flesta redan hade ownership-checks. De enda riktiga luckorna var `findById()` utan filter och 2 routes med manuell check.

4. **ESLint `no-restricted-syntax` fångar AST-mönster.** `MemberExpression[object.property.name='booking'][property.name='findUnique']` fungerar för att hitta `prisma.booking.findUnique` -- bra verktyg för att förhindra regression.
