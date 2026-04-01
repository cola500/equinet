---
title: "S6-1: BDD integrationstest-audit -- Done"
description: "72 nya integrationstester för auth, booking, group-bookings och reviews"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lärdomar
---

# S6-1: BDD integrationstest-audit -- Done

## Acceptanskriterier

- [x] Inventering klar med klassificering per route (161 filer, 62% integration, 38% unit-only)
- [x] Minst 5 nya integrationstester för kärndomäner (7 nya filer, 72 tester)
- [x] Testing.md uppdaterad med tydlig BDD dual-loop-guide
- [x] `npm run check:all` passerar (3866 tester, 0 errors)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (N/A -- bara testfiler)
- [x] Tester skrivna och gröna (72 nya, alla gröna)
- [x] Docs uppdaterade (.claude/rules/testing.md)

## Nya integrationstestfiler

| Fil | Tester | Domän |
|-----|--------|-------|
| auth/register/route.integration.test.ts | 7 | Auth |
| auth/native-login/route.integration.test.ts | 12 | Auth |
| auth/forgot-password/route.integration.test.ts | 5 | Auth |
| auth/reset-password/route.integration.test.ts | 7 | Auth |
| bookings/[id]/route.integration.test.ts | 19 | Booking |
| group-bookings/route.integration.test.ts | 8 | GroupBooking |
| reviews/route.integration.test.ts | 14 | Review |

## Avvikelser

- Planen nämnde 5-8 nya filer -- levererade 7 (inom scope).
- `bookings/[id]/payment` hade redan en integration-test, utökades inte (den var redan bra).

## Lärdomar

1. **Class mock obligatoriskt för repositories i Vitest**: `vi.fn().mockImplementation(() => obj)` fungerar INTE för `new`-anrop. Använd `class MockX { method = mockObj.method }` i vi.mock-factory. Dokumenterat i testing.md.
2. **Alla repository-metoder måste finnas i class mock**: Även om testet bara använder 2 metoder behöver mocken alla metoder från interfacet -- annars kastar den riktiga servicen `undefined is not a function`.
3. **Auth-domänen hade störst gap**: 9/10 filer var unit-only. Nu har 5/10 integrationstester (register, native-login, forgot-password, reset-password, accept-invite).
4. **Integration test = route -> service -> repository**: Mocka bara DB + extern I/O. Låt domain services köra riktigt. Fångar buggar i service-logik som unit-tester missar.
