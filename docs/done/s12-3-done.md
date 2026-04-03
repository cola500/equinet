---
title: "S12-3 Done: Migrera provider routes till dual-auth"
description: "withApiHandler migrerad fran auth() till getAuthUser() -- alla 30 routes far dual-auth"
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

# S12-3 Done: Migrera provider routes till dual-auth

## Acceptanskriterier

- [x] `/api/provider/profile` GET och PUT migrerade till dual-auth
- [x] `/api/provider/customers` GET och POST migrerade
- [x] `/api/provider/customers/[customerId]` PUT och DELETE migrerade
- [x] `/api/services` GET och POST migrerade
- [x] `/api/services/[id]` PUT och DELETE migrerade
- [x] Alla befintliga tester uppdaterade och grona (3989 totalt)
- [x] providerId garanterad non-null for provider-anvandare (403 vid null)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (validering, error handling, ingen XSS/SQL injection)
- [x] Tester skrivna och grona (3989 totalt, 4/4 quality gates)
- [x] 3 nya tester: providerId set, providerId null->403, Bearer auth
- [x] Feature branch, alla tester grona

## Reviews

Kordes: code-reviewer (enda relevanta -- mekanisk migrering, ingen ny sakerhet/UI)

## Avvikelser

- **Scope utokat fran 5 till 30 testfiler**: Planen listade 5 route-testfiler (S12-3 scope), men eftersom withApiHandler andrades paverkades ALLA 30 testfiler som mockar `@/lib/auth-server` via wrappern. Parallella agenter hanterade batcherna effektivt.
- **1 integrationstestfil missad**: `reviews/route.integration.test.ts` mockade `auth-server` men fanns inte i den initiala sokningen. Upptacktes vid `check:all`.
- **Inga route-filer andrade**: Hela migreringen skedde i `api-handler.ts` (1 fil). Route-filerna behover inte andras eftersom withApiHandler hanterar auth internt.

## Laerdomar

- **En wrapper-andring > 30 filredigeringar**: Att andtra `withApiHandler` internt istallet for varje route individuellt var ratt approach. S12-2 andrade varje route manuellt (routes anvande inte wrappern). S12-3s routes anvande alla wrappern, sa en enda andring racker.
- **Integrationstester ALLTID i scope**: Samma gotcha som S12-2 -- integrationstester som mockar auth missas i planeringen. Gor ALLTID `grep -r 'auth-server' --include='*.test.ts' --include='*.integration.test.ts'` for att hitta alla.
- **AuthUser -> SessionLike adapter**: Konverteringen ar enkel men MASTE testa providerId-invarianten explicit. `requireProvider` ger 403 "Leverantorsprofil saknas" vid null providerId, inte 401.
- **Parallella agenter for mekaniska andringar**: 3 parallella agenter hanterade 29 testfiler pa ~6 minuter. Filerna overlappar inte sa inga merge-konflikter.
