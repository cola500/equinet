---
title: "S19-7: Lokal Supabase E2E bootstrap"
description: "Säkerställ att handle_new_user-trigger och custom_access_token_hook installeras korrekt lokalt"
category: plan
status: active
last_updated: 2026-04-10
sections:
  - Analys
  - Approach
  - Filer
  - Risker
---

# S19-7: Lokal Supabase E2E bootstrap

## Analys

- `handle_new_user` och `custom_access_token_hook` lever i Prisma-migrationer
- `supabase start` startar tom DB, `prisma migrate deploy` installerar triggers
- `config.toml` har redan `custom_access_token` hook aktiverad
- Det saknas en tydlig "ett kommando" bootstrap-upplevelse

Kedjan idag: `supabase start` -> `npm run setup` -> `npm run test:e2e`

## Approach

1. Skapa `supabase/seed.sql` med trigger + hook SQL (backup om prisma migrate missar)
2. Lägg till `npm run e2e:bootstrap` script: kontrollera supabase + kör setup
3. Dokumentera i README E2E-sektionen

## Filer

- **Skapa:** `supabase/seed.sql`
- **Ändra:** `package.json` (nytt script)
- **Ändra:** README.md (E2E-setup sektion)

## Risker

- seed.sql kan bli ur synk med Prisma-migrationer -- lägg till kommentar om källa
