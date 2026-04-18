---
title: "Sprint 36: Arkitekturcoverage + modellval-uppdatering"
description: "Stänger gapet mellan designstory och implementation-story som S35-1 avslöjade"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, process, architecture, coverage, model-selection]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 36: Arkitekturcoverage + modellval-uppdatering

## Sprint Overview

**Mål:** Åtgärda den process-lucka som S35-1 avslöjade — att designstory-output (S35-0 med 12 numrerade beslut) inte hade mekanisk koppling till implementation-story-krav (S35-1 med ~5 acceptanskriterier), vilket gjorde att säkerhetsdesign blev dokumentation utan att bli kod.

**Bakgrund:** Se S35-retro (skrivs efter S35 stängs) och `~/.claude/projects/.../memory/project_model_selection_metrics.md` för 5 Whys-analysen som ledde till denna sprint.

**Princip:** Fixa processen, inte felen. S35-1.5 är den akuta säkerhets-hotfixen; S36-0 säkerställer att samma situation inte uppstår igen.

---

## Stories

### S36-0: Arkitekturcoverage-gate mellan design och implementation

**Prioritet:** 0 (meta, kör först)
**Effort:** 30-45 min
**Domän:** docs (`.claude/rules/` + `docs/plans/TEMPLATE.md`)

När en story implementerar en tidigare story's arkitekturdesign (t.ex. S35-1 implementerar S35-0) ska det finnas en mekanisk koppling: varje numrerat designbeslut blir ett acceptanskriterium. Subagent-review får explicit instruktion att verifiera coverage.

**Implementation:**

**Ändring 1: `.claude/rules/autonomous-sprint.md` Review-matris**

Lägg till rad:

```
| Story bygger på tidigare designstory (arkitekturdokument) | Vanliga subagenter + "arkitekturcoverage"-prompt till security-reviewer/tech-architect: "Verifiera att varje numrerat designbeslut (D1, D2...) finns implementerat i koden. Lista eventuella gap." |
```

**Ändring 2: `docs/plans/TEMPLATE.md` -- ny obligatorisk sektion**

Ny sektion under "Approach":

```markdown
## Arkitekturcoverage (OBLIGATORISK om story implementerar tidigare design)

Om denna story bygger på ett arkitekturdokument (t.ex. `docs/architecture/<domain>.md`) från en tidigare designstory, lista varje numrerat beslut och markera status:

| Beslut | Beskrivning | Implementeras i denna story? | Var (fil/rad)? |
|--------|-------------|------------------------------|----------------|
| D1 | ... | Ja / Nej (uppskjuten till S<X>) | ... |

**Alla "Ja"-beslut MÅSTE ha en implementation i denna story.** "Nej"-beslut kräver explicit beslut och backlog-rad för uppföljning.

**Om ingen tidigare designstory finns:** Skriv "N/A -- ingen tidigare arkitekturdesign".
```

**Ändring 3: `.claude/rules/prisma.md` -- ny RLS-regel**

Lägg till:

```markdown
## RLS vid ny kärndomän (OBLIGATORISKT)

Ny kärndomän (repository obligatoriskt) = RLS-migration i FÖRSTA commiten, inte skjuten till senare.

- ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- READ/INSERT/UPDATE-policies för alla relevanta roller
- RLS-bevistest i `src/__tests__/rls/<domain>.test.ts`
- Om kolumn-nivå-permissions behövs: se `docs/architecture/column-level-grant-rls-pattern.md`

**Varför:** S35-1 implementerade Conversation utan RLS. Tabellerna deployades till prod. Även om feature flag skyddade användare var defense-in-depth-skyddet ett hål. Backa alltid säkerhet i migration-lagret, inte bara i service-lagret.
```

**Ändring 4: Done-fil-mallen i `.claude/rules/auto-assign.md` -- ny sektion**

Lägg till efter "Verktyg använda":

```markdown
- **Arkitekturcoverage** (OBLIGATORISKT om story implementerar tidigare design):
  - Designdokument: `<länk>`
  - Alla numrerade beslut implementerade: ja / nej (lista gap om nej)
  - Varför: tvingar explicit coverage-verifiering istället för att anta att "acceptanskriterier räcker".
```

**Acceptanskriterier:**
- [ ] `.claude/rules/autonomous-sprint.md` har arkitekturcoverage-rad i Review-matris
- [ ] `docs/plans/TEMPLATE.md` har Arkitekturcoverage-sektion
- [ ] `.claude/rules/prisma.md` har RLS-vid-ny-kärndomän-regel
- [ ] `.claude/rules/auto-assign.md` done-fil-krav har Arkitekturcoverage-rad
- [ ] `npm run check:all` grön

**Avgränsning:** Ingen automation som verifierar coverage automatiskt (hook eller script) — det är framtida förbättring. Denna story tvingar manuell disciplin via docs + subagent-prompt.

**Reviews:** code-reviewer (docs-only, trivial — kan skippas enligt review-gating)

---

## Framtida stories (skiss)

- **S36-1:** Automatiserad coverage-check — script som jämför `docs/architecture/*.md` D-beslut mot relaterade implementations-filer och flaggar gap. Pre-commit-hook. (Större arbete, kanske i S37+.)
- **S36-2:** "Designbeslut-kod-koppling"-pattern formaliserat i patterns.md. Hur refererar man konkret från kod till D-beslut (code comment? separat manifest?).

---

## Exekveringsplan

```
S36-0 (30-45 min, process-tweaks) -> [fler stories planeras efter]
```

## Definition of Done (sprintnivå)

- [ ] S36-0 merged
- [ ] S35-retron refererar till S36-0 som processändringen som lärdes
