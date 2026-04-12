---
title: "S24-4 Done: Dependabot auto-merge for patch"
description: "GitHub Actions workflow for auto-approve + squash-merge av Dependabot patch PRs"
category: retro
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Lärdomar
---

# S24-4 Done: Dependabot auto-merge for patch

## Acceptanskriterier

- [x] Dependabot skapar PRs for patch-uppdateringar (ignore-regel borttagen)
- [x] GitHub Actions workflow auto-approvar och auto-mergar patch PRs
- [x] Major och minor ignoreras fortfarande av Dependabot
- [x] Quality gates maste passera fore merge (via `--auto` flaggan)

## Definition of Done

- [x] Inga TypeScript-fel (inga TS-filer andrades)
- [x] Saker (bara patch, kräver CI-pass)
- [x] Docs/config -- inga tester applicerbara
- [x] Backlog uppdaterad (CSP report-to + Dependabot borttagna)

## Reviews körda

- Kördes: code-reviewer (enda relevanta -- ren infra/config)

## Lärdomar

- `dependabot/fetch-metadata@v2` ger `update-type` output som kan villkora stegen
- `gh pr merge --squash --auto` väntar på required checks innan merge -- säkrare än omedelbar merge
- Dependabot-PRs triggar `pull_request` event men med `github.actor == 'dependabot[bot]'` som filter
