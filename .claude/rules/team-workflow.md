---
title: "Team Workflow — 4-stegsflöde"
description: "Minimalt flöde per story: Branch → TDD → Check → Ship"
category: rule
status: active
last_updated: 2026-04-24
tags: [workflow, team, tdd, quality]
paths:
  - "src/**"
  - "ios/**"
sections:
  - Flöde
  - Steg 1 - BRANCH
  - Steg 2 - TDD
  - Steg 3 - CHECK
  - Steg 4 - SHIP
  - Review-gating
  - Roller
  - Undantag
---

# Team Workflow — 4-stegsflöde

```
BRANCH → TDD → CHECK → SHIP
```

Varje story passerar fyra steg. Commit kontinuerligt — inga minimikrav på antal commits.

---

## Steg 1: BRANCH

```bash
git checkout -b feature/<story-id>-<kort-beskrivning>
```

- Ingen plan-fil krävs. Komplex arkitektur diskuteras i konversationen.
- Enkla stories börjar direkt med tester.

---

## Steg 2: TDD

**BDD dual-loop** för API-routes och domain services:
1. Skriv yttre integrationstest (RED)
2. Inre cykel: unit RED → GREEN → REFACTOR
3. Yttre integrationstest GREEN

**Enkel TDD** för utilities, hooks, iOS ViewModels:
1. RED (skriv failande test)
2. GREEN (minimum implementation)
3. REFACTOR

**Regel:** Skriv tester INNAN implementation. Aldrig skippa RED-steget.

Kör snabbtest efter varje GREEN:
```bash
npx vitest run src/domain/<namn>   # ~1s
```

---

## Steg 3: CHECK

```bash
npm run check:all   # typecheck + test:run + lint + check:swedish
```

Alla 4 gates MÅSTE vara gröna innan SHIP.

### Review (behovsprövat, inte obligatoriskt för alla)

| Situation | Kör |
|-----------|-----|
| Ny eller ändrad API-route | security-reviewer |
| Väsentlig ny logik (>1 timme implementation) | code-reviewer |
| Ny iOS-vy eller komplex SwiftUI | ios-expert |
| UI-flöde som påverkar slutanvändare | cx-ux-reviewer |
| Enkel fix, docs, config, trivialt (<15 min, ≤1 fil) | Ingen review |

Kör reviewers seriellt: code-reviewer FÖRST. Om inga blockers/majors — skippa specialist-reviewer.

---

## Steg 4: SHIP

```bash
git push -u origin feature/<story-id>-<namn>
gh pr create --base main --head feature/<story-id>-<namn> \
  --title "S<X>-<Y>: kort beskrivning" \
  --body "## Summary\n- ..."
gh pr merge <PR-nummer> --merge --delete-branch
```

- **Tech lead mergar** i normalt läge.
- **Dev self-mergar** i autonom sprint-körning.
- Uppdatera `status.md` efter merge (story → done + commit-hash).

---

## Review-gating

Skippa all review när ALLA dessa stämmer:

- [ ] Effort <15 min **OCH** ≤1 fil ändrad
- [ ] Mekanisk ändring (inte ny logik, inga nya filer)
- [ ] Ingen API-yta ändras
- [ ] Ingen säkerhetspåverkan
- [ ] Inget UI ändras
- [ ] Tester finns och passerar

Vid osäkerhet: kör code-reviewer. Kostar 5 min, sparar potentiell bugg.

---

## Roller

**Tech lead:**
- Mergar PRs i normalt läge
- Granskar säkerhetskänslig kod (API-routes, auth, schema)
- Sprint-planering med Johan

**Fullstack-dev (autonom körning):**
- Plockar stories från status.md
- Kör hela flödet: BRANCH → TDD → CHECK → SHIP
- Self-mergar i autonom sprint

**Johan (product owner):**
- Prioriterar backlog
- Frågas vid affärsbeslut eller scope-oklarheter
- Aldrig vid tekniska val inom sprint-scopet

---

## Undantag

**Hotfix:** Skippa BRANCH (committa direkt på main om kritiskt). Alla övriga steg gäller.

**Docs-only:** Direkt till main utan PR. Kör check:swedish.

**Schema-ändringar:** Kräver tech-architect-review och deploy-ordning per `prisma.md`.
