---
title: "S11-1: Dual-auth helper -- Done"
description: "Resultat och lärdomar från dual-auth helper implementation"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lärdomar
---

# S11-1: Dual-auth helper -- Done

## Acceptanskriterier

- [x] `getAuthUser()` fungerar med alla tre auth-systemen (Bearer, NextAuth, Supabase)
- [x] Tester med mockad Supabase + NextAuth + Bearer
- [x] Befintliga routes oförändrade

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel (`npm run typecheck`)
- [x] Säker (DB-lookup för providerId, aldrig JWT claims)
- [x] Unit tests skrivna FÖRST (33 nya), coverage OK
- [x] Feature branch, alla tester gröna (3972 totalt, 4/4 quality gates)
- [x] Docs uppdaterade (plan, status.md)

## Avvikelser

- **Planen angav `stableId` på Provider-modellen** -- i verkligheten finns `stable` som
  separat relation på User (inte Provider). Fixades under implementation. Planen borde
  ha verifierat Prisma-schemat mer noggrant.
- **Extra fil skapad: `middleware-auth.ts`** -- planen nämnde bara ändring av middleware.ts,
  men refaktoreringen krävde att `handleAuthorization()` extraherades till en testbar modul.
  Detta är en förbättring -- middleware-logiken är nu testad (10 tester).

## Lärdomar

1. **Verifiera Prisma-schema innan plan-godkännande**: Planen antog `provider.stableId`
   men fältet finns på `User.stable.id`. Typecheck fångade det direkt, men det hade
   sparats tid att kolla schemat under planering.

2. **Middleware-refaktorering var värd det**: Att extrahera `handleAuthorization()` till
   en separat modul möjliggjorde 10 unit-tester för rollbaserad routing. Tidigare var
   middleware-logiken helt otestad.

3. **auth() från NextAuth kastar Response(401) vid null session**: Detta är oväntat
   beteende -- `auth()` kastar en Response-instans, inte ett vanligt Error. `getAuthUser()`
   hanterar detta med `catch` som kollar `instanceof Response`.
