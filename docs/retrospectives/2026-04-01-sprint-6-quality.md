---
title: "Sprint 6 Retro: Kvalitet + RLS"
description: "BDD-audit (72 tester), Stripe CSP-fix, RLS-spike med arkitekturbeslut."
category: retro
status: active
last_updated: 2026-04-01
tags: [retro, sprint-6, quality, bdd, rls, stripe]
sections:
  - Levererat
  - Vad gick bra
  - Vad som inte fungerade
  - Processändringar
---

# Sprint 6 Retro: Kvalitet + RLS

**Sprint:** 6
**Datum:** 2026-04-01

## Levererat

| Story | Vad |
|-------|-----|
| S6-1 | 72 integrationstester -- auth-gap halverat (1/10 -> 5/10) |
| S6-2 | CSP-fix för Stripe (js.stripe.com + api.stripe.com) |
| S6-4 | RLS research: rekommenderar stärk app-lagret, roadmap med 4 faser |
| S6-3 | Blockerad (Stripe företagsverifiering) |

## Vad gick bra

- BDD-audit avslöjade riktigt gap -- auth hade 9/10 unit-only
- 5 Whys fungerade på S6-2 (CSP som rotorsak, inte trial-and-error)
- RLS-spike tidboxad och levererade tydlig rekommendation
- Arkitekturbeslut: gradvis RLS-migrering dokumenterad i roadmap

## Vad som inte fungerade

- Dev saknade done-fil på S6-2
- Dev startade implementation utan plan-OK (fjärde gången totalt)

## Processändringar

1. debug-discipline hook implementerad -- testar sprint 7
2. plan-approval hook implementerad -- testar sprint 7
3. RLS roadmap som arkitekturbeslut -- 4 faser dokumenterade
4. BDD-check i review-checklista -- fungerade, fångade gapet i sprint 5
5. Feature flag lanseringsbedömning tillagd i roadmap -- 18 flaggor klassificerade
