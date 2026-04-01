---
title: "Team Workflow -- Stationsflode"
description: "6-stationsflode med checklistor for features, fran planering till merge"
category: rule
status: active
last_updated: 2026-04-01
tags: [workflow, team, review, tdd, quality]
sections:
  - Oversikt
  - Station 1 PLAN
  - Station 2 RED
  - Station 3 GREEN
  - Station 4 REVIEW
  - Station 5 VERIFY
  - Station 6 MERGE
  - Undantag
---

# Team Workflow -- Stationsflode

## Oversikt

Varje feature passerar 6 stationer. Commit efter varje station.
Om en station misslyckas, ga tillbaka till ratt station (aldrig framat).

```
PLAN --> RED --> GREEN --> REVIEW --> VERIFY --> MERGE
  ^       ^       |         |          |
  |       |       v         v          |
  |       +--- (fix) <-- (problem) <---+
  +--- (arkitekturproblem)
```

---

## Station 1: PLAN

**Vem**: Tech lead (eller utvecklare med tech lead-granskning)
**Syfte**: Sakerstall att vi bygger ratt sak pa ratt satt

### Checklista

- [ ] User story definierad: "Som [roll] vill jag [handling] sa att [nytta]"
- [ ] Paverkan identifierad: vilka filer/domaner beros?
- [ ] Schema-andringar? -> Skissa Prisma-modeller FORE implementation
- [ ] API-kontrakt? -> Definiera endpoints, request/response-format
- [ ] Beror karndomaner? -> Repository pattern obligatoriskt
- [ ] Feature flag behovs? -> Definiera i feature-flag-definitions.ts
- [ ] iOS-paverkan? -> Behovs native vy eller racker WebView?
- [ ] Sakerhetsovertanke: auth, IDOR, input-validering

### Output

- Kort designbeskrivning (kan vara kommentar i sprint-dokumentet)
- Lista over filer som ska andras/skapas
- Beslut om feature flag ja/nej

### Gate

Tech lead godkanner planen innan station 2 paborjas.

---

## Station 2: RED

**Vem**: Utvecklare
**Syfte**: Definiera onskad beteende genom failande tester

### Regler

- Skriv BARA tester -- ingen implementation
- API routes + domain services: BDD dual-loop (yttre integrationstest forst)
- Utilities + enkel CRUD: Enkel TDD
- iOS: XCTest for ViewModel, visuell verifiering for UI

### Checklista

- [ ] Integrationstest skrivet (for BDD dual-loop)
- [ ] Unit-tester skrivna for alla nya publika metoder
- [ ] Tester failar av RATT anledning (inte importfel eller syntax)
- [ ] Feature flag-test: "returns 404 when flag disabled" (om flagga anvands)
- [ ] Edge cases identifierade: null, tom lista, ogiltig input, concurrent access

### Gate

Alla tester MASTE faila. Om nagot test passerar utan implementation -- testet testar inte ratt sak.

---

## Station 3: GREEN

**Vem**: Utvecklare
**Syfte**: Minimum implementation for att passera alla tester

### Regler

- Implementera BARA det som behovs for att tester passerar
- En logisk andring per TDD-cykel
- Om en refactor bryter ett test -- revertera refactorn
- Vid ny API route: folj api-routes.md checklista
- Vid ny feature flag: folj feature-flags.md checklista

### Checklista

- [ ] Alla RED-tester ar grona
- [ ] Zod-schema definierad (.strict()) for alla nya endpoints
- [ ] Auth-check i alla nya routes (session null-guard)
- [ ] Rate limiting i alla nya routes
- [ ] Select-block (aldrig include) i alla Prisma-queries
- [ ] Strukturerad loggning (logger, aldrig console.*)
- [ ] Svenska felmeddelanden i API-responses
- [ ] Om befintlig route -- migrera till withApiHandler om rimligt

### Gate

`npx vitest run <berod-sokvag>` + `npm run typecheck` -- alla grona.

---

## Station 4: REVIEW

**Vem**: code-reviewer agent (automatiskt) + tech lead vid storre andringar
**Syfte**: Fanga problem innan de nar main

### Automatisk review

Kor `code-reviewer` subagent med:
- Jämfor mot planen fran station 1
- Sakerhetscheck (se code-review-checklist.md)
- Kodkvalitet och konsistens

### Review-kritik leder till

| Allvarlighetsgrad | Atagard |
|-------------------|---------|
| Blocker | Tillbaka till station 3, MASTE fixas |
| Major | Tillbaka till station 3, bor fixas |
| Minor | Notera, kan fixas i nasta iteration |
| Suggestion | Frivilligt |

### Extra reviews (vid behov)

- API-andringar: `security-reviewer` agent
- UI-andringar: `cx-ux-reviewer` agent
- Arkitektur-andringar: `tech-architect` agent
- iOS-andringar: `ios-expert` agent

### Gate

Inga blocker eller major-problem kvar.

---

## Station 5: VERIFY

**Vem**: Utvecklare
**Syfte**: Alla automatiska kvalitetsgates grona

### Webb-verifiering

```bash
npm run check:all    # typecheck + test:run + lint + check:swedish
```

### iOS-verifiering

```bash
# Niva 1 (default):
xcodebuild test -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,id=<UDID>' \
  -only-testing:EquinetTests/<BerordTestSvit>

# Niva 2 (infor merge):
xcodebuild test ... -only-testing:EquinetTests
```

### Visuell verifiering (vid UI-andringar)

- Webb: Playwright MCP med worktree dev-server (port 3001)
- iOS: mobile-mcp screenshots + accessibility tree

### Checklista

- [ ] `npm run check:all` passerar (webb)
- [ ] Relevant iOS-testsvit passerar
- [ ] Inga nya `@ts-expect-error` utan dokumenterad anledning
- [ ] Inga nya `any`-typer utan dokumenterad anledning
- [ ] Inga nya console.* i produktionskod
- [ ] Visuell verifiering vid UI-andringar

### Gate

Alla checklistepunkter uppfyllda.

---

## Station 6: PUSH FEATURE BRANCH (utvecklare)

**Vem**: Utvecklare
**Syfte**: Gora arbetet tillgangligt for tech lead-granskning

### Checklista

- [ ] Feature branch ar uppdaterad mot main (`git rebase main` eller merge)
- [ ] Alla gates fortfarande grona efter rebase
- [ ] Commit-meddelanden ar beskrivande ("varfor" > "vad")
- [ ] `git status` visar inga ocommittade andringar
- [ ] `docs/sprints/status.md` uppdaterat: story -> "review_requested"
- [ ] Pusha FEATURE BRANCH: `git push -u origin feature/<namn>`

### Regler

- Pusha ALDRIG direkt till main
- Pusha ALLTID din feature branch
- Nar pushat: arbetet ar klart. Tech lead granskar och mergar.

---

## Station 7: MERGE (tech lead)

**Vem**: Tech lead (triggas via "kor review")
**Syfte**: Slutgranskning och merge till main

### Steg

1. `git pull` + las `status.md` -- vilka stories ar "review_requested"?
2. For varje: `git diff main..origin/feature/<branch>` -- granska andringar
3. Kor code-reviewer subagent vid behov
4. Om godkant: merga till main, uppdatera status.md -> "done", pusha main
5. Om problem: notera i status.md, utvecklaren fixar pa sin branch

---

## Undantag

### Hotfix (kritisk bugg i produktion)

Hoppa over station 1 (PLAN). Borja pa station 2 (RED) med test som reproducerar buggen.
Alla andra stationer ar fortfarande obligatoriska.

### Mekanisk refaktorering (t.ex. console.* -> logger)

Forenklat flode: RED (om testbart) -> GREEN -> VERIFY -> MERGE.
Krav: tydligt avgransat scope, ingen beteendeandring.

### Dokumentation

Bara station 5 (VERIFY: `npm run docs:validate`) och station 6 (MERGE).
