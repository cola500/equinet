---
title: "S21-1 Done: Stripe webhook idempotens"
description: "Event-ID dedup-tabell + terminal-state-guards i SubscriptionService"
category: retro
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Laerdomar
---

# S21-1 Done: Stripe webhook idempotens

## Acceptanskriterier

- [x] StripeWebhookEvent-tabell skapad med UNIQUE constraint pa eventId
- [x] Duplicerade events avvisas utan bearbetning
- [x] SubscriptionService har terminal-state-guards (canceled + incomplete_expired)
- [x] Tester: replay av samma event -> no-op (route.test.ts dedup-tester)
- [x] Migration skapad och testad lokalt

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel (npm run typecheck)
- [x] Saker (Zod-validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests skrivna FORST, coverage uppfyllt (37 berorda tester, 4005 totalt)
- [x] Feature branch, alla tester grona
- [x] Docs uppdaterade (plan committad)

## Reviews

- [x] tech-architect (plan): 2 major (terminal states, race condition docs), 2 minor -- alla atgardade
- [x] security-reviewer (plan): 1 blocker (TOCTOU fix: createMany + rollback), 1 major (terminal states) -- alla atgardade
- [x] code-reviewer (kod): 2 major (tryRecordEvent-throw test, handleSubscriptionDeleted guard), 2 minor (deleteEvent logging, RLS advisory) -- alla major atgardade
- Kordes: tech-architect, security-reviewer (Explore), code-reviewer

## Avvikelser

- **RLS pa StripeWebhookEvent**: Medvetet inte aktiverat. Tabellen anvands bara via Prisma (service role), aldrig via Supabase-klient.
- **Cleanup-cron**: Inte i scope. `processedAt`-index finns for framtida implementation.

## Laerdomar

- **`createMany` + `skipDuplicates`** ar idiomatiskt for INSERT ON CONFLICT DO NOTHING i Prisma. Atomiskt, inget TOCTOU-fonster.
- **Failure-rollback for dedup**: Om processing kastar maste dedup-raden raderas, annars blockeras Stripe-retries permanent.
- **`vi.hoisted()`** kravs nar vi.mock-factories refererar mock-variabler (TDZ-problem med const-hoisting).
- **Terminal states for subscriptions**: `canceled` racker inte -- `incomplete_expired` ar ocksa terminal i Stripes livscykel.
