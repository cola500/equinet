---
title: "Commit-strategi -- Trunk-based hybrid"
description: "När kod kräver feature branch + PR, och när lifecycle-docs får committas direkt till main"
category: rule
status: active
last_updated: 2026-04-20
tags: [workflow, git, commit, pr, trunk-based]
paths:
  - "docs/sprints/*"
  - "docs/done/*"
  - "docs/retrospectives/*"
sections:
  - Principen
  - Paths som FÅR committas direkt till main
  - Paths som KRÄVER feature branch + PR
  - Undantag och edge cases
  - Override-mönster (kringgå process-gates)
  - Varför
---

# Commit-strategi -- Trunk-based hybrid

## Principen

**Kod = feature branch + PR. Lifecycle-docs = direkt till main.**

Vi kör en hybrid av trunk-based development: stark isolation för sånt som kan bryta produktion, snabb kadens för sånt som inte kan det.

---

## Paths som FÅR committas direkt till main

Dessa filer är *state tracking* och *historiska loggar*. Review ger inget värde, bara overhead.

| Path | Varför direkt OK |
|------|------------------|
| `docs/sprints/status.md` | Realtids-state, shuffleas per session |
| `docs/sprints/session-*.md` | Sessionsloggar, per-agent |
| `docs/sprints/backlog.md` | Planeringsdokument, ändras dagligen |
| `docs/done/*.md` | Historisk log av avslutade stories |
| `docs/retrospectives/*.md` | Avslutade retros |
| `docs/plans/<story-id>-plan.md` | Per-story planer som ändå granskas i station 1 |

**Regel:** Om committen BARA rör dessa paths -- kör direkt till main:
```bash
git checkout main
git pull origin main
# ... gör ändringar ...
git commit -am "docs: uppdatera status efter S28-1"
git push origin main
```

---

## Paths som KRÄVER feature branch + PR

Dessa filer påverkar bygge, produktion eller agent-beteende. Review är skydd.

| Path | Varför PR |
|------|-----------|
| `src/**` | Produktionskod |
| `prisma/**` | Schema och migrationer |
| `ios/**` | iOS-app |
| `e2e/**` | Testsvit |
| `.github/workflows/**` | CI-konfiguration |
| `.claude/rules/**` | Styr alla agenter |
| `CLAUDE.md` | Projektets "grundlag" |
| `README.md`, `NFR.md` | Source of truth-dokument |
| `docs/architecture/**` | Arkitekturbeslut |
| `docs/security/**` | Säkerhetsbeslut |
| `docs/operations/**` | Ops-procedurer |
| `docs/guides/**` | Utvecklarguider |
| `docs/api/**` | API-dokumentation |
| `package.json`, `package-lock.json` | Dependencies |
| `scripts/**` | Utvecklings-scripts |

**Regel:** Feature branch + PR + CI-gate + merge via `gh pr merge`.

---

## Undantag och edge cases

### Blandad commit (lifecycle-docs + kod)

Om en commit rör BÅDE direkt-OK paths OCH PR-required paths: **kör PR-flödet**. Den striktare regeln vinner.

### Done-fil skrivs samtidigt som kod

Done-filen tillhör kodens PR. Commita dem tillsammans i feature-branchen, inte direkt till main.

### Status.md uppdaterat av dev-session vid merge

Det är OK -- det är fortfarande en lifecycle-doc. Men det bör göras i samma commit som done-filen (se stationsflödet, station 6).

### Sprint-dokument (`sprint-<N>-*.md`)

Vid SKAPANDE av ny sprint: direkt OK (docs/sprints/). Vid BETEENDE-påverkande ändringar (ny regel, ny session-tilldelning): använd PR för tydlighet.

### Plan-commit-ordning (förhindrar divergent branches)

`docs/plans/<story-id>-plan.md` tillhör listan "direkt OK" ovan. Om du committar plan-filen direkt till main **måste** main vara pushad INNAN du skapar feature-branchen — annars skapar du en divergent branch-situation när PR:en ska mergas.

Säker ordning:
1. `git pull origin main` — säkerställ att local main är uppdaterad
2. Skriv plan-filen, committa direkt på main
3. `git push origin main` — pusha plan-commiten
4. `git checkout -b feature/<story-id>-<namn>` — skapa feature-branchen EFTER push

Om du glömde och skapade feature-branchen innan push: `git rebase main` på feature-branchen löser divergensen.

**Källa:** S44-retro-fynd (2026-04-19) — Dev committade plan på main och skapade feature-branch innan push, vilket skapade divergent branches vid PR #230.

---

## Override-mönster (kringgå process-gates)

Alla pre-commit och pre-push BLOCKERs kan kringgås med ett explicit override-meddelande. Override kräver en motivering — tom placeholder (`<motivering>`) räcker inte.

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

---

## Varför

**Kort:** Branch protection är inte aktivt på privat repo utan GitHub Pro. Konventionen är det som styr. Dokumenterad konvention > ceremoniell PR utan review-värde.

**Långt:**

1. **Lifecycle-docs har inget meningsfullt review-värde.** "Story är done" är ett statement, inte ett beslut.

2. **Cascading rebase-kostnad vid många PRs.** När main uppdateras måste alla öppna PRs rebasas. 5 docs-PRs = 5 rebase-cykler utan värde.

3. **CI-kostnad per PR.** Varje PR kör 6 jobb × 3-7 min. För en 5-raders backlog-ändring är det slöseri.

4. **Traceability bevaras.** Git log + commit-meddelanden ger lika god spårbarhet som PR-titlar.

5. **Säkerheten består för kod.** PR-kravet för `src/**`, `prisma/**`, `.claude/rules/**` fångar det som faktiskt kan bryta produktion.

---

## Referenser

- Google Engineering Practices Documentation -- Trunk-Based Development
- Martin Fowler -- "Patterns for Managing Source Code Branches"
- `docs/operations/dependabot.md` -- exempel på per-path strategi (Dependabot patch = auto-merge)
