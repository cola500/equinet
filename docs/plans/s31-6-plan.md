---
title: "S31-6: Mät agent-användning av docs"
description: "Lägg till Verktyg använda-sektion i done-fil-krav för att mäta om patterns.md och code-map.md används"
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

# Plan: S31-6 Mät agent-användning av docs

## Aktualitet verifierad

**Kommandon körda:**
```bash
grep -c "Verktyg använda" .claude/rules/auto-assign.md  # → 0
```

**Resultat:** Sektionen "Verktyg använda" saknas i done-fil-kraven. Problemet existerar.

**Beslut:** Fortsätt med implementation.

## Kontext

`patterns.md` och `code-map.md` har använts i done-filer, men vi vet inte om de faktiskt konsulteras vid planering eller bara citeras i efterhand. Utan mätdata kan vi inte avgöra om katalogerna ger värde.

## Approach

Lägg till "Verktyg använda"-sektion i Steg 9 done-fil-kraven i `.claude/rules/auto-assign.md`.
Format: ja/nej/N/A per verktyg, plus vilket pattern som hittades.
Utvärdering efter 10 stories.

## Faser

### Fas 1: Uppdatera auto-assign.md
- Lägg till ny sektion `**Verktyg använda**` efter `**Docs uppdaterade**` i Steg 9
- Obligatoriskt format: ja/nej/N/A för patterns.md och code-map.md
- Inkludera utvärderingsvillkor (efter 10 stories)

## Verifiering

- Sektionen finns i Steg 9
- `npm run check:all` grön
