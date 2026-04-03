---
title: "Sprint 9 Retro: Produktionshärdning"
description: "12 stories, schema-isolation, branch protection, kritiskt modell-ID-fynd"
category: retro
status: active
last_updated: 2026-04-03
tags: [retro, sprint-9, security, rls, onboarding]
sections:
  - Levererat
  - Vad gick bra
  - Vad som inte fungerade
  - Kritisk lärdom
  - Processändringar
---

# Sprint 9 Retro: Produktionshärdning

**Sprint:** 9
**Datum:** 2026-04-02 -- 2026-04-03

## Levererat

12 stories: branch protection, webhook idempotens+hardening, schema-isolation spike,
onboarding spike+checklista, analytics+backup, verifierings-fix, tom-tillstånd, customer insights spike.

## Vad gick bra

- Spikes ger riktigt värde (schema-isolation, onboarding, customer insights)
- Security-reviewer på login: hittade rate limiting-gap i authorize()
- cx-ux-reviewer på onboarding: hash-ankare fungerar inte i Next.js
- Tech-architect på webhook: TOCTOU race eliminerad

## Vad som inte fungerade

- Strict mode invaliderade PRs vid varje merge -- avstängt
- Status.md outdated pga PR-kö
- Trasigt modell-ID i prod sedan S8-3 (claude-sonnet-4-6-20250514 ger 404)

## Kritisk lärdom

Daterade modell-IDn kan bli ogiltiga. `claude-sonnet-4-6-20250514` returnerade 404.
Voice logging trasig i prod. Fix: använd alias (`claude-sonnet-4-6`).
Tillagt i CLAUDE.md som gotcha.

## Processändringar

1. Modell-ID alias-regel i CLAUDE.md
2. Strict mode avstängt (CI-gate kvar)
3. Status.md accepterat 1-2 PRs efter
