---
title: "Process-kost-retro: Vad används, vad skräpar?"
description: "Databaserad genomgång av processinfrastrukturen — hooks, rules, reviews. Mål: friska av det som inte ger ROI."
category: retro
status: active
last_updated: 2026-04-22
tags: [retro, process, tokens, efficiency, trimming]
sections:
  - Triggande observation
  - Data insamlad
  - Analys per process-element
  - Rekommendationer
  - Mät-plan framåt
  - Lärdomar om reflektionen själv
---

# Process-kost-retro: Vad används, vad skräpar?

**Datum:** 2026-04-22
**Initierat av:** Johan efter att ha noterat att S51-0.1 (en 45-min hotfix) förbrukade ~300k tokens på två djävulens-advokat-reviews utan att hitta något launch-blocker.

---

## Triggande observation

Efter S51-0.1 reflekterade Johan: *"Vi försöker jobba så effektivt som möjligt. Blivit procedurtunga nu. Ska vi utvärdera?"*

Hypotes: **processen har vuxit sig större än produkten** senaste 10 sprintarna. Självtestings-infrastruktur, enforcement-hooks, review-matriser, djävulens-advokat-reviews — alla gör något — men kostnaden per story har ökat medan lanseringen försenas.

Målet: **frisera** processen — behåll vad som bevisligen ger värde, ta bort eller konsolidera vad som är ceremoni.

---

## Data insamlad

Tre parallella Explore-agenter gick igenom:

1. **Hook-nytta** (11 hooks i `scripts/check-*.sh` + `.husky/`)
2. **Rules-nytta** (22 filer i `.claude/rules/`)
3. **Review-ROI** (5 subagent-typer, S42-S51 done-filer)

### Hooks (11 inventerade)

| Kategori | Antal | Kommentar |
|----------|-------|-----------|
| Behåll | 9 | Triggade falskt 0 ggr under S47-S50, overrides alltid motiverade (11 totalt, alla disciplinerade) |
| Trimma | 2 | (1) `check-multi-commit` körs i BÅDE pre-commit och pre-push med samma regex, (2) `gh-pr-merge-wrapper` är bara social norm — Dev self-mergade 4×S47 + 2×S51 ändå |
| Radera | 0 | Alla har bevisad funktion |

**Empirisk insikt:** Enforcement-hooks är KOSTNADS-EFFEKTIVA. De triggar sällan, fångar verkligt fel, kostar ~0.5s per commit.

### Rules (22 inventerade)

| Klassificering | Antal | Exempel |
|----------------|-------|---------|
| Aktiva (refererade sista 10 sprintarna) | 4 | `code-map.md`, `prisma.md`, `testing.md`, `e2e.md` |
| Latenta (refs finns, kanske via subagent-prompts) | 10 | `feature-flags.md`, `ios-learnings.md`, `commit-strategy.md` |
| **Döda** (≤7 referenser på 10 sprintar) | **8** | `e2e-playbook.md` (1 ref), `rls-learnings.md` (3), `api-routes.md` (7) |
| Meta (handlar om processen själv) | 5 | `team-workflow.md`, `autonomous-sprint.md`, `tech-lead.md`, `parallel-sessions.md`, `auto-assign.md` |

**Största problemet — Meta-filerna överlappar:** Fem filer dokumenterar samma "hur arbetar vi i agent-teamet"-tema. Ingen är refererad från CLAUDE.md Snabbreferens. Konsolidering rimlig.

### Review-ROI (5 subagent-typer, S42-S51)

| Agent | Körningar | Träffrate (Blocker+Major) | Bedömning |
|-------|-----------|---------------------------|-----------|
| `code-reviewer` | 15 | 73% | Högt värde, men **triviala stories bör skippa** |
| `security-reviewer` | 5 | 60% | Måttligt — kör på auth/API, skip på scripts/docs |
| `cx-ux-reviewer` | 1 | 200% | Hittar alltid. Kör när `.tsx` med UI-handlers ändras |
| `ios-expert` | 4 | 100% | Obligatorisk för Swift + WebView |
| `tech-architect` | 3 | 100% | Kör på plan-doc + review-matrix-ändringar |

**Samtliga subagenter har hög ROI när de körs.** Problemet är inte vilka agenter — det är hur OFTA de körs för att säga "OK inget att fixa".

### Djävulens-advokat-reviews (NY 2026-04-22)

- **Antal körningar:** 2 (S51-0 och S51-0.1)
- **Tokens förbrukade:** ~300k
- **Faktiska launch-blockers hittade:** 0
- **Faktiska buggar hittade:** 2 (M1 factor-status-filter, cross-limiter-reset-bugg i dev)
- **Edge-case attack-vektorer:** 3 (kräver session-hijack — låg risk)
- **Arkitekturskuld noterad:** 4 punkter (low prio)

**Negativ ROI**: 300k tokens för att hitta 2 buggar som hade upptäckts inom 30 min av normal användning/testning, och som INGEN av var launch-blocker.

---

## Analys per process-element

### Vad är **definitivt värt sin kostnad**

1. **Enforcement-hooks** — snabba, disciplinerade overrides, fångar verkliga brott. Den största ROI-vinnaren.
2. **Subagent-reviews i rätt kontext** — varje agenttyp har hög hit-rate PER KÖRNING. Problemet är mängd, inte typ.
3. **Review-matrisen** (`review-matrix.md`) — maskinläsbar, styr hooken, minimal duplikation.
4. **TDD + BDD dual-loop** — tester FÖRST förhindrar återkommande buggar.
5. **Station-flödet** (PLAN → RED → GREEN → REVIEW → VERIFY → MERGE) — gemensam språkgrund för alla stories.

### Vad är **tveksam ROI**

1. **Djävulens-advokat-post-merge-reviews** — introducerat idag, redan negativ ROI. Bör begränsas till auth/schema/payment-kritiska merges.
2. **Review-körning på triviala stories** — code-reviewer kördes 15 ggr men 4 var rena OK:s. Om trivial-gating hade skippats: 27% tokens sparade.
3. **5 meta-filer om samma team-process** — `team-workflow.md`, `autonomous-sprint.md`, `tech-lead.md`, `parallel-sessions.md`, `auto-assign.md`. Kognitiv kostnad att hålla dem synkade.

### Vad är **skräp eller nära det**

1. **8 döda rules-filer** — `e2e-playbook.md` (1 ref), `api-routes.md` (7, men täckt av `review-matrix.md`), `code-review-checklist.md` (överlappar med `review-manifest.md`), `rls-learnings.md`, `offline-learnings.md`, `ui-components.md`, `documentation.md`.
2. **Duplicerad `check-multi-commit`** — körs i både pre-commit och pre-push.
3. **`gh-pr-merge.sh`-scriptet** — social norm, inte enforcement. Dev self-merged genom det 6+ gånger.

---

## Rekommendationer

Sorterade efter effort × payoff:

### Nu (30-45 min total effort)

**R1. Begränsa djävulens-advokat-review till specifika triggers.** Per memory från idag: tech-lead-review med skepsis-prompt är värdefull, men inte på varje merge. Kör bara när:
- Auth/säkerhetskod ändrades (`src/lib/*auth*`, `/api/admin/*`, `middleware.ts`)
- Schema-ändring (`prisma/schema.prisma`)
- Payment-kod (`/api/.../payment*`, `StripePaymentGateway*`)
- Föregående review hittade Blocker/Major (något djupare kan finnas)

För övriga stories: läs done-fil + git diff, spot-check 1-2 filer. Inga auto-subagenter.

**R2. Skärp trivial-gating i `team-workflow.md` Station 4.** Lägg till explicit regel: **om story är <15 min OCH ≤1 fil OCH inga nya routes/schema: skippa ALLA subagent-reviews, även code-reviewer.** Dev:s egen review räcker.

**R3. Flytta `check-multi-commit` till bara pre-push.** Spara 0.5s per commit × ~10 commits per dag.

**R4. Arkivera 3 uppenbart döda rules-filer** till `docs/archive/rules/`:
- `e2e-playbook.md` (1 ref — integrera i `e2e.md`)
- `code-review-checklist.md` (överlappar med `review-manifest.md`)
- `offline-learnings.md` (7 refs, men bara gamla)

### Inom S52-S53 (2-4h total effort)

**R5. Konsolidera meta-filerna.** De 5 meta-filerna (team-workflow, autonomous-sprint, tech-lead, parallel-sessions, auto-assign) blir **en fil** (`team-process.md`) med tre sektioner: (a) stationsflödet, (b) autonomous mode, (c) parallella sessioner. Resten arkiveras eller blir korta sektioner.

**R6. Granska 5 kvarvarande döda rules:** `rls-learnings.md`, `ui-components.md`, `documentation.md`, `api-routes.md`, `story-refinement.md`. För varje: behåll (refaktorera), slå ihop, eller arkivera.

### Senare (post-launch)

**R7. Gör `gh-pr-merge` till faktisk enforcement** eller ta bort det helt. Om det bara är social norm och Dev ignorerar det → mät inte värdet i att ha skriptet.

**R8. Utvärdera Seven Dimensions + teater-metodik efter faktisk användning.** Båda introducerade senaste månaden. Om inte använda 2x till S55 → fundera på om de är naturliga eller påtvingade.

---

## Mät-plan framåt

För att undvika processens-tillväxt-återkomst:

| Metric | Nuläge | Mål S55 | Mätning |
|--------|--------|---------|---------|
| Tokens per story (review + implementation) | Inte mätt, estimat 200-400k | <150k avg | Lägg `tokens-used: <n>` i done-fil |
| Subagent-körningar per story | ~2-3 genomsnitt | ≤2 avg, 0 för trivial | Räkna från done-fil |
| Rules-filer | 22 | ≤15 | `ls .claude/rules/*.md \| wc -l` |
| Meta-filer | 5 | 1-2 | Samma |
| Procedurbrott | 0-2/sprint | 0-2/sprint | Retros |

**Vi bör INTE mäta:** hur många hooks finns (inte själva ändamålet), hur många rules-filer skrivs (samma), antal commits (redan ökat pga process-arbete, ej produkt).

---

## Lärdomar om reflektionen själv

**Varför upptäckte vi detta först nu?** Hooks och rules är "free" när de skrivs — ingen blockerar att lägga till en till. Men varje tillägg ökar kognitiv overhead för alla framtida sessioner. Vi saknade en **deletions-rytm**. Förslag: kör denna typ av retro en gång per 10 sprintar (dvs S61 nästa) oavsett.

**Agile-lärdom:** Process ska tjäna leverans, inte vara leverans. Vi byggde self-testing v3 + process-hardening 2 parallellt med feature-arbete — bra ambition, men tillväxtkostnaden blir synlig först när man gör inventering som denna.

**Konkret misstag i min (tech lead) praxis:** Jag införde djävulens-advokat-post-merge-review idag som memory, men körde två stycken innan retro visade att den har negativ ROI utanför specifika triggers. Framtida memory-regler bör ha inbyggd trigger-avgränsning, inte vara "gör alltid".

---

## Beslut (att fyllas i av Johan)

- [ ] R1: Begränsa djävulens-advokat — ja / nej / modifierat
- [ ] R2: Skärp trivial-gating — ja / nej / modifierat
- [ ] R3: Flytta `check-multi-commit` — ja / nej
- [ ] R4: Arkivera 3 döda rules — ja / nej / lista
- [ ] R5: Konsolidera meta-filer — ja / nej / plan
- [ ] R6: Granska kvarvarande — ja / nej
- [ ] R7: `gh-pr-merge` — enforcement / borta / lämna
- [ ] R8: Utvärdera Seven Dimensions + teater vid S55

**Nästa steg efter beslut:** Om R1-R4 godkänns → skapa S51-0.2 (process-trim, 30-45 min) eller lägg i S52.
