---
title: "S15-6 Done: PoC-projektet blir staging"
description: "Dokumenterat staging-miljo, separerat Vercel env per miljö"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lardomar
---

# S15-6 Done: PoC-projektet blir staging

## Acceptanskriterier

- [x] `docs/operations/environments.md` uppdaterad med staging-sektion
- [x] Vercel Preview env pekar pa PoC-projektet (zzdamokfeenencuggjjp)
- [x] Vercel Production env pekar pa prod (xybyzflfxnqqyxnvjklv)
- [x] `.env.example` uppdaterad (NextAuth borta, Supabase Auth primart)

## Vercel env-konfiguration

| Variabel | Production | Preview (staging) |
|----------|-----------|-------------------|
| NEXT_PUBLIC_SUPABASE_URL | xybyzflfxnqqyxnvjklv | zzdamokfeenencuggjjp |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | prod key | PoC key |
| SUPABASE_SERVICE_ROLE_KEY | prod key | PoC key |

## Definition of Done

- [x] Dokumentation uppdaterad
- [x] Env-variabler separerade per miljo
- [x] .env.example ajourford

## Reviews

- Kordes: code-reviewer (enda relevanta -- docs/config)

## Lardomar

1. **`vercel env add ... preview`** kraver tomt branch-argument (`""`) for "alla branches"
   i non-TTY-miljo. `--value` och `--yes` flaggor fungerar inte med v50.28.0.

2. **Separera env per miljo tidigt**: Delade env-variabler (alla miljöer) ar fragila --
   nar en miljö behover annat varde maste man ta bort och ateraddera for varje miljo.

3. **PoC som staging ar gratis**: Supabase free tier racker for staging.
   Ingen extra kostnad, men migrationer maste appliceras pa bada miljoerna.
