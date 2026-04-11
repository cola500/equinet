---
title: "Retro: Sprint 19 -- Tech Lead-perspektiv"
description: "E2E hardening audit, process-gaps och sprint-leverans fran tech lead"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Levererat
  - Vad gick bra
  - Vad gick fel
  - Processinsikter
  - Till nasta sprint
---

# Retro: Sprint 19 -- Tech Lead-perspektiv

> Kompletterar devs retro i `2026-04-10-sprint-19.md`.

## Levererat

- 9 stories, 50 commits, 29 filer
- 64 `waitForTimeout` eliminerade (90 -> 26, 71% reducering)
- 2 specs borttagna (stripe-payment, flexible-booking: -484 rader)
- Externa beroenden separerade till egen svit
- Lokal Supabase E2E bootstrap (`supabase/seed.sql`)
- Netto: -675 rader borttagna, +1069 tillagda (docs + seed.sql)

## Vad gick bra

- **Dev levererade autonomt** -- 9 stories utan att behova stanna och fraga
- **Audit-driven sprint** -- vi analyserade innan vi fixade, sa vi visste exakt vad som var vart att gora
- **S19-9 tillagd mitt i sprint** -- flexibelt, dev plockade upp den direkt
- **Avtagande avkastning respekterades** -- vi jagade inte de sista 26 waitForTimeout (1-2 per fil)
- **Stationsflödet foljdes** -- plan, TDD, review, verify, merge per story

## Vad gick fel / var ovantat

- **Session 117 CSP-fix committades inte** -- `next.config.ts` andrades men tappades bort. Fick fixas igen. Lardom: verifiera alltid `git status` efter edit.
- **handle_new_user-trigger installerades inte av Prisma migrate** -- Prisma kan inte kora triggers mot `auth.users` (Supabase-agd tabell). Lostes med `supabase/seed.sql`.
- **Gammalt passwordHash i trigger** -- installerade fel version av triggern manuellt. DB-loggen avslojde felet direkt.
- **playwright.config.ts pekade pa gammal Docker-DB** -- sedan S17-7 (Supabase CLI) men ingen uppdaterade playwright-configen.

## Processinsikter

- **E2E-testerna var i battre skick an forvantat** -- 350 pass, 0 fail i baseline
- **waitForTimeout-jagandet gav reellt varde** -- explicit waits ar snabbare och stabilare
- **Stripe E2E var helt meningslos** -- 1 test, alltid skippat, borde tagits bort for lange sedan
- **flexible-booking var ren dubblering** -- borde aldrig skapats som separat spec
- **Process-audit avslojde gap** -- coverage-mal, repository pattern, Supabase .eq() saknar enforcement. Sprint 20 adresserar detta.

## Till nasta sprint

- Sprint 20 (process enforcement) ligger redo -- 6 stories, ~3-4h
- Kvarstaende 26 waitForTimeout ar acceptabla (1-2 per fil, avtagande avkastning)
- `supabase/seed.sql` loser E2E bootstrap lokalt -- dokumentera i onboarding
