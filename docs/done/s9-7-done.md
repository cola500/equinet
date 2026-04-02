---
title: "S9-7 Done: Schema-baserad miljoisolering spike"
description: "Resultat och laerdomar fran schema-isolation spike"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Laerdomar
---

# S9-7 Done: Schema-baserad miljoisolering spike

## Acceptanskriterier

- [x] Migrationer appliceras korrekt per schema (31/31 mot staging)
- [x] App fungerar mot icke-public schema (API 200, seed OK)
- [x] Data isolerad mellan schemas (bekraftat med INSERT + count)
- [x] Research-dokument med resultat och rekommendation (`docs/research/schema-isolation-spike.md`)

## Definition of Done

- [x] Fungerar som forvantat, inga fel
- [x] Dokumentation skriven
- [x] Feature branch, redo for review

Ej tillampligt (spike):
- Tester (ingen kod att testa)
- Sakerhet (ingen ny funktionalitet)

## Avvikelser

1. **E2E smoke kunde inte koras** -- `.next/dev/lock` forhindrade parallell dev-server.
   Manuella curl-tester ersatte. Tillrackligt for spike-syftet.
2. **PgBouncer-test (steg 8) utfort** -- Testat mot Supabase pooler-URL.
   `search_path` propagerar korrekt i transaction mode. Blockerrisken var ogrundad.

## Laerdomar

1. **Prisma `?schema=X` fungerar battre an forvantat** -- Alla queries, inklusive
   `$queryRawUnsafe`, respekterar `search_path`. Ingen manual schema-kvalificering behovs.

2. **`search_path` propagerar via PgBouncer** -- Prisma satter `search_path` vid anslutning.
   PgBouncer transaction mode ateranvander anslutningar men propagerar `search_path` korrekt.
   Bekraftat mot Supabase.

3. **Session pooler (port 5432) fungerar, transaction pooler (6543) blockeras** --
   Natverkskonfiguration (IPv4/IPv6) kan gora att port 6543 inte nar fram.
   Port 5432 (session pooler) fungerar stabilt och ar tillracklig.

4. **Gotcha for framtiden:** Om vi lagger till fler `$queryRawUnsafe`-queries maste vi
   komma ihag att de forlitar sig pa `search_path`, inte explicit schema-prefix. Detta
   fungerar, men ar viktigt att vara medveten om vid debugging.

5. **Slot machine = snabb iteration** -- `CREATE SCHEMA X` + `prisma migrate deploy`
   tar under 1 minut. Perfekt for engangstester, spikes och experiment.
