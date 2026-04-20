---
title: "Plan S47-0 — Explicit review-matris + strukturerat done-fil-format"
description: "Extrahera review-matrisen till .claude/rules/review-matrix.md och uppdatera done-fil-mall med strukturerat checkboxformat"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - User Story
  - Påverkade filer
  - Approach
  - Risker
---

# Plan S47-0 — Explicit review-matris + strukturerat done-fil-format

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story — S47-0 i sprint-47.md skapad 2026-04-20)
**Resultat:** Filen `.claude/rules/review-matrix.md` existerar inte. Matrisen finns inbäddad i `autonomous-sprint.md`.
**Beslut:** Fortsätt — problemet är verifierat, inget löst sedan sprint skrevs.

## User Story

Som Dev-session vill jag ha en maskinläsbar review-matris i en dedikerad fil och ett strukturerat done-fil-format så att S47-1:s hook kan automatiskt validera att rätt reviews körts.

## Påverkade filer

| Fil | Åtgärd |
|-----|--------|
| `.claude/rules/review-matrix.md` | Ny fil — glob-baserad matris |
| `.claude/rules/autonomous-sprint.md` | Uppdatera Review-matris-sektion → referens till ny fil |
| `.claude/rules/auto-assign.md` | Uppdatera done-fil-struktur i steg 9 med nytt checkboxformat |

## Approach

### Del 1: review-matrix.md

Skapa `.claude/rules/review-matrix.md` med glob-baserad matristabell. Format direkt hämtat från sprint-47.md. Lägg till frontmatter (category: rule, status: active).

Fält per rad: **Filmönster (glob)** | **Story-typ** | **Obligatoriska subagents**

Inkludera alla rader från sprint-47.md plus en `default`-rad.

### Del 2: autonomous-sprint.md

- Hitta "Review-matris (vilka subagenter per story-typ)"-sektionen
- Ta bort tabellen
- Ersätt med: `> Se [review-matrix.md](review-matrix.md) för fullständig matris.`
- Bevara all text UTANFÖR tabellen (intro-text, kör alltid code-reviewer-regeln, Täckning + Gap-noten)

### Del 3: auto-assign.md

- Hitta steg 9 done-fil-struktur (under "## Steg")
- Uppdatera "Reviews körda"-sektionen i done-fil-mallen med det strukturerade checkboxformatet från sprint-47.md

## Risker

- Ingen reducering i täckning — alla matris-rader bevaras, bara flyttas
- Backwards-compat: befintliga done-filer behöver inte bakåtkonverteras
- Trivialt docs-only — inget att testa, inga runtime-effekter

## TDD-ansats

Docs-only story per team-workflow.md → ingen TDD krävs. Station 5 (check:all) körs ändå.
