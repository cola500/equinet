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

### S36-1: "Vad jag INTE kollade"-rapportering i review-subagenter

**Prioritet:** 1
**Effort:** 30-45 min
**Domän:** docs (`.claude/agents/` eller motsvarande subagent-konfig)

S35-1 avslöjade att subagenter rapporterar bara det de kollat, inte det de missat. Security-reviewer hittade 3 lokala issues men missade hela RLS-coverage-gapet eftersom den inte fick referens till S35-0-designen. Om reviewern hade rapporterat "Jag kollade inte RLS-coverage eftersom jag inte fick referens till designdokumentet" hade gapet upptäckts direkt.

**Smal scope:** bara prompt-uppdatering på 4 befintliga subagenter. Ingen ny konfiguration, inget manifest, ingen automation. Testa om metacognition-rapportering räcker innan vi bygger större struktur.

**Aktualitet verifierad:**
- Grep efter subagent-definitioner i `.claude/agents/` eller `.claude/rules/` — bekräfta att prompts existerar och kan uppdateras
- Verifiera att inga av de 4 redan rapporterar "gap"-sektion

**Implementation:**

**Steg 1: Hitta subagent-definitioner**

Grep efter konfiguration av: `code-reviewer`, `security-reviewer`, `tech-architect`, `cx-ux-reviewer`.

**Steg 2: Uppdatera review-output-struktur**

Varje subagent ska instrueras att rapportera tre sektioner istället för en:

1. **Fynd** (som idag): blockers, majors, minors, suggestions
2. **Täckning** (ny): konkret lista på vad som granskades — "Kollade: auth-guard i route, Zod-schema, select-block för alla 4 queries, RLS-policy i migration"
3. **Gap** (ny): vad som INTE kollades + varför — "Kollade inte: RLS-bevistest (fil saknas), designcoverage (inget arkitekturdokument refererat), prestanda (utanför scope)"

**Steg 3: Testa på nästa icke-trivial story**

Första story efter S36-1 ska rapportera alla tre sektioner. Om gaps framträder som inte var avsedda → fånga i retro.

**Acceptanskriterier:**
- [ ] Alla 4 subagent-definitioner uppdaterade med Täckning + Gap-sektioner i output
- [ ] Prompt-texten nämner explicit "rapportera även vad du INTE kollade och varför"
- [ ] `npm run check:all` grön

**Avgränsning (ej i scope):**
- Review-manifest per story-typ (kan bli S36-2 villkorligt)
- Automatiserad coverage-check (kan bli S37-x, större arbete)

**Hypotes som testas:** Metacognition-rapportering i subagenter räcker för att fånga missade aspekter. Om sant → bygg inte manifest. Om falskt → S36-2 formaliserar manifestet.

**Reviews:** code-reviewer (docs-only, trivial — kan skippas enligt review-gating)

---

### S36-2: Visuell verifiering av S35 messaging-flöde

**Prioritet:** 2
**Effort:** 1-2h
**Domän:** webb (Playwright MCP + cx-ux-reviewer, ingen kodändring förväntad)

S35 levererade messaging-MVP:en (kund + leverantör + push) bakom feature flag. Ingen har gjort systematisk visuell audit likt S33-1 gjorde för iOS. Flaggan får inte slås på innan vi sett flödet i ögonen -- bolagskritisk first impression.

**Aktualitet verifierad:**
- Grep `messaging`-flag-användning för att bekräfta vilka komponenter som renderas
- Verifiera att `MessagingDialog`, `MessagingSection`, inkorg + tråd-vy finns
- Bekräfta att `messaging`-flaggan kan slås på via FEATURE_MESSAGING env i dev

**Scope:**
- **Webb-only.** iOS är WebView i Slice 1 -- samma kod, samma rendering. Native-verifiering ger lågt värde tills native messaging-vy byggs (framtida slice).
- **Kund + leverantör-flöde.** Båda är nya, båda är primära personer.
- **Push verifieras som trigger + payload.** Inte end-to-end (kräver TestFlight). Kolla `MessageNotifier` i loggar.

**Implementation (följer S33-1-audit-mönstret):**

**Steg 1: Setup worktree dev-server**
- Skapa worktree om inte redan finns (parallellitet mot annan dev)
- `FEATURE_MESSAGING=true npm run dev` på port 3001
- Seed testdata: bokning mellan kund + leverantör (eller använd befintlig)

**Steg 2: Visuell audit per vy (förväntat 4-5 vyer)**

Kund-sidan:
- BookingCard med messaging-sektion
- MessagingDialog (öppen + tomt läge + med historik)

Leverantör-sidan:
- `/provider/messages` inkorg-vy (tomt läge + med olästa + med lästa)
- Tråd-vy (`/provider/bookings/[id]/messages` eller motsvarande)
- BottomTabBar med unread-badge

Per vy:
- Playwright MCP screenshot
- Accessibility tree
- Notera: layout, kontrast, fokus-management, tom/loading/error-states, svenska strängar

**Steg 3: cx-ux-reviewer subagent**

Kör på nya komponenter: `MessagingDialog.tsx`, `MessagingSection.tsx` + inkorg + tråd-vy (sökvägar verifieras i aktualitet).

Förväntad review-output (nu med S36-1-struktur): **Fynd + Täckning + Gap**.

**Steg 4: Push-verifiering**
- Skicka meddelande som kund → kolla `logger.info('message.notified')` + `MessageNotifier`-payload i dev-loggar
- Verifiera deep-link-URL i payload
- Dokumentera gap: "faktisk push-leverans testas pre-launch via TestFlight"

**Steg 5: Sammanställ rapport**

`docs/retrospectives/<datum>-messaging-ux-audit.md` med:
- Per vy: screenshot + status (bra / mindre fynd / större fynd)
- Fynd-tabell: kategori + allvar + beskrivning + fix
- Topp-3 förbättringar
- Push-verifiering: trigger + payload OK eller ej

**Steg 6: Triage fynd**
- **Blocker:** stoppa flag-rollout, fixa i ny story eller här
- **Major:** backlog-rad eller ny story
- **Minor (<15 min/fix):** fixa direkt i denna story
- **Observation:** dokumentera i rapport

**Acceptanskriterier:**
- [ ] Alla 4-5 messaging-vyer har screenshot + accessibility tree
- [ ] cx-ux-reviewer körd på minst 2 komponenter (rapport med Täckning + Gap)
- [ ] Audit-rapport i `docs/retrospectives/`
- [ ] Push-trigger + payload verifierade i dev-loggar
- [ ] Minor-fynd (<15 min) fixade direkt eller dokumenterade som minor backlog-rader
- [ ] Major-fynd har backlog-rader eller nya stories
- [ ] `npm run check:all` grön
- [ ] **Beslut om flag-rollout:** redo / blockerad (ange varför)

**Reviews:** cx-ux-reviewer (primär, för komponent-nivå), code-reviewer om minor-fixar görs

**Docs-matris:**
- `docs/retrospectives/<datum>-messaging-ux-audit.md` (ny)
- Hjälpartikel `src/lib/help/articles/customer/meddelanden.md` uppdateras om fynd påverkar användarupplevelsen
- Eventuell ny `src/lib/help/articles/provider/inkorg.md` om leverantör-flödet saknar hjälp

**Arkitekturcoverage (S36-0-testkörning):**

Denna story bygger på messaging-implementationen från S35. Inget nytt arkitekturdokument, men S35-0-designen finns i `docs/architecture/messaging-domain.md`. Audit-fynd ska verifieras mot designen — "stämmer UX-beteendet med vad designen antyder?"

---

## Framtida stories (skiss)

- **S36-3 (villkorlig):** Review-manifest per story-typ. Bygg BARA om S36-1:s metacognition-rapportering inte räcker under 5-10 framtida stories.
- **S37-x:** Automatiserad coverage-check — script som jämför `docs/architecture/*.md` D-beslut mot relaterade implementations-filer.
- **S37-x:** "Designbeslut-kod-koppling"-pattern formaliserat i patterns.md.

---

## Exekveringsplan

```
S36-0 (30-45 min, arkitekturcoverage) -> S36-1 (30-45 min, metacognition-prompts)
```

## Definition of Done (sprintnivå)

- [ ] S36-0 merged (klar)
- [ ] S36-1 merged
- [ ] S35-retron refererar till S36-0 som processändringen som lärdes
