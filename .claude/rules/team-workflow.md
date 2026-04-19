---
title: "Team Workflow -- Stationsflode"
description: "6-stationsflode med checklistor for features, fran planering till merge"
category: rule
status: active
last_updated: 2026-04-20
tags: [workflow, team, review, tdd, quality]
sections:
  - Översikt
  - Station 1 PLAN
  - Station 2 RED
  - Station 3 GREEN
  - Station 4 REVIEW
  - Station 5 VERIFY
  - Station 6 MERGE
  - Undantag
---

# Team Workflow -- Stationsflode

## Översikt

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

### Först: verifiera aktualitet (OBLIGATORISKT för backlog-stories)

Om storyn plockats från backloggen (inte nyskriven i sprint-planeringen), **verifiera att problemet fortfarande finns INNAN detaljplanering**:

- [ ] Grep/find efter det som ska åtgärdas (t.ex. `grep -r "Task.detached" ios/`)
- [ ] Läs relaterad kod -- har någon annan sprint redan fixat det?
- [ ] Kör relevant test -- beter sig koden som storyn beskriver?

**Om problemet är löst:** Skriv `docs/done/<story-id>-done.md` med "Redan åtgärdat i S<X>-<Y> (commit <hash>). Ingen kodändring behövs." Committa done-filen + uppdatera sessionsfil. Gå till nästa story.

**Varför:** S27 och S29 hade båda 2 stories var där problemet redan var löst. ~30 min slösad planering per incident. En 2-minuters verifiering undviker det.

### Checklista (när problemet är verifierat)

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
- En logisk ändring per TDD-cykel
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

### Review-gating: när skippa subagent-review

**Triviala stories** får skippa subagent-review och gå direkt till Station 5 (VERIFY).

**Grundregel:** Trivial-gating är **tid × yta × risk**, inte bara "är det ny logik?". Även ren refactoring eller test-migrering kan ha yta-risk (slarvfel skalar med antal filer).

Alla kriterier MÅSTE stämma för att en story ska klassas som trivial:

- [ ] Effort <15 min **OCH** ≤1 fil ändrad (yta-gräns)
- [ ] Mekanisk ändring (inte ny logik, inga nya filer skapade)
- [ ] Ingen API-yta ändras (inga nya routes, inga ändrade signaturer)
- [ ] Ingen säkerhetspåverkan (ingen auth, ingen input-validering, inga behörigheter, **inga nya auth-tester**)
- [ ] Inget UI ändras (inga komponenter, inga sidor, **ingen komponentextraktion**)
- [ ] Tester finns OCH passerar (eller tillkommer utan att ändra beteende)

**Exempel på triviala stories:**
- `Task.detached` → `Task` (1 fil)
- Force unwrap → `guard let` (1 fil)
- Byt paketversion (patch) (package.json + lock)
- Flytta en import (1 fil)
- Rätta stavfel i UI-sträng (om det inte påverkar tester)

**Exempel på INTE triviala (kräver review):**
- Ny route/endpoint
- Ändrad Zod-schema
- Ny domain service-metod
- Ändrad UI-komponent eller **komponent-extraktion till ny fil**
- Schema-ändring
- Säkerhets- eller auth-relaterat
- **Test-migrering över flera filer** (nya integration/component-tester är ny kod — fel i mock-setup eller coverage-gap fångas av review)
- **Ren refactoring som rör ≥2 filer** (slarvfel skalar med yta — även "bara flyttat kod" kan introducera bugg)
- Alla stories med effort >15 min — **effort-tröskeln är absolut**

**Regel vid osäkerhet:** Kör review. Bättre att spendera 5 min extra än att missa en bugg.

**Varning från S43-lärdom (2026-04-19):** S43-1 (1 dag, 5 filer, HorseForm-extraktion + integration-test) och S43-2 (1 dag, 10+ filer, 5 nya integration-test-filer) klassades felaktigt som "trivial" av Dev med motivering "mekanisk test-migrering". Tech-lead-review vid merge fångade coverage-gaps som Dev's review hade hittat. **Review vid Station 4 (Dev) är inte ersättbar av review vid Station 7 (tech lead)** — de kompletterar varandra (närhet vs distans).

**Oavsett trivial eller inte:** Station 5 (`npm run check:all`) är ALLTID obligatorisk.

### Automatisk review (för icke-triviala stories)

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

### Dokumentation i done-fil

**För triviala stories:** Skriv "Reviews körda: ingen (trivial story -- mekanisk ändring, <15 min, check:all grön)"

**För icke-triviala:** Lista varje körd subagent enligt ordinarie mönster.

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

> **Dev MERGAR ALDRIG egen PR — tech lead är alltid gatekeeper.**
>
> Flow: Dev pushar feature branch → tech lead triggas via "kör review" → tech lead granskar + skapar PR + mergar. Om Dev skapar PR själv: tech lead måste triggas explicit innan merge.
>
> **Undantag:** `.claude/rules/*`-ändringar kan mergas av den som gjorde dem efter self-review, eftersom de påverkar agent-beteende och inte produktionskod.
>
> **Varning från S44 (2026-04-19):** S44-0, S44-1 och S44-2 mergades av Dev utan tech-lead-review — tre brott mot denna regel på en sprint. Använd `bash scripts/check-own-pr-merge.sh <PR>` innan `gh pr merge` för att påminnas.

### Steg

1. `git fetch origin` + las `status.md` -- vilka stories ar "review_requested"?
2. For varje: `git diff main..origin/feature/<branch>` -- granska andringar
3. Kor code-reviewer subagent vid behov
4. Om godkant: skapa PR och merga via GitHub:
   ```bash
   gh pr create --base main --head feature/<branch> \
     --title "S<X>-<Y>: kort beskrivning" \
     --body "## Summary\n- ..."
   # Vanta pa CI (Quality Gate Passed)
   gh pr merge <PR-nummer> --merge --delete-branch
   ```
5. OMEDELBART efter merge: uppdatera status.md -> "done" + commit-hash
6. Om problem: notera i status.md, utvecklaren fixar pa sin branch

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
