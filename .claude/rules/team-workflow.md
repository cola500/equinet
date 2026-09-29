---
title: "Team Workflow — 4-stegsflöde"
description: "Minimalt flöde per story: Branch → TDD → Check → Ship"
category: rule
status: active
last_updated: 2026-09-29
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
| Ny eller ändrad API-route | `/security-review` |
| Väsentlig ny logik (>1 timme implementation) | `/code-review` |
| Ny iOS-vy eller komplex SwiftUI | ios-expert |
| UI-flöde som påverkar slutanvändare | cx-ux-reviewer |
| Enkel fix, docs, config, trivialt (<15 min, ≤1 fil) | Ingen review |

Kör reviewers seriellt: `/code-review` FÖRST. Om inga blockers/majors — skippa specialist-reviewer.

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

Vid osäkerhet: kör `/code-review`. Kostar 5 min, sparar potentiell bugg.

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

**Alla bestående ändringar -- kod såväl som dokumentation -- går via feature branch + PR.** Ingen direkt commit eller push till `main`, oavsett hur liten eller "lifecycle" ändringen är (status.md, done-filer, retros, plan-filer inkluderat). `main` har branch protection: `Quality Gate Passed` måste vara grön innan merge, se `docs/operations/dependabot.md`. Detta ersätter den tidigare "trunk-based hybrid"-modellen (`.claude/rules/commit-strategy.md`), som byggde på antagandet att branch protection inte gick att aktivera -- ett antagande som var felaktigt (repot är publikt) och som åtgärdades 2026-09-28.

**"Docs-only" som term förekommer på flera ställen i regelverket** (`review-matrix.md`, `tech-lead.md`, `feature-delivery.md`) -- där syftar det ENDAST på vilka reviewers/granskningssteg som krävs, ALDRIG på om PR/branch krävs. En agent får aldrig tolka "docs-only" som tillstånd att committa eller pusha direkt till `main`.

**Break-glass (produktionskritiskt nödläge):** Reponägaren kan manuellt override:a branch protection (`enforce_admins: false` på repo-nivå) för en genuint akut, produktionsblockerande situation. Detta är INTE ett normalt arbetsflöde och inget en agent väljer på egen hand baserat på hur "kritiskt" en ändring känns -- det kräver explicit, medvetet godkännande från Johan i stunden, inte en tyst egen bedömning.

**Schema-ändringar:** Kräver tech-architect-review och deploy-ordning per `prisma.md`, utöver PR-kravet ovan.
