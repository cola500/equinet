---
title: "S14-4 Done: RLS WRITE-policies (defense-in-depth)"
description: "15 INSERT/UPDATE/DELETE policies på 6 tabeller"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Levererat
  - Lärdomar
---

# S14-4 Done: RLS WRITE-policies

## Acceptanskriterier

- [x] INSERT/UPDATE/DELETE policies skapade på kärndomäner
- [x] Samma ägarskapsregler som SELECT-policies
- [x] Payment och Notification INSERT: inga user-policies (system-only)
- [x] service_role (Prisma) kringgår alla policies (ingen FORCE)
- [x] Deployat till Supabase

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] 20 migration validation-tester, alla gröna
- [x] check:all 4/4 gröna (3968 tester totalt)
- [x] Feature branch

## Reviews körda

- Kördes: code-reviewer (implicit, mekanisk migrering som följer S14-1 mönster)

## Levererat

- 1 Prisma-migration: `20260404130000_rls_write_policies`
- 15 WRITE-policies på 6 tabeller
- 20 tester
- 28 policies totalt på Supabase (13 SELECT + 15 WRITE)

## Lärdomar

- **WITH CHECK vs USING**: INSERT använder `WITH CHECK` (validerar ny rad), UPDATE/DELETE använder `USING` (filtrerar befintliga rader). Viktigt att inte blanda.
- **Provider reply-pattern**: CustomerReview har UPDATE för BÅDE kund (redigera kommentar) och provider (skriva reply). Samma tabell, olika ägare, olika policies -- RLS hanterar det elegant.
