---
title: "S17-4 Done: pg_cron for databasunderhall"
description: "3 pg_cron-jobb for token-rensning och notifikationsrensning"
category: retro
status: active
last_updated: 2026-04-05
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S17-4 Done: pg_cron for databasunderhall

## Acceptanskriterier

- [x] pg_cron aktiverat (CREATE EXTENSION i migration)
- [x] Jobb 1: Rensa utgangna tokens dagligen (6 tabeller, 30 dagars grace)
- [x] Jobb 2: Rensa NotificationDelivery > 90 dagar (veckovis)
- [x] Jobb 3: Rensa lasta notifikationer > 365 dagar (veckovis)
- [x] Dokumenterat i docs/operations/deployment.md
- [x] Testat lokalt: 3 jobb registrerade i cron.job
- [x] Migration applicerad pa Supabase prod (2026-04-05): `supabase db query --linked`
- [x] Verifierat: 3 jobb aktiva i `cron.job` pa prod (jobid 1-3)
- [x] Registrerad i `_prisma_migrations` pa prod

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (ren SQL, inga user inputs, grace period)
- [x] Tester: N/A (ren SQL-migration, verifierad lokalt via psql)
- [x] Docs uppdaterade (deployment.md, plan)

## Reviews

- Kordes: tech-architect (plan-review), code-reviewer (kod-review)
- tech-architect: bort med VACUUM ANALYZE (Supabase autovacuum), använd cron.schedule() + DO-block
- code-reviewer: 0 blockers, 0 majors, 3 minors (kommentar pa MobileToken OR-logik fixad)

## Avvikelser

- **Rate limit-rensning borttagen**: Sprint-beskrivningen namnde "rensa rate limit-poster" men rate limiting använder Upstash Redis (ephemeral) -- ingen DB-tabell att rensa.
- **VACUUM ANALYZE borttagen**: Supabase kor autovacuum -- manuell VACUUM fungerar inte via pg_cron pa managed instances.
- **Lagt till token-rensning**: 6 token-tabeller med expiresAt rensas istallet -- storre varde an rate limit-rensning.
- **Lagt till notifikationsrensning**: Lasta notifikationer > 365 dagar -- inte i sprint-beskrivningen men naturligt komplement.

## Lardomar

- pg_cron pa Supabase kraver `cron.schedule()` med dollar-quoted strings, inte ratt DDL.
- VACUUM ANALYZE fungerar inte manuellt pa managed Supabase -- autovacuum hanterar det.
- DO-block (`DO $body$ BEGIN ... END $body$`) for att batcha flera DELETE i ett pg_cron-jobb.
- Lokal testning med `supabase start` + `docker exec supabase_db_equinet psql` fungerar bra for SQL-migrationer.
- `supabase db push` applicerar bara migrationer i `supabase/migrations/`, INTE `prisma/migrations/`. For Prisma-migrationer med raw SQL: använd `supabase db query --linked` + manuell INSERT i `_prisma_migrations`.
- `supabase link --project-ref <ref>` kravs innan `--linked`-kommandon fungerar. Lankas till `zzdamokfeenencuggjjp` (slot machine / prod).
