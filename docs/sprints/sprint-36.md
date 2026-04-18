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

### S36-3: Tech lead-på-feature-branch-varning

**Prioritet:** 3
**Effort:** 20-30 min
**Domän:** infra (`scripts/check-docs-updated.sh` eller ny hook)

S33-0 Fas 4-regeln ("tech lead räknas som session") bröts inom 24h av regeln själv (tech lead committade på dev:s branch utan att kolla `git branch --show-current`). Regeln är deklarativ — den funkar bara om någon läser och kommer ihåg. Konverterar till körbar gate.

**Princip:** mekanisk varning vid "fel tillstånd", inte blockering. Syftet är att fånga glömska, inte hindra avsiktlig användning.

**Aktualitet verifierad:**
- Kolla att `.husky/pre-commit` fortfarande kör `scripts/check-docs-updated.sh`
- Verifiera att `git config user.email` matchar Johan för hooken att trigga

**Implementation:**

**Steg 1: Utöka `scripts/check-docs-updated.sh`**

Ny check-sektion:

```bash
# Tech lead-på-feature-branch-varning
# Mönstret: tech lead (Johan) committar på feature/s\d+-branch
# OCH committen rör BARA lifecycle-docs som tech lead normalt hanterar
# → Varna (ej blockera): använd worktree istället

BRANCH=$(git rev-parse --abbrev-ref HEAD)
AUTHOR_EMAIL=$(git config user.email)

if [[ "$BRANCH" =~ ^feature/s[0-9] ]] && [[ "$AUTHOR_EMAIL" == "johan@jaernfoten.se" ]]; then
  STAGED=$(git diff --cached --name-only)
  TECH_LEAD_PATHS=$(echo "$STAGED" | grep -E "^docs/sprints/(status\.md|sprint-.*\.md)|^docs/ideas/|^docs/retrospectives/|^docs/architecture/patterns\.md" || true)
  NON_TECH_LEAD=$(echo "$STAGED" | grep -v -E "^docs/sprints/(status\.md|sprint-.*\.md)|^docs/ideas/|^docs/retrospectives/|^docs/architecture/patterns\.md" || true)

  if [ -n "$TECH_LEAD_PATHS" ] && [ -z "$NON_TECH_LEAD" ]; then
    echo "⚠️  Tech lead-varning: du committar på feature branch '$BRANCH' men"
    echo "   ändringarna rör bara lifecycle-docs (sprint/status/ideas/retros)."
    echo "   Det här är dev:s branch -- använd worktree från main istället:"
    echo ""
    echo "     git worktree add ../equinet-techlead main"
    echo "     cd ../equinet-techlead"
    echo ""
    echo "   Om detta är avsiktligt: fortsätt (varningen blockerar inte)."
    echo ""
  fi
fi
```

**Steg 2: Testa lokalt (positivt + negativt fall)**
- Skapa feature branch + committa ändring i `docs/sprints/status.md` → varning visas
- På main: committa samma fil → ingen varning
- På feature branch: committa kod i `src/` → ingen varning (inte ren lifecycle-doc)

**Steg 3: Dokumentera**

Uppdatera `.claude/rules/parallel-sessions.md` med referens till hooken:

```markdown
**Automatiserad varning:** `scripts/check-docs-updated.sh` varnar om tech lead committar lifecycle-docs på feature branch. Varningen blockerar inte -- den påminner bara att worktree är säkrare vägen.
```

**Acceptanskriterier:**
- [ ] Hook varnar på feature branch + tech lead-email + bara lifecycle-docs
- [ ] Hook varnar INTE på main
- [ ] Hook varnar INTE när kod ändras (inte rent docs-commit)
- [ ] `parallel-sessions.md` uppdaterad med hook-referens
- [ ] Manuell test: skapa feature branch, committa status.md → se varning
- [ ] `npm run check:all` grön

**Avgränsning:** Ingen blockering — bara varning. Risk för falska positiv är acceptabel eftersom varning är mjuk.

**Reviews:** code-reviewer (trivial scripting, kan skippas enligt review-gating)

**Arkitekturcoverage:** N/A (ingen tidigare designstory).

---

### S36-4: Docs-matris compliance-check post-merge

**Prioritet:** 4
**Effort:** 1-1.5h
**Domän:** infra (`scripts/` + `generate-metrics.sh`)

Done-fil säger t.ex. "Ingen docs-uppdatering (UI-only)" men ingen verifierar att påståendet stämmer mot docs-matrisen i `.claude/rules/auto-assign.md`. Över tid driftar dokumentation tyst. Script som kör efter merge och rapporterar gap.

**Aktualitet verifierad:**
- Läs `.claude/rules/auto-assign.md` Docs-matris för aktuella story-typ-regler
- Verifiera att `generate-metrics.sh` finns och kan utökas

**Implementation:**

**Steg 1: Skapa `scripts/check-docs-compliance.sh`**

Skriptet:
1. Loopa över alla `docs/done/*.md` (eller senaste N för effektivitet)
2. Identifiera story-typ från done-filen (t.ex. "iOS UX-fix", "ny API route", "audit")
3. Mappa story-typ → förväntade docs enligt matrisen i `auto-assign.md`
4. Verifiera att relevanta docs ändrats i commit-intervallet (grep `git log -p` för fil-paths)
5. Output: lista gap i format `S34-1: typ=iOS UX, förväntat=ios-learnings.md, faktisk=inte ändrad → MISSING`

Story-typ-detektering kan vara pragmatisk (keyword-matching i done-fil-titel: "UX" → "Beteendeändring", "API" → "Ny API route" etc.). Perfekt inte krävs.

**Steg 2: Integrera i `generate-metrics.sh`**

Lägg till ny sektion i metrics-rapporten:

```markdown
## M7: Docs-compliance

_Stories där förväntade docs enligt Docs-matrisen inte uppdaterats._

- Totalt kontrollerade: 42
- Gap identifierade: 3
  - S34-1: iOS UX-fix men ios-learnings.md ej uppdaterad
  - S35-2: beteendeändring i provider-UI men testing-guide.md ej uppdaterad
  - S36-2: audit-story ok (N/A)
```

**Steg 3: Dokumentera i `.claude/rules/documentation.md`**

Lägg till not: "`npm run metrics:report` identifierar docs-matris-gap retroaktivt."

**Acceptanskriterier:**
- [ ] `scripts/check-docs-compliance.sh` fungerar fristående
- [ ] `generate-metrics.sh` kör compliance-check som M7-sektion
- [ ] Minst en historisk story flaggas som gap (annars matrisen redundant eller check buggad)
- [ ] Falska positiv-rate är rimlig (ej >50% av flaggar är felaktiga)
- [ ] `npm run check:all` grön

**Avgränsning:**
- Ingen pre-commit blockering. Rapport i metrics-rapport räcker — retroaktiv översikt.
- Story-typ-detektering är pragmatisk, inte perfekt. Minors acceptabla.

**Reviews:** code-reviewer (trivial script, kan skippas om <30 min)

**Arkitekturcoverage:** N/A.

---

### S36-5: Modellval-avvikelse-larm i metrics:report

**Prioritet:** 5
**Effort:** 1h
**Domän:** infra (`scripts/generate-metrics.sh`)

`Modell:`-fält i done-fil (infört i S33-0) samlar data men ingen larmar om avvikelse från memory-regeln ("Opus för säkerhetskritisk design, Sonnet för implementation"). Script som listar mismatch hjälper oss upptäcka modellval-fel innan de ger konsekvenser som S35-1.

**Aktualitet verifierad:**
- Verifiera att `Modell:`-fältet finns i senare done-filer (S33+)
- Läs modellval-regeln i memory (`project_model_selection_metrics.md`)

**Implementation:**

**Steg 1: Definiera regeln i kod**

Skapa `scripts/model-selection-rules.txt` (eller inline i script):

```
# Format: story_type,expected_model
architecture,opus
security-implementation,opus
cross-cutting,opus
docs,sonnet
ios-ux,sonnet
trivial,haiku
```

Story-typ-detektering: keyword-matching på done-fil-titel + story-beskrivning (pragmatisk).

**Steg 2: Extend `generate-metrics.sh`**

Ny sektion M8:

```markdown
## M8: Modellval-avvikelse

_Stories där modellval avviker från memory-regeln._

- Totalt kontrollerade (stories med Modell-fält): 24
- Avvikelser: 1
  - S35-1: typ=security-implementation, förväntat=opus, faktisk=sonnet → MISMATCH
    (Lärdom: gav upphov till S35-1.5 hotfix)
```

**Steg 3: Memory-uppdatering**

Lägg till pekare i `project_model_selection_metrics.md`: "Avvikelser upptäcks automatiskt via `npm run metrics:report` M8-sektion."

**Acceptanskriterier:**
- [ ] M8-sektion i metrics-rapport
- [ ] S35-1 flaggas som avvikelse (test av regeln)
- [ ] Minst 10 stories kontrolleras retroaktivt
- [ ] `npm run check:all` grön

**Avgränsning:**
- Rapport-only, ingen blockering. Tech lead granskar i retro.
- Story-typ-detektering är pragmatisk.

**Reviews:** code-reviewer (trivial)

**Arkitekturcoverage:** N/A.

---

### S36-6: Seven Dimensions-tvingad slicing-trigger

**Prioritet:** 6
**Effort:** 45 min
**Domän:** infra (`scripts/check-docs-updated.sh` — utöka)

Nya featureidéer riskerar hamna som backlog-rader utan Seven Dimensions-slicing, särskilt om effort är stort. Pre-commit hook varnar (inte blockerar) när status.md-backlog-rad tyder på att slicing saknas.

**Aktualitet verifierad:**
- Verifiera att `.claude/rules/story-refinement.md` finns (infördes i S33)
- Verifiera att `docs/ideas/epic-*.md`-mönstret används (från S33:s testkörning)

**Implementation:**

**Steg 1: Utöka `scripts/check-docs-updated.sh`**

Ny check-sektion (efter tech lead-varningen):

```bash
# Seven Dimensions-slicing-varning
# Mönstret: status.md-commit lägger till backlog-rad med "epic" eller effort >3 dagar
# utan länk till docs/ideas/epic-*.md → varna om slicing saknas
if git diff --cached --name-only | grep -q "^docs/sprints/status.md$"; then
  NEW_LINES=$(git diff --cached docs/sprints/status.md | grep "^+" | grep -v "^+++")
  if echo "$NEW_LINES" | grep -qiE "epic|[3-9] dagar|[0-9]+ sprintar"; then
    if ! echo "$NEW_LINES" | grep -q "docs/ideas/epic-.*\.md"; then
      echo "⚠️  Seven Dimensions-varning: backlog-rad tyder på stort arbete"
      echo "   utan länk till docs/ideas/epic-*.md. Överväg slicing enligt"
      echo "   .claude/rules/story-refinement.md innan commit."
      echo ""
      echo "   Om rad redan är slicad: lägg till länk till epic-dokumentet."
      echo "   Om detta är avsiktligt (liten backlog-post): fortsätt."
      echo ""
    fi
  fi
fi
```

**Steg 2: Testa**
- Lägg till backlog-rad "Epic: X (2 sprintar)" utan länk → varning
- Lägg till backlog-rad "Liten fix (30 min)" → ingen varning
- Lägg till backlog-rad "Epic: X (2 sprintar) [se epic-x.md]" → ingen varning

**Steg 3: Dokumentera**

Uppdatera `.claude/rules/story-refinement.md`: "Pre-commit hook varnar om backlog-rad tyder på oslicat epic."

**Acceptanskriterier:**
- [ ] Hook varnar vid "epic" eller effort >3 dagar utan länk
- [ ] Hook varnar INTE vid små backlog-rader
- [ ] Hook varnar INTE när länk till epic-dokumentet finns
- [ ] `story-refinement.md` uppdaterad med referens
- [ ] `npm run check:all` grön

**Avgränsning:** Varning, inte blockering.

**Reviews:** code-reviewer (trivial scripting, skippbar)

**Arkitekturcoverage:** N/A.

---

## Framtida stories (skiss)

- **S37-x (villkorlig):** Review-manifest per story-typ. Bygg BARA om S36-1:s metacognition-rapportering inte räcker under 5-10 framtida stories. **Första datapunkt från S36-2:** VoiceTextarea-regeln missades av code-reviewer i S35-2 trots projektregel — antyder att manifest kan behövas.
- **S37-x:** Automatiserad coverage-check — script som jämför `docs/architecture/*.md` D-beslut mot relaterade implementations-filer.
- **S37-x:** "Designbeslut-kod-koppling"-pattern formaliserat i patterns.md.
- **S37-x (Messaging-rollout):** Fixa MAJOR-1 (Suspense skeleton) + MAJOR-2 (query-param injection) → sätt `messaging: default: true`.

---

## Exekveringsplan

```
S36-0 (30-45 min, arkitekturcoverage) -> S36-1 (30-45 min, metacognition-prompts)
```

## Definition of Done (sprintnivå)

- [ ] S36-0 merged (klar)
- [ ] S36-1 merged
- [ ] S35-retron refererar till S36-0 som processändringen som lärdes
