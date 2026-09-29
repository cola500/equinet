---
title: "AI-utvecklingsverktyg: BMAD och Impeccable"
description: "Varför BMAD-METHOD och Impeccable finns i repot, hur de används, vad som är experimentellt och vad som medvetet inte versionshanteras"
category: guide
tags: [bmad, impeccable, claude-code, tooling, experiment]
status: wip
last_updated: 2026-09-29
related:
  - CLAUDE.md
  - docs/guides/agents.md
  - .claude/rules/review-matrix.md
sections:
  - Varför de finns
  - Aktivering och användning
  - Vad som är experimentellt
  - Skyddsräcken mot projektets process
  - Vad som inte versionshanteras
  - Uppdatera eller ta bort
  - Licenser
---

# AI-utvecklingsverktyg: BMAD och Impeccable

Två installerade verktygspaket för Claude Code. **Status: experiment** (sedan 2026-09-11 respektive 2026-09-29). De ersätter inte projektets arbetsflöde i `CLAUDE.md` — de är verktyg man väljer att använda.

## Varför de finns

| Verktyg | Version | Syfte i Equinet |
|---------|---------|-----------------|
| **BMAD-METHOD** (`bmad-*`-skills, `_bmad/`) | 6.12.0 | Strukturerade planerings- och granskningsflöden: PRD, arkitektur (spine), epics/stories, adversarial review, retrospektiv, research. Användes t.ex. för arkitektur-spine och säkerhetsgranskningen 2026-09-11 (#488). |
| **Impeccable** (`impeccable`-skill + 4 agenter) | engine 0.1.5 | UI/UX-kritik, audit och polering av gränssnitt, med `PRODUCT.md`, `DESIGN.md` och `.impeccable/design.json` som designkontext. Användes för kritiken av leverantörskalendern (#525). |

Filerna versionshanteras så att verktygen och deras konfiguration är reproducerbara, granskningsbara och delade mellan maskiner och worktrees.

## Aktivering och användning

Båda laddas **vid behov**: bara skillens namn + beskrivning ligger i context, innehållet laddas när skillen anropas.

**BMAD**
- Anropa en skill med namn, t.ex. `/bmad-help` (vägvisare), `/bmad-architecture`, `/bmad-review`, `/bmad-prd`, `/bmad-retrospective`.
- Kräver [`uv`](https://docs.astral.sh/uv/) lokalt: varje skill kör `uv run _bmad/scripts/render_skill.py`, som renderar workflowet till `_bmad/render/` (cache, gitignored).
- Utdata hamnar i `_bmad-output/` (gitignored, se nedan).
- Stäng av skills du inte använder lokalt med `skillOverrides` i `.claude/settings.local.json` (`"bmad-prd": "off"`).

**Impeccable**
- `/impeccable <kommando>`, t.ex. `critique`, `audit`, `polish`, `harden`. `/impeccable` utan argument visar menyn.
- Agenterna (`impeccable-finish-reviewer`, `-documenter`, `-asset-producer`, `-manual-edit-applier`) startas av skillen, inte manuellt.
- Första körningen laddar ner motorbinären (se nedan) — kräver nätverk.
- Designkontext: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, kritikrapporter i `.impeccable/critique/`.

## Vad som är experimentellt

- **Allt i båda paketen.** Om ett flöde inte ger värde efter en tid tas det bort (se nedan).
- `bmad-build` / `bmad-build-auto` (implementation) konkurrerar med projektets eget flöde (`/implement`, "kör"). Föredra projektets flöde för feature-arbete; BMAD:s implementationsflöden är ett explicit opt-in.
- Impeccables PostToolUse-hook (kör `impeccable hook` efter filändringar) är **maskinlokal** i `.claude/settings.local.json` och inte delad.

## Skyddsräcken mot projektets process

- **CLAUDE.md vinner.** `_bmad/custom/bmad-build.toml` och `bmad-build-auto.toml` (team-overrides, BMAD:s egen mekanism) lägger till fakta som förbjuder commit utan uttrycklig begäran, och push/merge/tag/deploy/publish helt. Utan dem skapar båda flödena en lokal commit i slutet.
- Inga BMAD- eller Impeccable-instruktioner pushar, mergar, deployar eller raderar något. Granskat 2026-09-29.
- Allt går fortfarande via feature branch + PR + grön `Quality Gate Passed`.

## Vad som inte versionshanteras

| Sökväg | Varför |
|--------|--------|
| `.claude/skills/impeccable/scripts/bin/` | 12,7 MB plattformsbinär. Launchern (`scripts/impeccable`) laddar ner exakt version (`scripts/VERSION`) från `github.com/pbakaus/impeccable/releases` med sha256-kontroll till `~/.impeccable/bin/`. |
| `_bmad/config.user.toml`, `_bmad/custom/*.user.toml` | Personliga installationssvar och overrides. |
| `_bmad/render/*` | Renderad workflow-cache. |
| `_bmad-output/` | Genererade artefakter och sessionsloggar (`.memlog.md`). **Kan beskriva ännu ej åtgärdade sårbarheter — repot är publikt.** Flytta avsiktligt enskilda, granskade dokument till `docs/` om de ska delas. |
| `.impeccable/config.local.json`, `.impeccable/live/` | Per-utvecklare samtycke/inställningar och live-sessioner. |
| `.github/skills/impeccable/`, `.github/agents/impeccable-*`, `.github/hooks/impeccable.json` | GitHub Copilot-kopia. Används inte; att committa hooken skulle aktivera den automatiskt för Copilot CLI och Copilots cloud agent. |
| Övriga `.claude/skills/*` | Per-maskin (t.ex. Superpowers). Projektets egna skills är redan spårade. |

## Uppdatera eller ta bort

**Uppdatera BMAD:** `npx bmad-method install` i repo-roten. Installern skriver om `_bmad/config.toml`, `_bmad/_config/*`, modulernas `config.yaml` och `.claude/skills/bmad-*`, men rör aldrig `_bmad/custom/`. Granska diffen (särskilt nya `commit`/`push`-steg i `bmad-build*`) och verifiera att overrides fortfarande slår igenom:

```bash
uv run --no-cache _bmad/scripts/resolve_customization.py --skill "$PWD/.claude/skills/bmad-build" --project-root "$PWD" --key workflow.persistent_facts
```

**Uppdatera Impeccable:** `.claude/skills/impeccable/scripts/impeccable update`. Kontrollera att inga nya `.github/`-filer eller hook-poster i delad `settings.json` tillkommit.

**Ta bort:**
- BMAD: `git rm -r _bmad .claude/skills/bmad-*`, ta bort BMAD-raderna i `.gitignore`, `rm -rf _bmad-output`.
- Impeccable: `.claude/skills/impeccable/scripts/impeccable hooks reset` (tar bort hook-poster), sedan `git rm -r .claude/skills/impeccable .claude/agents/impeccable-*.md`, ta bort Impeccable-raderna i `.gitignore`, `rm -rf ~/.impeccable .github/skills/impeccable .github/agents/impeccable-* .github/hooks/impeccable.json`. `PRODUCT.md`, `DESIGN.md` och `.impeccable/` är projektdokumentation och kan behållas.

## Licenser

- BMAD-METHOD: MIT, © BMad Code, LLC — `_bmad/LICENSE`.
- Impeccable: Apache License 2.0, © Paul Bakaus — `.claude/skills/impeccable/LICENSE`. Innehåller bundlad `modern-screenshot.umd.js` (tredjepart, minifierad utan licenshuvud — verifiera licens vid uppdatering).
