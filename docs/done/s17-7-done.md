---
title: "S17-7 Done: Byt lokal dev till supabase start"
description: "Lokal utvecklingsmiljo bytt fran Docker PostgreSQL till supabase start"
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

# S17-7 Done: Byt lokal dev till supabase start

## Acceptanskriterier

- [x] `npm run db:up` startar lokal Supabase (auth + DB + triggers)
- [x] `npm run db:down` stoppar lokal Supabase
- [x] `npm run db:nuke` aterstaller databasen (kor om migrationer)
- [x] Prisma-migrationer appliceras mot lokal Supabase utan fel (40 st)
- [x] custom_access_token_hook fungerar lokalt
- [x] handle_new_user trigger finns lokalt
- [x] 36 RLS-policies aktiva lokalt
- [x] Seed-scripts fungerar
- [x] README uppdaterad med nya instruktioner
- [x] Docker Compose behalles som dokumenterad fallback (db:up:docker)
- [x] Inga CI-forandringar kravs
- [x] `npm run db:status` visar Supabase-status

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (inga lakkta secrets -- Supabase demo-nycklar ar publikt kanda)
- [x] Unit tests grona (3964 passed, 4/4 quality gates)
- [x] Docs uppdaterade (README, .env.example, gotchas, docker-compose.yml)

## Reviews

- Kordes: tech-architect (plan), code-reviewer (kod)
- tech-architect: 1 blocker (DIRECT_DATABASE_URL saknas i plan) + 1 risk (hookfunktion). Bada hanterade.
- code-reviewer: 1 major (fragil localhost-guard), fixad. 3 minor (svenska tecken, namnerings-gap, semantik). Svenska tecken fixad.

## Avvikelser

- **prisma migrate dev fungerar inte**: Shadow DB saknar auth-schema. Losning: `prisma migrate deploy` for applicering, `prisma migrate diff` for generering. Dokumenterat som Gotcha #36.
- **RLS-bevistester skippas lokalt**: Testanvandare finns bara pa remote Supabase. Guard uppdaterad att detektera lokal miljo.
- **Gotcha-numrering**: #32-35 saknas i sections-listan (de ar definierade langre ner i filen fran andra branches).

## Lardomar

1. **prisma migrate dev vs deploy**: `migrate dev` skapar shadow DB som saknar Supabase-specifika scheman (auth, extensions). `migrate deploy` kor SQL direkt och fungerar. For lokal Supabase: alltid `deploy`.
2. **`.env.local` trumfar `.env`**: Maste uppdatera BADA filer vid DB-byte. `.env.local` skapas av Vercel CLI och kan peka pa produktions-Supabase.
3. **supabase status -o env**: Ger traditionella JWT-nycklar (anon, service_role) i env-format. Nyare CLI visar annars `sb_publishable_`/`sb_secret_` format i vanlig output.
4. **Lokala Supabase-nycklar ar standardiserade**: Samma demo-nycklar for alla lokala instanser. Publikt kanda, sakerhetsmassigt OK att ha i .env.example.
