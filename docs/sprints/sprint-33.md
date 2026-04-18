---
title: "Sprint 33: Process tweaks + TBD"
description: "Mindre process-justeringar baserat på S31/S32-lärdomar, övriga stories TBD"
category: sprint
status: active
last_updated: 2026-04-18
tags: [sprint, process, meta]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 33: Process tweaks + TBD

## Sprint Overview

**Mål:** Formalisera fyra process-justeringar som kristalliserats från S31/S32-retros. Övriga stories planeras när S33-0 är merged.

---

## Stories

### S33-0: Process tweaks (4 justeringar)

**Prioritet:** 0 (meta, kör först)
**Effort:** 30 min
**Domän:** docs (`.claude/rules/**` + `docs/plans/TEMPLATE.md`)

Baserat på retro för S31 och S32 har fyra konkreta process-justeringar identifierats. Alla är små rule/template-ändringar med tydliga problem bakom sig.

**Implementation:**

1. **TEMPLATE.md -- audit-verifiering i "Aktualitet verifierad"-sektionen**
   - Utöka befintlig sektion med: "Audit-stories ska verifiera att det påstådda gapet faktiskt finns (grep-kommando + resultat)"
   - Problem bakom: S32-3-planen antog haptic saknades i 6 vyer, grep hade visat att det fanns.

2. **autonomous-sprint.md -- metrics:report obligatoriskt vid sprint-avslut**
   - Lägg till rad i Sprint-avslut-checklistan
   - Problem bakom: utan tvång glöms mätning bort. Hela poängen med S32-1.

3. **auto-assign.md -- "Modell:"-fält i done-fil-mallen (Steg 9)**
   - Lägg till rad: `**Modell:** opus / sonnet / haiku`
   - Problem bakom: modellval-metric kräver data. Varje dag utan fält = förlorad datapunkt.

4. **parallel-sessions.md -- tech lead räknas som session**
   - Lägg till en mening som förtydligar: "Tech lead är också en session när den rör working tree."
   - Problem bakom: S32-sessionen där tech lead och dev 2 delade main krockade.

**Acceptanskriterier:**
- [ ] Alla 4 filändringar gjorda
- [ ] Plan-filen har "Aktualitet verifierad"-sektion (dogfooding)
- [ ] `npm run check:all` grön
- [ ] Pre-commit-hook grön (inga svenska-tecken-fel)

**Avgränsning:** Ingen implementation av modellval-metriken -- bara fältet i mallen. Själva metric-utökningen är en framtida story.

---

## Exekveringsplan

```
S33-0 (30 min, process tweaks) -> [fler stories planeras efter]
```

## Definition of Done (sprintnivå)

- [ ] S33-0 merged
- [ ] Fler stories planerade och genomförda (TBD efter S33-0)
