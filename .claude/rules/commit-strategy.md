---
title: "Commit-strategi -- allt via feature branch + PR"
description: "All bestående kod och dokumentation kräver feature branch + PR mot main; ingen direkt-commit-väg finns längre"
category: rule
status: active
last_updated: 2026-09-28
tags: [workflow, git, commit, pr, branch-protection]
paths:
  - "docs/sprints/*"
  - "docs/done/*"
  - "docs/retrospectives/*"
sections:
  - Principen
  - Vad som ändrades och varför
  - Blandad commit (lifecycle-docs + kod)
  - Override-mönster (kringgå process-gates)
  - gh pr merge-wrapper (via git alias)
---

# Commit-strategi -- allt via feature branch + PR

## Principen

**Allt = feature branch + PR.** Ingen fil, katalog eller ändringstyp har längre en direkt-till-main-väg -- inte kod, inte lifecycle-docs (status.md, done-filer, retros, plan-filer), inte "trivial" dokumentation.

```bash
git checkout -b docs/kort-beskrivning   # eller feature/<story-id>-<namn> för kod
# ... gör ändringar ...
git commit -m "docs: ..."
git push -u origin docs/kort-beskrivning
gh pr create --base main --head docs/kort-beskrivning --title "..." --body "..."
# Vänta på grön Quality Gate Passed
gh pr merge <PR-nummer> --merge --delete-branch
```

`main` har branch protection (repo-nivå, sedan 2026-09-28): merge blockeras tills den obligatoriska statuskontrollen `Quality Gate Passed` är grön (se `docs/operations/dependabot.md`). Det gäller `gh pr merge` såväl som UI-mergeknappen, oavsett vem eller vad som mergar.

**Break-glass (produktionskritiskt nödläge):** Reponägaren kan manuellt override:a branch protection (`enforce_admins: false`). Detta är en dokumenterad, sällsynt nödåtgärd -- inte ett normalt arbetsflöde, och inte något en agent väljer på egen hand baserat på en egen bedömning av "hur kritiskt" något känns. Kräver Johans explicita, medvetna godkännande i stunden.

---

## Vad som ändrades och varför

Fram till 2026-09-28 körde detta repo en "trunk-based hybrid": kod krävde feature branch + PR, men en lista lifecycle-docs (status.md, done-filer, retros, plan-filer) fick committas direkt till main. Motiveringen (se git-historik för tidigare version av denna fil) var: **"Branch protection är inte aktivt på privat repo utan GitHub Pro. Konventionen är det som styr."**

Det antagandet var felaktigt -- repot är publikt (`gh api repos/cola500/equinet` → `"private": false`), och publika repon får branch protection utan Pro-plan. En separat, orelaterad utredning (2026-09-28, Dependabot-auto-merge-säkring) visade att `main` aldrig haft branch protection alls, av misstag snarare än avsikt. Branch protection är nu aktiverad och obligatorisk (`Quality Gate Passed`). Hela den ursprungliga "varför"-motiveringen för direkt-commit-undantaget föll därmed bort samma dag den skrevs om -- konventionen behövde inte längre bära vikten ensam, en riktig teknisk spärr finns nu.

Sekundära skäl att ta bort undantaget helt, snarare än att bara lägga till branch protection ovanpå det gamla mönstret:

1. **"Docs-only"-terminologi kolliderade.** Samma ord används i `review-matrix.md`, `tech-lead.md` och `feature-delivery.md` för att beskriva vilka *reviewers* som krävs (ett helt annat, fortfarande giltigt koncept) -- risk för att en agent felläser det ena som det andra och drar slutsatsen att PR:en själv kan hoppas över.
2. **Root cause till en dokumenterad bugg-klass försvinner.** Gotcha #37 (`docs/guides/gotchas.md`) beskriver hur direkt-commit av plan-filer orsakade divergerande branches (PR #230, S44-retro). Med allt via PR uppstår den situationen inte längre.
3. **Enhetligt mentalt modell för agenter.** En regel ("allt via PR") är svårare att felläsa än en regel med undantagslista.

De ursprungliga argumenten FÖR undantaget (ingen review-värde i "story är done"-statements, cascading rebase-kostnad, CI-kostnad per PR) kvarstår som verkliga avvägningar -- men de vägde för lite mot att ha en enhetlig, svårmissförstådd regel nu när den tekniska spärren (branch protection) faktiskt finns. CI-kostnaden för en ren docs-PR är låg (unit/typecheck/lint körs snabbt; E2E/offline-smoke körs bara mot `main`-riktade PRs men är ändå billigare än att riskera en oskyddad merge).

---

## Blandad commit (lifecycle-docs + kod)

Ingen särskild regel behövs längre -- allt går via PR oavsett innehåll.

---

## Override-mönster (kringgå process-gates)

Alla pre-commit och pre-push BLOCKERs kan kringgås med ett explicit override-meddelande. Override kräver en motivering -- tom placeholder (`<motivering>`) räcker inte. Detta gäller kringgående av enskilda hook-kontroller (t.ex. att en done-fil saknar en sektion) -- INTE branch protection eller PR-kravet, som bara reponägaren kan bypassa (break-glass, se ovan).

### Pre-commit hooks (check-plan-commit, check-sprint-closure, check-branch-for-story, check-reviews-done)

Lägg till `[override: <din motivering>]` i commit-meddelandets ämnesrad:

```bash
git commit -m "feat: akut fix [override: plan skrivs i efterhand, deploy-blocker]"
```

Motiveringen MÅSTE starta med bokstav eller siffra (`[a-zA-Z0-9åäöÅÄÖ]`). Annars tolkas det inte som override.

### Pre-push hook (check-multi-commit)

Lägg till `[override: <din motivering>]` i senaste commit-meddelandet:

```bash
git commit --amend -m "feat: snabbfix [override: hotfix, ett commit avsiktligt]"
git push origin feature/s99-0-fix
```

### check-own-pr-merge.sh (non-interaktivt läge)

Skicka `--override` som andra argument:

```bash
bash scripts/check-own-pr-merge.sh 123 --override
```

### gh pr merge-wrapper (via git alias)

Använd `git merge-pr` istället för `gh pr merge` direkt. Wrappern kör `check-own-pr-merge.sh` automatiskt FÖRE merge:

```bash
git merge-pr 123 --merge --delete-branch          # Normal merge
git merge-pr 123 --merge --delete-branch --override  # Kringgå self-merge-check
```

**Alias-setup (en gång per klon):**
```bash
git config --local alias.merge-pr '!bash scripts/gh-pr-merge.sh'
```

**Varför wrapper och inte bara scriptet direkt?** Utan wrapper är self-merge-blocken social norm -- Dev måste komma ihåg att anropa scriptet manuellt. Med wrappern är det omöjligt att glömma. (S47: Dev mergade sig själv 3 ggr trots att scriptet fanns.)

---

## Kända uppföljningar (inte del av denna ändring)

`docs/architecture/patterns.md` ("Trunk-based hybrid"-raden) och pre-commit-hookarna som specifikt känner igen lifecycle-doc-paths för direkt-commit (`check-branch-for-story.sh`, `check-plan-commit.sh` m.fl., nämnda i `.claude/skills/update-docs/SKILL.md`) kan innehålla logik byggd kring det gamla mönstret. Dokumentationsreferenserna är uppdaterade i denna PR; själva hook-skripten är INTE granskade eller ändrade här -- det är ett separat, avgränsat uppföljningsarbete.

## Referenser

- Google Engineering Practices Documentation -- Trunk-Based Development
- Martin Fowler -- "Patterns for Managing Source Code Branches"
- `docs/operations/dependabot.md` -- branch protection-konfigurationen som gjorde detta möjligt
- `docs/guides/gotchas.md` Gotcha #37 -- den bugg-klass som inte längre kan uppstå
