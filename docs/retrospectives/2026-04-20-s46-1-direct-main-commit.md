---
title: "Retro S46-1: Dev committade direkt på main — 5 Whys"
description: "Process-drift trots S45-hooks. Dev hoppade hela PR-flödet för upload-endpoint. Samt security-reviewer fann 3 blockers som aldrig körts i förväg."
category: retro
status: active
last_updated: 2026-04-20
tags: [retro, process-drift, security, hooks-limitation, s46]
sections:
  - Vad som hände
  - 5 Whys
  - Konsekvens
  - Vad saknades i automationen
  - Åtgärder
---

# Retro S46-1: Dev committade direkt på main — 5 Whys

**Datum:** 2026-04-20
**Händelse:** Dev (sonnet-session) committade hela S46-1-implementationen direkt på lokal main istället för feature branch + PR.

---

## Vad som hände

S46-0 var exemplarisk (plan + tech-architect + security-reviewer, PR #236 mergad). S46-1 började också rätt:
- `docs/plans/s46-1-plan.md` committad på feature branch `feature/s46-1-upload-api` (commit ae1cea65) ✅
- Branch skapad från main ✅

Men sedan: **Dev bytte tillbaka till main för att hämta något** (troligen `git pull`), påbörjade implementationen, och committade allt (840+ rader kod + 9 tester + done-fil + package-lock.json) direkt på lokal main som commit c6da4103. Ingen feature branch, ingen push, ingen PR.

Tech lead upptäckte det vid "kör review":
- main var 1 commit ahead av origin/main
- Ingen öppen PR
- Feature branch hade bara plan-commiten

**Security-reviewer (körd i efterhand av tech lead) fann 3 BLOCKERS** som aldrig hade fångats:
1. Magic bytes INTE fail-closed (direkt kringgång av S46-0-krav)
2. Storleksgräns enforced efter body-läsning (DoS-risk)
3. Rate-limit fallback-config 100/h vs Upstash 10/h

Dessa hade fångats av pre-merge-review på feature branch — men den kördes aldrig eftersom ingen PR fanns.

---

## 5 Whys

**1. Varför committade Dev på main istället för feature branch?**
Dev bytte till main för `git pull` och glömde byta tillbaka innan `git add` + `git commit -am`. Ingen explicit `git branch --show-current`-check.

**2. Varför glömde Dev byta tillbaka?**
Tempo + inget som stoppade. `git add` och `git commit` ger ingen feedback om branch.

**3. Varför kördes inga reviewers heller?**
Dev hoppade hela Station 4 (REVIEW). Done-filen har ingen Reviews körda-sektion. Dev följde inte stationsflödet efter att hen hoppade Station 6 (PUSH feature branch).

**4. Varför varnade inga S45-hooks?**
- `check-plan-commit.sh` (S45-0): plan-filen *fanns* på feature branch, så hooken hade inget att varna om.
- `check-sprint-closure.sh` (S45-1): sprint var öppen, inget att varna om.
- Multi-commit-gate (S45-2): triggas bara vid `git push`. Dev pushade inte.
- Tech-lead-merge-gate (S45-3): triggas bara vid `gh pr merge`. Dev skapade ingen PR.

**Ingen av S45-hooks kan fånga "commit på fel branch" eftersom alla triggas vid push/merge.**

**5. Rotorsak:**
**Vi har hooks för "plan saknas", "sprint inte stängd", "self-merge", "för få commits vid push". Men ingen gate för "commit på main när story är in_progress i en feature-story".** Systemet förlitar sig på mänsklig uppmärksamhet för vilken branch man är på — exakt det som bryts under tempo.

Dessutom: **Dev review-hoppade utan att någon hook fångar det.** Review-matris är dokumentation, inte enforcement.

---

## Konsekvens

**Det som gick rätt (trots processbrott):**
- Kod existerar, 9 tester gröna, check:all passerade
- Cherry-pick till feature branch bevarade arbetet utan dataförlust
- Tech lead kunde köra riktig review post-commit (resulterade i 3 blockers hittade)

**Det som gick fel:**
- Kod hade säkerhetsblockers som aldrig fångats ifall main pushats som den var
- Upload-endpoint med IDOR + DoS + magic-bytes-hål hade nått "produktion"
- Process-hardening i S45 bevisade sig inte vara tillräcklig

**Om Dev hade pushat main innan tech lead checkade:** blockers hade varit live. S45-hooks hade inte fångat det.

---

## Vad saknades i automationen

| Hook vi har | Fångar | Kan den fånga detta? |
|------------|--------|---------------------|
| check-plan-commit.sh | plan saknas | Nej — plan fanns |
| check-sprint-closure.sh | sprint-avslut hoppad | Nej — sprint öppen |
| multi-commit-gate (pre-push) | <2 commits i feature | Nej — ingen push |
| check-own-pr-merge.sh | self-merge via gh | Nej — ingen PR |
| pre-commit swedish/typecheck | språk/typfel | Nej — passerade |

**Gap:** Pre-commit-hook som varnar om:
> "Story är `in_progress` i status.md och current branch är `main` (inte `feature/*`). Fel branch?"

Eller pre-push-hook som varnar om:
> "Pushar direkt till main men docs/sprints/status.md har story `in_progress` som pekar på feature-branch X."

---

## Åtgärder

### Omedelbart (gjort)

- PR #238 skapad via cherry-pick
- Security-reviewer körd retroaktivt — 3 blockers + 2 majors hittade
- Dev måste fixa blockers 1-3 innan merge
- Denna retro dokumenterad

### Backlog (S47-kandidater)

1. **Branch-check pre-commit-hook** (30-45 min)
   - Vid `git commit` på main: om status.md har story `in_progress` med feature-branch-koppling → varna
   - Behöver sessionsfil eller story→branch-mapping

2. **Review-obligatorisk-gate** (30 min)
   - Vid pre-commit av `docs/done/<story>-done.md`: varna om "Reviews körda"-sektionen saknar subagents som review-matrisen kräver för story-typ
   - Parsningslogik: läs done-fil, matcha mot review-matris per filtyp i commiten

3. **Tech-lead-post-PR-create-gate** (15 min)
   - När `gh pr create` körs: skicka notifiering till tech lead automatiskt (eller åtminstone meddelande i statusfilen)

### Meta-lärdom

**Automation måste följa med nya failure modes.** Vi byggde S45-hooks baserat på S43-S44-brott. S46-1 introducerade ett nytt brott (commit på fel branch) som vi inte hade sett. Varje ny klass av brott kräver ny gate.

**Alternativ:** Strukturell förändring — t.ex. disable-commit-on-main-när-story-in_progress (blockerande hook, inte bara varning). Men det skulle blockera legitima main-commits (t.ex. status.md-uppdatering från tech lead). Kräver finare logik.

**Kulturförändring:** Alla AI-sessioner (Dev, tech lead) bör köra `git branch --show-current` som första steg i varje git-operation. Instruktionen kan läggas i `.claude/rules/autonomous-sprint.md` och `.claude/rules/tech-lead.md`.

---

## Procedurbrott-räkning

| Brott | Upptäckt av |
|-------|-------------|
| Commit på main istället för feature branch | Tech lead vid "kör review" |
| Ingen push, ingen PR | Tech lead |
| Reviews körda-sektion saknas i done-fil | Tech lead |
| 3 säkerhetsblockers i koden (magic bytes, storlek, rate-limit) | Security-reviewer (körd post-commit) |

**Totalt: 4 brott i en enda story.** Värre än genomsnittet för S45 (1.2/story). S45-hooks otillräckliga för denna klass.
