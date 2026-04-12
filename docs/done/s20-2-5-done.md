---
title: "S20-2/3/4/5 Done: Process Enforcement Hooks"
description: "Supabase .eq() hook, done+status check, repository pattern, BDD dual-loop"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Laerdomar
---

# S20-2/3/4/5 Done: Process Enforcement Hooks

## Acceptanskriterier

### S20-2: Supabase .eq() ownership audit-hook
- [x] Hook varnar vid ny Supabase-query utan .eq() filter
- [x] Inga false positives pa publika endpoints (stables, providers, cron)

### S20-3: Done-fil + status atomisk commit-check
- [x] Varning vid commit av done-fil utan status.md
- [x] Ingen varning vid vanliga commits utan done-fil

### S20-4: Pre-commit repository pattern-varning
- [x] Varning vid prisma.booking.findMany() i API route
- [x] Ingen varning i $transaction-block
- [x] Bara karndomaner (booking, provider, service, customerReview, horse, follow, subscription)

### S20-5: BDD dual-loop-paminnelse
- [x] Paminnelse om integration test vid API route/domain service-redigering
- [x] Ingen paminnelse om .integration.test.ts redan finns
- [x] Befintlig TDD-paminnelse opaverkad

## Definition of Done

- [x] Fungerar som forvantat
- [x] check:all 4/4 grona (3997 tester)
- [x] Hooks installerade i befintliga filer (ingen ny hook-fil)

## Reviews

Kordes: ingen subagent (mekanisk hook-ändring, docs/config undantag)

## Laerdomar

- Battre att utoka befintliga hooks an att skapa nya -- samma trigger-kontext, mindre konfiguration.
- post-api-route-verify.sh ar nu 6 checkar (auth, null-check, include, console, .eq(), repository).
