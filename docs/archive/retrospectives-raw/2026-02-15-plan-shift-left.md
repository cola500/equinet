# Retrospektiv: Plan Shift Left -- Kvalitetstänk före implementation

**Datum:** 2026-02-15
**Scope:** Konsolidera agenter, automatisera kvalitetscheckar, flytta kvalitetstänket till planeringsfasen

---

## Resultat

- 6 ändrade filer, 1 ny fil, 4 borttagna filer, 0 migrationer
- 0 nya tester (1707 totalt, inga regressioner)
- Typecheck = 0 errors
- Netto: -1159 rader (massiv förenkling)
- Tid: ~1 session (2 commits)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Agenter | `data-architect.md`, `performance-guardian.md`, `quality-gate.md`, `test-lead.md` (borttagna) | 4 agenter borttagna |
| Agenter | `tech-architect.md` | Utökad med data-architect + performance-guardian ansvar |
| Skills | `SKILL.md` | Nytt steg 1b: planvalidering innan implementation |
| CI | `quality-gates.yml` | Coverage 70%, npm audit, svenska tecken-check |
| Docs | `AGENTS.md`, `CLAUDE.md` | Uppdaterad dokumentation för 3 agenter |
| Docs | `docs/plans/TEMPLATE.md` | Ny plan-mall med kvalitetsdimensioner |

## Vad gick bra

### 1. Massiv förenkling utan funktionsförlust
7 agenter -> 3 agenter. 1191 rader borttagna. tech-architect absorberade data-architect och performance-guardian utan att tappa kapacitet. Principen "automatiserade kontroller > manuella agent-anrop" håller -- lint, coverage och svenska tecken-check behöver inte en agent.

### 2. Rätt abstraktionsnivå för kvalitetskontroll
Objektiva regler (lint, coverage, svenska) automatiseras i CI och `/implement`. Subjektiva bedömningar (säkerhet, arkitektur, UX) förblir agenter. Tydlig gräns som förhindrar agent-bloat.

### 3. Icke-blockerande planvalidering
Steg 1b i `/implement` flaggar kvalitetsluckor men stoppar inte implementationen. Det är en påminnelse, inte en gate. Detta respekterar arbetsflödet -- planen är redan godkänd av användaren.

## Vad kan förbättras

### 1. Plan-mallen används inte automatiskt
`docs/plans/TEMPLATE.md` är en passiv referens. Ingen mekanism tvingar att den används vid nya planer. Risk att den glöms bort.

**Prioritet:** LÅG -- Steg 1b i `/implement` fångar samma saker oavsett om mallen användes vid planering.

### 2. Svenska tecken i äldre retro-filer
Pre-push-hooken flaggar svenska tecken-problem i äldre retrospektiv-filer (skrivna innan `check:swedish` infördes). Dessa är kända men oåtgärdade.

**Prioritet:** LÅG -- Kosmetiskt, påverkar inte funktionalitet.

## Patterns att spara

### Automatisera objektiva regler, agentera subjektiva bedömningar
Objektiva regler (lint, typecheck, coverage, svenska tecken) ska vara automatiserade i CI/hooks/skills. Agenter ska bara användas för bedömningar som kräver kontext och resonemang (säkerhetsgranskningar, arkitekturbeslut, UX-utvärderingar). Om en regel kan uttryckas som "är X sant/falskt?" -> automatisera den.

### Shift-left via icke-blockerande checklistor
Lägg kvalitetschecklistor tidigt i flödet (planering, pre-implementation) men gör dem icke-blockerande. De påminner om dimensioner som lätt glöms (rate limiting, `.strict()`, svenska strängar) utan att sakta ner arbetsflödet.

## Lärandeeffekt

**Nyckelinsikt:** Kvalitetsproblem som hittas sent (saknad rate limiting, fel språk i felmeddelanden, glömd `.strict()`) är billigare att förebygga med en 30-sekunders plansanning än att fixa efter implementation. Steg 1b kostar nästan ingenting men fångar de vanligaste misstagen.
