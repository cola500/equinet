---
title: "S19-7: Lokal Supabase E2E bootstrap -- Done"
description: "seed.sql + bootstrap-script för E2E-redo lokal miljö"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-7: Lokal Supabase E2E bootstrap -- Done

## Acceptanskriterier

- [x] `supabase start` + `npm run test:e2e:bootstrap` = E2E-redo
- [x] Dokumenterat i README

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (trigger-SQL identisk med Prisma-migrationer)
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (infra/docs, ingen ny affärslogik)

## Lärdomar

- seed.sql körs vid `supabase db reset`, inte vid `supabase start`
- `prisma migrate deploy` är fortfarande den primära installationsvägen
- seed.sql fungerar som backup/dokumentation av vilka triggers som krävs
- Kommentar i seed.sql pekar på källmigrationerna för framtida synk
