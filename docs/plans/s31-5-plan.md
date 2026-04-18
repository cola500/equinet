---
title: "S31-5: Arkivera gamla planer"
description: "Flytta plan-filer från avslutade sprintar (S2-S28) till docs/archive/plans/"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Kontext
  - Approach
  - Faser
  - Verifiering
---

# Plan: S31-5 Arkivera gamla planer

## Aktualitet verifierad

**Kommandon körda:**
```bash
ls docs/plans/ | wc -l  # → 113
ls docs/archive/        # → katalogen finns med andra filer
ls docs/archive/plans/  # → saknas (plans-underkatalog finns inte)
```

**Resultat:** 113 filer i docs/plans/, plans-arkiv saknas. Problemet existerar.

**Beslut:** Fortsätt med implementation.

## Kontext

113 plan-filer i `docs/plans/`, de flesta från avslutade sprintar (S2-S28). Brus försvårar navigation och search. Sprintar S29-S31 + template + icke-sprint-planer ska behållas.

## Approach

1. Skapa `docs/archive/plans/`
2. `git mv` alla s2-s28 plan-filer dit
3. Skapa README.md i archive/plans/
4. Behåll: TEMPLATE.md, s29-*, s30-*, s31-*, och namngivna icke-sprint-filer

## Faser

### Fas 1: Skapa arkiv-katalog och flytta filer
- `mkdir -p docs/archive/plans/`
- git mv alla sprint-planer för s3-s28 (inga s2-planer finns)
- Kontrollera att rätt filer behålls

### Fas 2: README.md i archive
- Frontmatter + en rad: "Planer från avslutade sprintar (S2-S28)."

## Verifiering

- `docs/plans/` innehåller max ~20 filer
- `docs/archive/plans/` innehåller arkiverade filer
- `git log --follow` spårar filerna
