---
title: "S24-4: Dependabot auto-merge for patch"
description: "GitHub Actions workflow for auto-approve + auto-merge Dependabot patch PRs"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Approach
  - Filer
---

# S24-4: Dependabot auto-merge for patch

## Approach

1. Uppdatera `.github/dependabot.yml`: ta bort ignore-regeln for `version-update:semver-patch` pa npm-ecosystem (behall major/minor-ignore)
2. Skapa `.github/workflows/dependabot-auto-merge.yml`:
   - Trigger: `pull_request` event fran Dependabot
   - Villkor: bara patch-uppdateringar (kontrollera via `dependabot/fetch-metadata`)
   - Auto-approve med `gh pr review --approve`
   - Auto-merge med `gh pr merge --squash --auto`
   - Krav: quality-gates workflow maste passera (redan konfigurerat via branch protection / required checks)

## Filer

- `.github/dependabot.yml` -- ta bort patch-ignore for npm
- `.github/workflows/dependabot-auto-merge.yml` -- ny workflow
- `docs/sprints/status.md` -- uppdatera status
