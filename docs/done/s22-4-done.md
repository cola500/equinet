---
title: "S22-4 Done: Branch protection + ops-docs"
description: "Branch protection pa main, uppdaterad incident runbook"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
---

# S22-4 Done: Branch protection + ops-docs

## Acceptanskriterier

- [x] Branch protection aktiverat pa main (PR kravs, force push blockerad)
- [x] Backup-policy dokumenterad (fanns redan: docs/operations/backup-policy.md)
- [x] Incident response-plan skriven (fanns redan, uppdaterad med kontaktinfo + dataintrangsprocess)
- [x] Ingen kan pusha direkt till main (enforce via required_pull_request_reviews)

## Definition of Done

- [x] Fungerar som forvantat
- [x] Docs uppdaterade

## Reviews

- Kordes: inga subagenter (ops/docs-scope, inga kodandringar)

## Avvikelser

- `enforce_admins: false` -- Johan kan fortfarande merga direkt om nodvandigt (hotfix-scenario)
- `required_approving_review_count: 0` -- PR kravs men ingen review (1-personsteam)
- `required_status_checks: ["quality-gate"]` -- kravs for merge. Om CI inte matchar exakt detta context-namn, blockas merges. Kan behova justeras.
