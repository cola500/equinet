---
title: "S31-4: Tvinga grep-verifiering i plan-mall"
description: "Uppdatera TEMPLATE.md och check-docs-updated.sh för att säkerställa aktualitetsverifiering"
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

# Plan: S31-4 Tvinga grep-verifiering i plan-mall

## Aktualitet verifierad

**Kommandon körda:**
- `grep -c "Aktualitet verifierad" docs/plans/TEMPLATE.md` → 0 (sektionen saknas)
- `grep -c "Aktualitet" scripts/check-docs-updated.sh` → 0 (hooken saknar check)
- Bekräftat: 0/10 senaste plans/*.md innehåller aktualitetssektionen

**Beslut:** Problemet existerar. Fortsätt med implementation.

## Kontext

S27 (2/8), S29 (2/6) och S30 (2/7) stories var redan lösta när de plockades. ~25% slösad planering per sprint.
Regeln om aktualitetsverifiering i Station 1 fångar inte -- TEMPLATE.md kräver det inte och scriptet kontrollerar det inte.

## Approach

1. Lägg till `## Aktualitet verifierad` som FÖRSTA sektion i TEMPLATE.md
2. Uppdatera `scripts/check-docs-updated.sh` att blockera plan-commits utan sektionen
3. Verifiera hooken fungerar (positiv + negativ test)

## Faser

### Fas 1: Uppdatera TEMPLATE.md
- Lägg till `## Aktualitet verifierad` före `## Kontext`
- Inkludera mall-text: kommandon, resultat, beslut
- Markera som obligatorisk för backlog-stories, N/A för nya sprint-stories

### Fas 2: Uppdatera check-docs-updated.sh
- Lägg till check: om `docs/plans/s*.md` staged → verifiera `## Aktualitet verifierad` finns
- Exkludera TEMPLATE.md
- Blockera commit med tydligt felmeddelande

### Fas 3: Verifiera hooken
- Skapa temporär plan utan sektionen → commit ska blockeras
- Skapa temporär plan med sektionen → commit ska passera
- Ta bort test-filer

## Verifiering

- `npm run check:all` grön
- `npm run docs:validate` grön
