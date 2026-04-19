---
title: "Sprint 45: Process-hardening — automatisera det som inte följs"
description: "Bygg 4 hooks + 1 rule-förtydligande som adresserar procedurbrotten från S43-S44. Målet: procedurbrott → nära noll även vid högt tempo."
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, process, automation, hooks, git, discipline]
sections:
  - Sprint Overview
  - Bakgrund
  - Stories
  - Exekveringsplan
  - Mätning av effekt
  - Definition of Done
---

# Sprint 45: Process-hardening — automatisera det som inte följs

## Sprint Overview

**Mål:** Bygg automationen som backloggen samlat under S43-S44. Efter sprinten ska procedurbrotten som process-drift-retron identifierade vara blockerade eller tydligt varnade av hooks — inte beroende av mänsklig disciplin.

**Scope-avgränsning:** Inga nya features, inga E2E-migreringar. Fokus är process-infrastruktur. Dev's "tempo-hjärna" ska mötas av "automation-hjärna" som säger ifrån.

---

## Bakgrund

`docs/retrospectives/2026-04-19-process-drift-s43-s44.md` dokumenterade 8 procedurbrott på 2 timmar. Rotorsak: **reglerna är uppdaterade men automatiseringen släpar efter**. Vi förlitar oss på mänsklig disciplin i en situation där vi bevisligen har nedsatt disciplin pga tempo.

Denna sprint adresserar det direkt.

Backlog-rader som löses här:
- **Plan-commit-gate: hook + rule-förtydligande** (S43-1-lärdom)
- **Sprint-avslut-gate: hook eller script** (S43→S44-lärdom)
- Trivial-gating-förtydligande är redan gjort (PR #227) — men ingen hook enforcear det

Nya observationer att adressera:
- **Dev mergar egna PR:er** — S44-0, S44-1, S44-2 mergades utan tech-lead-review (team-workflow.md Station 7 brott)
- **Plan-commit på main skapade divergent branches vid PR #230** (Dev's egen S44-retro-fynd)
- **Tech lead committade på Dev's feature branch 2 gånger** trots parallel-sessions.md-regel

---

## Stories

### S45-0: Plan-commit-gate (pre-commit hook)

**Prioritet:** 0
**Effort:** 45-60 min
**Domän:** infra (`scripts/check-plan-commit.sh` + husky pre-commit)

Pre-commit-hook som varnar när en story är markerad `in_progress` i `docs/sprints/status.md` men `docs/plans/<story-id>-plan.md` saknas (icke-committad eller ej-existerande).

**Implementation:**

```bash
#!/usr/bin/env bash
# scripts/check-plan-commit.sh

# Hitta aktiva story-IDs från status.md (rader med "in_progress")
ACTIVE_STORIES=$(grep -E "^\| S[0-9]+-[0-9]+" docs/sprints/status.md | grep "in_progress" | awk -F'|' '{print $2}' | grep -oE "S[0-9]+-[0-9]+")

for STORY in $ACTIVE_STORIES; do
  PLAN_FILE="docs/plans/${STORY,,}-plan.md"  # lowercase
  if [[ ! -f "$PLAN_FILE" ]] || ! git ls-files --error-unmatch "$PLAN_FILE" > /dev/null 2>&1; then
    echo "⚠️  Plan-commit-varning: $STORY är 'in_progress' men $PLAN_FILE saknas eller ej committad."
    echo "   Per team-workflow.md Station 1: committa planen FÖRE implementation så tech lead kan läsa den."
    # Varning — blockerar inte
  fi
done
```

**Trigger:** husky/pre-commit (OBS: trigga bara när `status.md` staged ELLER när nya test-/src-filer staged)

**Acceptanskriterier:**
- [ ] Hook varnar korrekt när story in_progress utan plan-fil
- [ ] Hook varnar INTE när plan-fil finns + committad
- [ ] Hook varnar INTE vid ren lifecycle-docs-commit (retro, done-fil)
- [ ] Test med scenariot från S43-1 (story in_progress utan plan)

**Reviews:** code-reviewer

**Arkitekturcoverage:** N/A

---

### S45-1: Sprint-avslut-gate (pre-commit hook)

**Prioritet:** 1
**Effort:** 30-45 min
**Domän:** infra (`scripts/check-sprint-closure.sh` + husky pre-commit)

Pre-commit-hook som varnar när ny story markeras `in_progress` men föregående sprint inte är korrekt avslutad.

**Detektions-kriterier för "ostängd sprint":**
- Föregående sprints alla stories är `done` i status.md
- MEN "Aktiv sprint"-sektion visar fortfarande föregående sprint
- ELLER `docs/retrospectives/<datum>-sprint-<N>.md` saknas

**Implementation (skiss):**

```bash
# Extrahera aktiv sprint
ACTIVE_SPRINT=$(grep -m1 "^\*\*Sprint [0-9]" docs/sprints/status.md | grep -oE "Sprint [0-9]+")

# Alla stories i aktiv sprint `done`?
ACTIVE_SPRINT_NUM=$(echo "$ACTIVE_SPRINT" | grep -oE "[0-9]+")
ALL_DONE=$(grep -E "^\| S${ACTIVE_SPRINT_NUM}-" docs/sprints/status.md | grep -c "done")
TOTAL=$(grep -cE "^\| S${ACTIVE_SPRINT_NUM}-" docs/sprints/status.md)

if [[ "$ALL_DONE" -eq "$TOTAL" ]] && [[ "$TOTAL" -gt 0 ]]; then
  # Kolla om retro finns
  if ! ls docs/retrospectives/*sprint-${ACTIVE_SPRINT_NUM}.md > /dev/null 2>&1; then
    echo "⚠️  Sprint-avslut-varning: $ACTIVE_SPRINT har alla stories done men retro saknas."
    echo "   Kör sprint-avslut innan ny sprint startas (autonomous-sprint.md)."
  fi
fi
```

**Acceptanskriterier:**
- [ ] Varnar när aktiv sprint alla done men retro saknas
- [ ] Varnar när alla done men "Aktiv sprint"-sektion inte stängd
- [ ] Varnar INTE under pågående sprint (någon story pending/in_progress)
- [ ] Test mot S43→S44-scenariot

**Reviews:** code-reviewer

**Arkitekturcoverage:** N/A

---

### S45-2: Multi-commit-gate (pre-push hook)

**Prioritet:** 2
**Effort:** 30-45 min
**Domän:** infra (utöka `.husky/pre-push`)

Pre-push-hook som varnar om feature branch har färre än 2 commits över main. Fångar "0 commits hela storyn"-mönstret från S43-1.

**Implementation:**

```bash
# I .husky/pre-push, efter befintliga checks:
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" =~ ^feature/ ]]; then
  COMMITS_AHEAD=$(git rev-list --count main..HEAD)
  if [[ "$COMMITS_AHEAD" -lt 2 ]]; then
    echo "⚠️  Multi-commit-varning: feature branch har bara $COMMITS_AHEAD commit(s) över main."
    echo "   Per team-workflow.md ska varje station committas separat (PLAN → RED → GREEN → ...)."
    echo "   Om detta är avsiktligt (hotfix, docs-only): fortsätt."
  fi
fi
```

**Avgränsning:** Varning, ej blocker. Små stories (docs-only, trivial) kan legitimt ha 1 commit.

**Acceptanskriterier:**
- [ ] Varnar när feature branch har <2 commits
- [ ] Varnar INTE för main
- [ ] Varnar INTE för docs-only feature branches
- [ ] Test mot S43-1-scenariot (0 commits hela storyn)

**Reviews:** code-reviewer

**Arkitekturcoverage:** N/A

---

### S45-3: Tech-lead-merge-gate (rule + hook)

**Prioritet:** 3
**Effort:** 45-60 min
**Domän:** rules (`.claude/rules/team-workflow.md` + `scripts/check-own-pr-merge.sh`)

**Del 1: Regel-förtydligande i team-workflow.md Station 7**

Lägg till explicit:

> **Dev MERGAR ALDRIG egen PR — tech lead är alltid gatekeeper.**
>
> Flow: Dev pushar feature branch → tech lead triggas via "kör review" → tech lead granskar + skapar PR + mergar. Om Dev skapar PR själv: tech lead måste triggas explicit innan merge. Undantag: rule-docs-ändringar (`.claude/rules/*`) kan mergas av den som gjorde dem efter self-review.

**Del 2: Hook som varnar vid egen PR-merge**

```bash
# scripts/check-own-pr-merge.sh
# Kör när gh pr merge triggas (alias i .gitconfig eller shell)

PR_NUMBER="$1"
AUTHOR=$(gh pr view "$PR_NUMBER" --json author --jq '.author.login')
CURRENT_USER=$(gh api user --jq '.login')

if [[ "$AUTHOR" == "$CURRENT_USER" ]]; then
  echo "⚠️  Tech-lead-merge-varning: du försöker merga din egen PR #$PR_NUMBER."
  echo "   Per team-workflow.md Station 7: Dev mergar inte egen PR."
  echo "   Trigga tech lead: säg 'kör review' till en annan Claude-session."
  read -p "Fortsätt ändå? (y/N) " -n 1 -r
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi
```

**Alternativ:** GitHub Action som kommenterar på PR om author försöker merga själv. Men kräver Pro för branch protection. Hook-varning räcker för hobby-repo.

**Acceptanskriterier:**
- [ ] Regel tillagd i team-workflow.md Station 7
- [ ] `last_updated` uppdaterad
- [ ] Hook-script fungerar (manuell test)
- [ ] Dokumenterat i `docs/guides/git-hooks.md` (om den finns, annars README)

**Reviews:** code-reviewer + tech-architect (regel-ändring)

**Arkitekturcoverage:** N/A

---

### S45-4: Plan-commit-divergens-varning (valfri, beror på tid)

**Prioritet:** 4 (valfri)
**Effort:** 15-20 min
**Domän:** rules (`.claude/rules/commit-strategy.md`)

Förtydligande i commit-strategy.md baserat på Dev's S44-retro-fynd:

> **Plan-commit-ordning:** Om `docs/plans/<story-id>-plan.md` committas direkt till main (tillåtet per path-listan), skapa feature branch EFTER att main är pushad. Annars skapar det divergent branches när PR senare försöker merga.
>
> Säker ordning:
> 1. Uppdatera main lokalt: `git pull origin main`
> 2. Skriv plan-filen, committa på main
> 3. Pusha: `git push origin main`
> 4. Skapa feature branch: `git checkout -b feature/<id>`

**Acceptanskriterier:**
- [ ] Sektion tillagd i commit-strategy.md
- [ ] Refererar Dev's S44-retro som källa

**Reviews:** ingen (docs-only, <15 min)

**Arkitekturcoverage:** N/A

---

## Exekveringsplan

```
Sekventiellt (varje hook testas innan nästa):

S45-0 (45-60 min, plan-commit-gate)
  → S45-1 (30-45 min, sprint-avslut-gate)
  → S45-2 (30-45 min, multi-commit-gate)
  → S45-3 (45-60 min, tech-lead-merge-gate)
  → S45-4 (valfri, 15-20 min, plan-commit-divergens)
```

**Total effort:** 2.5-3.5h + valfri 20 min = halvdag.

**Parallellisering:** Nej — alla hooks är i samma område (scripts/ + hooks/). Sekventiell utveckling är säkrast.

**Viktigt:** Varje hook måste **testas med ett riktigt scenario** från S43-S44-procedurbrotten. Om hook inte fångar scenariot är den inte klar.

---

## Mätning av effekt

**Baseline (S43-S44):** 8 procedurbrott på 2 timmar → 4 brott/timme.

**Mål för S46-S48:** 0-1 procedurbrott per sprint, mätt i retro.

**Uppföljning:** Lägg till stycke i varje retro-mall: "Procedurbrott upptäckta" (lista + antal). Om >2 per sprint → re-evaluering av hooks.

**Mätmetod:** Inget automatiskt — enkel räkning i varje retro. Efter 3 sprintar: om brotten är nere, process-hardening lyckad. Om inte, djupare strukturell analys.

---

## Definition of Done (sprintnivå)

- [ ] 4 hooks byggda, committade, testade (S45-0 till S45-3)
- [ ] S45-4 (docs-förtydligande) klar eller motiverat avskriven
- [ ] Varje hook testad mot specifikt S43-S44-scenario
- [ ] `npm run check:all` grön
- [ ] Rule-ändringar i team-workflow.md + commit-strategy.md mergade
- [ ] `docs/guides/git-hooks.md` uppdaterad med de 4 nya hooks (om filen finns) eller noterat i README
- [ ] Sprint-retro med explicit avsnitt "Procedurbrott upptäckta" (målet: 0 för S45 själv)

**Inte i scope (framtida sprintar):**
- GitHub Actions-baserade gates (kräver Pro för branch protection)
- Automatisk PR-reviewer-assignment
- CI-integration av hooks (körs bara lokalt nu)
