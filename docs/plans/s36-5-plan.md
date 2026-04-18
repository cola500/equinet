---
title: "S36-5 Plan: Modellval-avvikelse-larm i metrics:report"
description: "M8-sektion i generate-metrics.sh som flaggar stories där modellval avviker från regeln"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - User story
  - Påverkade filer
  - Approach
  - Arkitekturcoverage
  - Risker
---

# S36-5 Plan: Modellval-avvikelse-larm i metrics:report

## Aktualitet verifierad

**Kommandon körda:**
- `grep -l "## Modell" docs/done/*.md | wc -l` → 15 done-filer med Modell-fält (S33+)
- Värden: opus (s35-0, s33-1), sonnet/claude-sonnet-4-6 (övriga)
- `project_model_selection_metrics.md` laddad — regler definierade

**Beslut:** Fortsätt. S35-1 finns som känd negativ data-punkt.

## User story

Som tech lead vill jag se vilka stories som använde fel modell enligt regeln, så att jag kan fatta datadrivna beslut om modellval per story-typ.

## Påverkade filer

1. `scripts/generate-metrics.sh` — ny `m8_model_selection()` + sektion i rapport
2. `/Users/johanlindengard/.claude/projects/.../memory/project_model_selection_metrics.md` — pekare till M8

## Approach

### Modellval-regler (inline i script)

Två nivåer:
- **opus förväntat**: story-typ = arkitekturdesign ELLER säkerhetskritisk implementation med cross-cutting concerns (RLS + service + migration)
- **sonnet/haiku acceptabelt**: allt annat

### Story-typ-detektion för modell

Opus förväntat om done-filen matchar:
- `arkitekturdesign|design av domän|domän-design|design-story` (arkitektur)
- `implementerar.*S\d+-0|bygger på.*arkitektur|cross.?cutting|RLS.*migration.*service|migration.*policy.*grant` (säkerhets-crosscutting)

### Avvikelse-detektion

1. Läs done-fil med `## Modell`-sektion
2. Normalisera värde: `sonnet-4-6|claude-sonnet*` → `sonnet`, `opus*` → `opus`, `haiku*` → `haiku`
3. Identifiera förväntat modell
4. Jämför: faktisk vs förväntat → flagga MISMATCH

### Verifiering

S35-1 ska flaggas som MISMATCH: typ=security-crosscutting, förväntat=opus, faktisk=sonnet.

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Risker

- **Få data-punkter (15 st):** Resultaten är indikativa, inte statistiskt signifikanta. Räcker för att validera att M8 funkar.
- **Normaliseringen:** Värden som `claude-sonnet-4-6`, `` `opus` `` (med backticks), `sonnet (denna session)` kräver normalisering.
