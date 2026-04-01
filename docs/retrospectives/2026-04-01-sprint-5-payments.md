---
title: "Sprint 5 Retro: Betalning (Stripe)"
description: "Stripe betalning end-to-end, BDD-gap identifierat och åtgärdat."
category: retro
status: active
last_updated: 2026-04-01
tags: [retro, sprint-5, payment, stripe, bdd]
sections:
  - Levererat
  - Vad gick bra
  - Vad som inte fungerade
  - Processändringar
---

# Sprint 5 Retro: Betalning (Stripe)

**Sprint:** 5 -- Betalning
**Datum:** 2026-04-01

## Levererat

23 filer, 31 nya tester, 3794 totalt, 0 regressioner.
Stripe betalning end-to-end: gateway + webhook + Payment Element UI + integrationstester.

## Vad gick bra

- IPaymentGateway-abstraktionen bar frukt -- Stripe pluggade in utan att röra routes/UI
- Plan-review-flödet fungerade utan friktion
- Dev följde BDD-feedback direkt (integrationstester i S5-5)
- 5 stories på en session

## Vad som inte fungerade

- BDD dual-loop hoppades över i S5-2/S5-3 -- Lead borde fångat vid review
- Stripe E2E skippas lokalt (Turbopack + NEXT_PUBLIC env)
- Dev startade implementation utan plan-OK (tredje gången)

## Processändringar

1. **BDD-check i code-review-checklist.md** -- Lead verifierar integrationstest vid varje review
2. **plan-approval-check.sh hook** -- Ny hook som säger STOPP om bara plan-commit finns på branchen
3. **Stripe E2E fix** -- S6-2: pk_test-nyckel i .env
