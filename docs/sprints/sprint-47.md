---
title: "Sprint 47: Process-hardening 2 — enforcement över hela linjen"
description: "Gör review-matrisen explicit, uppgradera alla process-varningar till blockers, bygg sprint-avslut-review. Adresserar rotorsaker från S43-S46."
category: sprint
status: planned
last_updated: 2026-04-20
tags: [sprint, process, hooks, review-matrix, enforcement, blockers]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 47: Process-hardening 2 — enforcement över hela linjen

## Sprint Overview

**Mål:** Förvandla alla process-regler från dokumentation + varningar till **enforcement med blockers och override**. Efter S47 ska det vara tekniskt omöjligt att hoppa obligatoriska steg i processen utan att explicit markera det i commit-message.

**Triggande händelser:**
- S46-1 (2026-04-20): Dev committade direkt på main + hoppade security-reviewer → 3 säkerhetsblockers nådde commit
- S45 (2026-04-19): Sprint-avslut-commits på main utan feature branch, felaktig PR-info i retro
- S43-S44 (2026-04-19): 8 procedurbrott under 2h, alla fångade retroaktivt

**Johans krav (2026-04-20):** "Högt tempo kräver bra regelverk, bra struktur och att vi **ser till att det regelverket följs och hålls** och att vi **stoppar om det inte gör det**."

**Kritisk princip:** Varningar ignoreras under tempo. Blockers med override-möjlighet behåller tempo när medveten avvikelse sker, men stoppar omedveten drift.

---

## Stories

### S47-0: Explicit review-matris + strukturerat done-fil-format

**Prioritet:** 0
**Effort:** 30-45 min
**Domän:** docs (`.claude/rules/review-matrix.md` + mall-uppdatering)

**Del 1: Extrahera review-matrisen till egen fil**

Skapa `.claude/rules/review-matrix.md` med strikt format. Inga luddiga rader.

```markdown
| Filmönster (glob) | Story-typ | Obligatoriska subagents |
|-------------------|-----------|-------------------------|
| `src/app/api/**/route.ts` (ny/ändrad) | api-route | code-reviewer, security-reviewer |
| `src/app/api/**/route.integration.test.ts` | api-integration-test | code-reviewer |
| `src/components/**/*.tsx` (ny/ändrad) | ui-component | code-reviewer, cx-ux-reviewer |
| `ios/**/*.swift` | ios | code-reviewer, ios-expert |
| `prisma/schema.prisma` | schema-change | tech-architect, code-reviewer |
| `src/lib/auth*.ts` | auth/säkerhet | security-reviewer, code-reviewer |
| `docs/**` (endast) | docs-only | — (kan skippas) |
| Övrigt | default | code-reviewer |
```

Ta bort matris-tabellen ur `autonomous-sprint.md` och ersätt med referens till `review-matrix.md`.

**Del 2: Strukturerat done-fil-format**

Uppdatera done-fil-mall med fast nomenklatur:

```markdown
## Reviews körda

<!-- Strukturerad format för S47-1-hook. Alla obligatoriska måste vara [x]. -->

- [x] code-reviewer — <sammanfattning>
- [x] security-reviewer — <sammanfattning>
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen arkitekturändring)
```

**Acceptanskriterier:**
- [ ] `.claude/rules/review-matrix.md` skapad
- [ ] `autonomous-sprint.md` refererar till nya filen
- [ ] Done-fil-mall uppdaterad
- [ ] Ingen reducering i täckning jämfört med nuvarande matris

**Reviews:** code-reviewer + tech-architect

---

### S47-1: Review-obligatorisk-gate (pre-commit BLOCKER)

**Prioritet:** 1
**Effort:** 1-1.5h
**Domän:** `scripts/check-reviews-done.sh` + `.husky/pre-commit`

**Trigger:** pre-commit med `docs/done/*.md` staged.

**Logik:**
1. Extrahera story-id från done-filnamn
2. Läs changed files på current feature branch (`git diff main..HEAD`)
3. Slå upp story-typ i `.claude/rules/review-matrix.md` per ändrad fil
4. `required_set` = unionen av obligatoriska subagents
5. Parsa done-filens strukturerade "Reviews körda"-sektion
6. `actual_set` = alla `[x]`:ade reviewers
7. Om `required_set ⊆ actual_set`: OK
8. Annars: **BLOCKERA commit** med explicit felmeddelande

**Override:** `[override: <motivering>]` i commit-message.

**Felmeddelande:**
```
[BLOCKER] Reviews saknas i S46-1-done.md:
  Ändrade filer: src/app/api/bookings/[id]/messages/attachments/route.ts (api-route)
  Krävs: code-reviewer, security-reviewer
  Hittat:  code-reviewer
  Saknar:  security-reviewer

Kör: security-reviewer-agent innan commit av done-fil.
Eller: lägg [override: motivering] i commit-message.
```

**Acceptanskriterier:**
- [ ] Hook **blockerar** done-fil-commit när obligatoriska reviews saknas
- [ ] Override-mekanism fungerar
- [ ] Trivial-gating-undantag (effort <15 min + ≤1 fil)
- [ ] Test: S46-1-scenariot → blockerar
- [ ] Test: korrekt done-fil → passerar
- [ ] Test: docs-only story → passerar utan reviews
- [ ] Test: override fungerar

**Reviews:** code-reviewer + security-reviewer

---

### S47-2: Branch-check pre-commit (BLOCKER)

**Prioritet:** 2
**Effort:** 45 min
**Domän:** `scripts/check-branch-for-story.sh` + `.husky/pre-commit`

**Logik:**
1. Current branch = `main`?
2. Finns story `in_progress` i status.md?
3. Commiten rör bara lifecycle-docs (status.md, session-*.md, retros, sprint-*.md)?
4. Om branch=main + story in_progress + **inte** lifecycle-only → **BLOCKERA**

**Override:** `[override: <motivering>]` i commit-message.

**Felmeddelande:**
```
[BLOCKER] Commit på main när story är in_progress.
  Aktiva stories: S47-1
  Current branch: main
  Ändrade filer: src/... (INTE lifecycle-docs)

Byt till feature branch: git checkout feature/s47-1-<namn>
Eller: lägg [override: motivering] i commit-message.
```

**Acceptanskriterier:**
- [ ] Hook **blockerar** commit på main när story in_progress och kod-ändringar staged
- [ ] Undantag för lifecycle-docs (status.md, session-*.md, retros, sprint-*.md)
- [ ] Override fungerar
- [ ] Test: S46-1 direct-main-scenariot → blockerar
- [ ] Test: tech lead uppdaterar status.md → passerar
- [ ] Test: sprint-plan-commit på main → passerar
- [ ] Test: ingen story in_progress → passerar

**Reviews:** code-reviewer

---

### S47-3: Hook-tester (scripts/test-hooks.sh)

**Prioritet:** 3
**Effort:** 1-1.5h
**Domän:** `scripts/test-hooks.sh` + dokumentation

Vi har 6+ hooks. Ingen har test. Om någon ändrar status.md-format → hooks bryts tyst.

**Implementation:**

```bash
#!/usr/bin/env bash
# scripts/test-hooks.sh — kör alla hooks mot kända scenarier.

set -e

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Per hook: minst 2 scenarier (pass + fail) + override-test
test_plan_commit_passes_when_plan_exists() { ... }
test_plan_commit_blocks_when_plan_missing() { ... }
test_plan_commit_override_fungerar() { ... }
test_reviews_done_blocks_missing_security() { ... }
test_branch_check_blocks_main_during_story() { ... }
# osv...
```

**Acceptanskriterier:**
- [ ] Tester för alla 6+ hooks
- [ ] Minst 3 scenarier per hook (pass + fail + override)
- [ ] `npm run test:hooks` eller del av `npm run check:all`
- [ ] Dokumentation: hur lägger man till test för ny hook

**Reviews:** code-reviewer

---

### S47-4: Uppgradera S45-varningar till BLOCKERS med override

**Prioritet:** 4
**Effort:** 45-60 min
**Domän:** `scripts/check-plan-commit.sh`, `scripts/check-sprint-closure.sh`, `.husky/pre-push` (multi-commit-gate), `scripts/check-own-pr-merge.sh`

**Kärnprincip:** Alla S45-hooks är idag varningar (`exit 0`). Under tempo ignoreras varningar. Uppgradera till blockers med override.

**Per hook:**

| Hook | Nuvarande | Ny (med override) |
|------|-----------|-------------------|
| `check-plan-commit.sh` (S45-0) | Varnar om plan saknas | **Blockerar** om plan saknas + `[override]` fungerar |
| `check-sprint-closure.sh` (S45-1) | Varnar om retro saknas | **Blockerar** om retro saknas + override |
| Multi-commit-gate (S45-2) | Varnar om <2 commits | **Blockerar** om <2 commits + override |
| `check-own-pr-merge.sh` (S45-3) | Varnar + auto-fortsätt i non-interactive | **Blockerar i non-interactive** + kräver `--override`-flagga |

**Gemensamt override-mönster:**

```bash
if ! grep -q '\[override:' <<< "$COMMIT_MSG"; then
  echo "[BLOCKER] ..."
  exit 1
fi
echo "[OVERRIDE] Anledning: $(echo "$COMMIT_MSG" | grep -oE '\[override: [^]]+\]')"
exit 0
```

**Viktigt:** Override kräver **motivering efter `override:`**. `[override]` utan text räknas inte — tvingar explicit tanke.

**Acceptanskriterier:**
- [ ] Alla 4 S45-hooks uppgraderade till blockers
- [ ] Override-mekanism med obligatorisk motivering
- [ ] Tester för varje (pass / block / override)
- [ ] Dokumentation i `.claude/rules/commit-strategy.md` om override-användning
- [ ] Git log blir revisionsbart (alla overrides synliga)

**Reviews:** code-reviewer

---

### S47-5: Sprint-avslut-review-gate

**Prioritet:** 5
**Effort:** 30-45 min
**Domän:** `scripts/check-sprint-retro.sh` + `.husky/pre-commit` + `autonomous-sprint.md`

**Triggande händelse:** S45-sprint-avslut hade 4 fel info (felaktig PR-status, "5/5 done" när S45-4 var öppen). Dev skrev retro utan tech-lead-review. Tech lead hade ingen triggerpunkt.

**Del 1: Regel-förtydligande i `autonomous-sprint.md`**

Lägg till explicit:
> **Sprint-avslut är en story med egen review.** Retro + status.md-ändringar + docs-sync (README/NFR/CLAUDE.md) ska granskas av tech lead innan merge, på samma sätt som en feature-story. Dev får inte committa retro direkt på main.

**Del 2: Hook**

```
Trigger: pre-commit med docs/retrospectives/<datum>-sprint-<N>.md staged

1. Kolla om fler filer är staged utöver retro
2. Om bara retro + på main: BLOCKERA — kräver tech-lead-review i PR
3. Om på feature branch: OK (riktiga sprint-avslut-flödet)
4. Override: `[override: sprint-avslut]` tillåtet för tech lead-själv-review
```

**Acceptanskriterier:**
- [ ] `autonomous-sprint.md` uppdaterad med sprint-avslut-som-story-regel
- [ ] Hook blockerar retro-commit direkt på main utan feature branch
- [ ] Override fungerar för tech lead
- [ ] Test: Dev committar retro på main → blockerar
- [ ] Test: retro-commit på feature/sprint-X-avslut → passerar

**Reviews:** code-reviewer

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| Blockers för strikta → legitima commits blockas | Medel | Override-mekanism med motivering. Retro efter 2 sprintar: justera trösklar. |
| Override används för ofta → regler blir meningslösa | Medel | Retro räknar overrides per sprint. Mål: ≤3/sprint. Varje override motiverad. |
| Hooks bryts tyst om status.md-format ändras | Hög | S47-3 hook-tester fångar regressioner. |
| Review-matrisen inkomplett → missad story-typ passerar | Medel | `default`-rad i matrisen (minst code-reviewer). Justera vid nya filtyper. |
| Dev/tech-lead-sessioner delar GitHub-user → S45-3 kan inte skilja | Kvarstår | Accepterat — social norm + override vid avsiktlig self-merge |

---

## Definition of Done (sprintnivå)

- [ ] Review-matris extraherad + refererad
- [ ] Review-obligatorisk-gate blockerar saknade reviews
- [ ] Branch-check pre-commit blockerar fel branch
- [ ] Alla S45-hooks uppgraderade till blockers med override
- [ ] Sprint-avslut-review-gate live
- [ ] Hook-tester täcker alla scenarier
- [ ] S46-1-scenariot (saknar security-reviewer + commit på main) → nu blockeras
- [ ] Retro med explicit "Reviews körda"-format tillämpad
- [ ] Alla overrides i sprinten motiverade (räknas i retro)
- [ ] Procedurbrott under S47 ≤ 2 (mål: 0 — sprintens poäng är att göra det omöjligt)

---

## Meta-observation

**Tempo + enforcement är inte motsatser.** Tempo-problem var inte att regler stoppade, utan att vi hade regler som *inte* stoppade. När regler automatiskt enforcas behöver vi inte tänka på dem — de bara finns där.

**Override-designen** ger flexibilitet när medvetenhet är hög (tech lead säger "jag vet att jag bryter regel X pga Y") utan att tillåta omedveten drift.

**Efter S47** ska varje procedurbrott vara ett medvetet val som lämnar spår i git log. Det är skillnaden mellan "regler finns" och "regler följs".

## Kritisk insikt: AI-sessioners "compacting conversation"

**Observation (2026-04-20, Johan):** När Dev's Claude-session når context-window-gräns triggas "compacting conversation" — äldre delar av konversationen komprimeras och viss detaljkunskap tappas. Det är en teknisk begränsning, inte en disciplinbrist.

**Implikation för process-design:** Vi kan **aldrig** lita på att Dev "kommer ihåg" en regel från tidigare i konversationen. Varje regel måste finnas i:
- Kod (hooks som enforce)
- Data-filer (review-matrisen som lookup)
- Runtime-instruktioner som laddas automatiskt (`.claude/rules/*.md`)

**Det här förstärker hela S47-premissen.** Om vi instruerar Dev ("kom ihåg att köra security-reviewer") kan Dev glömma det efter 2h arbete pga compacting. Om hooken blockerar commit utan security-reviewer, spelar det ingen roll om Dev glömt — systemet stoppar.

**Regel för oss själva:**
- **Ingen kritisk process-regel får leva enbart i prompts/instruktioner.**
- Varje regel måste ha (a) text i `.claude/rules/`, (b) hook som enforcar, (c) test av hooken.
- Om du bara *förklarar* en regel för Dev i chat → den är sårbar. Gör den till kod.
