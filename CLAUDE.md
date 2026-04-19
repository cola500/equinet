---
title: "CLAUDE.md - Utvecklingsguide för Equinet"
description: "Arbetsprocesser, patterns, arkitektur och key learnings för utveckling"
category: root
tags: [development, workflow, architecture, patterns]
status: active
last_updated: 2026-03-20
related:
  - README.md
  - NFR.md
  - docs/INDEX.md
  - docs/guides/gotchas.md
  - docs/guides/agents.md
  - docs/operations/deployment.md
  - docs/architecture/booking-flow.md
  - docs/architecture/database.md
  - docs/architecture/offline-pwa.md
  - docs/security/pentest-2026-02-15.md
  - docs/guides/voice-logging.md
sections:
  - Snabbreferens
  - Projekt
  - Workflow
  - "Testing (TDD är Obligatoriskt!)"
  - "Arkitektur (DDD-Light)"
  - Refactoring Guidelines
  - Gotchas
  - Definition of Done
  - Säkerhet
  - "Agent-Team (3 agenter)"
  - "Key Learnings (tvärgående)"
  - "Debugging: 5 Whys"
  - "Version & SDK Policy"
  - Automated Quality Gates
  - Sprintar
  - Resurser
---

# CLAUDE.md - Utvecklingsguide för Equinet

> **Hur** vi arbetar i projektet. För **vad** som är byggt, se README.md.
> Kontextspecifika regler laddas automatiskt via `.claude/rules/` (API, test, E2E, Prisma, UI).

## Snabbreferens

| Vad du söker | Gå till |
|--------------|---------|
| Docs-index | [docs/INDEX.md](docs/INDEX.md) |
| Setup & Kommandon | [README.md](README.md) |
| **Återanvändbara mönster** | [docs/architecture/patterns.md](docs/architecture/patterns.md) (kolla FÖRST vid nytt) |
| Gotchas | [docs/guides/gotchas.md](docs/guides/gotchas.md) |
| Kodkarta (domän -> filer) | [.claude/rules/code-map.md](.claude/rules/code-map.md) |
| Commit-strategi (PR vs direkt) | [.claude/rules/commit-strategy.md](.claude/rules/commit-strategy.md) |
| Deploy | [docs/operations/deployment.md](docs/operations/deployment.md) |
| Bokningsflöde | [docs/architecture/booking-flow.md](docs/architecture/booking-flow.md) |
| Retros | [docs/retrospectives/](docs/retrospectives/) |
| NFR / Prod Readiness | [NFR.md](NFR.md) |
| Metrics | [docs/metrics/](docs/metrics/) | aktuell rapport: [latest.md](docs/metrics/latest.md) |

---

## Projekt

- **Stack**: Next.js 16 (App Router) + TypeScript + Prisma + Supabase Auth + shadcn/ui
- **Språk**: Svenska (UI/docs), Engelska (kod)
- **Approach**: DDD-Light, TDD, Feature branches
- **Databas**: Supabase (PostgreSQL)

## Workflow

### Feature Implementation (Databas-först + TDD)

1. **Planering**: Schema -> API -> UI
2. **TDD-cykel**: Red -> Green -> Refactor
3. **Feature branch**: `git checkout -b feature/namn`. Om branch-namnet inte längre beskriver arbetet, starta ny branch.
4. **Visuell UX-verifiering**: Vid UI-ändringar -- verifiera med Playwright MCP (se nedan)
5. **Merge till main**: Efter alla tester är gröna
6. **Push**: Till remote

### Release & Versionshantering

```bash
npm run release              # Auto-detect (patch/minor/major)
npm run release:minor        # Force minor bump
npm run release:major        # Force major bump
git push --follow-tags origin main
```

### Deploy till produktion

```bash
npm run deploy              # Kör kvalitetscheckar + push + påminnelse om Supabase-migration
npm run env:status          # Visa vilken databas som är aktiv (lokal/Supabase)
npm run migrate:check       # Visa senaste migrationer (lokalt + Supabase)
npm run migrate:status      # Fullständig namnbaserad jämförelse (pending, drift, misslyckade)
```

**Deploy-ordning vid schemaändring:** Se `.claude/rules/prisma.md`

---

## Testing (TDD är Obligatoriskt!)

- **BDD Dual-Loop**: API routes + domain services. RED (integration) -> inre loop (unit RED/GREEN/REFACTOR) -> GREEN (integration) -> REFACTOR.
- **Enkel TDD**: iOS SwiftUI, simpel CRUD, utilities. RED -> GREEN -> REFACTOR.
- **Skriv tester FÖRST** för API routes, domain services, utilities och hooks.
- **Coverage-mål**: API Routes >= 90%, Utilities >= 95%, Overall >= 80%

> Se `.claude/rules/testing.md` för fullständig BDD-guide, mock-patterns och gotchas.

---

## Arkitektur (DDD-Light)

```
src/app/api/ (routes) -> src/domain/ (services) -> src/infrastructure/ (repos) | src/lib/ (utilities)
```

- **Kärndomäner** (repository obligatoriskt): Booking, Provider, Service, CustomerReview, Horse, Follow, Subscription
- **Stöddomäner** (Prisma OK): AvailabilityException, AvailabilitySchedule
- **Enkel CRUD**: Prisma direkt i route. **Affärslogik**: Domain service. **Validering**: Value object.

---

## Refactoring

- Start minimal: "Kan detta lösas genom att ta bort kod?" Inga nya patterns utan diskussion.
- Filer: 300 rader OK, dela vid ~400-500. Extrahera vid 3+ återanvändningar.

---

## Gotchas

> Se [docs/guides/gotchas.md](docs/guides/gotchas.md) för fullständig lista.

---

## Definition of Done

- [ ] Inga TypeScript-fel, inga console errors
- [ ] Säker (Zod, error handling, ingen XSS/injection)
- [ ] Tester skrivna FÖRST, coverage >= 70%
- [ ] Feature branch, `check:all` grön, mergad via PR
- [ ] **Content matchar kod:** Om feature-ändringen påverkar slutanvändaren -- hjälpartikel uppdaterad (`src/lib/help/articles/<roll>/<slug>.md`) och admin testing-guide uppdaterad (`docs/testing/testing-guide.md`). Samma nivå av obligatoriskt som tester. Se `.claude/rules/auto-assign.md` Docs-matris.

---

## Säkerhet

**Implementerat:** Supabase Auth (managed lösenord, sessions, email-verifiering, Custom Access Token Hook), RLS (28 policies på 7 kärndomäner, 24 bevistester), HTTP-only cookies, Prisma (SQL injection), React (XSS), Zod, ownership guards (`findByIdForProvider`), rate limiting (Upstash Redis), admin audit log (AdminAuditLog, automatisk via `withApiHandler({ auth: "admin" })`), admin session-timeout (15 min via JWT iat), Sentry.

> Se `.claude/rules/api-routes.md` för detaljerad API-säkerhetschecklist.

---

## Agent-Team (3 agenter)

> Se [docs/guides/agents.md](docs/guides/agents.md) för fullständig guide.

```
Ny feature med arkitektur?   -> tech-architect (FÖRE implementation)
Nya API-routes?              -> security-reviewer (EFTER implementation)
Nya sidor/UI-flöden?         -> cx-ux-reviewer (EFTER implementation)
```

---

## Key Learnings (tvärgående)

> Domänspecifika learnings finns i `.claude/rules/`. Selektivt laddade:
> - iOS: `ios-learnings.md` (paths: `ios/**`)
> - Offline: `offline-learnings.md` (paths: `src/lib/offline/*`)
> - RLS: `rls-learnings.md` (paths: `src/__tests__/rls/*`, `src/lib/supabase/*`)

### Serverless & Deploy

- **Serverless-begränsningar**: In-memory state, filesystem writes, long-running processes fungerar INTE.
- **Vercel region MÅSTE matcha Supabase**: `regions: ["fra1"]` i `vercel.json` för `eu-central-2`.
- **`.env.local` trumfar `.env`**: Uppdatera BÅDA vid byte av DATABASE_URL.
- **NODE_ENV opålitlig på Vercel**: Använd explicita env-variabler (`ALLOW_TEST_ENDPOINTS`) istället.
- **Stripe webhook event-ID dedup**: `createMany` + `skipDuplicates` = atomisk INSERT ON CONFLICT DO NOTHING.

### Domain Patterns

- **Fire-and-forget notifier med DI**: `.catch(logger.error)` i API-routen. Pattern i `RouteAnnouncementNotifier.ts`.
- **Kanonisk distance-modul**: `src/lib/geo/distance.ts` är enda källan för Haversine. Duplicera ALDRIG.
- **CustomerLayout för alla kundsidor**: Wrappa ALLTID i `CustomerLayout` (`Header` + `BottomTabBar`).
- **Supabase Auth**: Custom Access Token Hook (PL/pgSQL). JWT claims: `providerId`, `userType`, `isAdmin`.
- **Publik vs skyddad URL-konvention**: `/api/stable/*` = auth-skyddad, `/api/stables/*` = publik.

### Utvecklingsmönster

- **Button type="button" i forms**: shadcn/ui `<Button>` utan explicit `type` defaultar till `type="submit"`.
- **Rate limiter fail-closed**: `RateLimitServiceError` -> 503. Rate limiting EFTER auth, FÖRE JSON-parsing.
- **Payload-minimering**: `select`-block ska BARA ha fält UI:t använder. `groupBy` > hämta-alla + JS-loop.
- **Strukturerad loggning**: Server: `logger`. Klient: `clientLogger`. ALDRIG `console.*` i produktionskod.
- **Plan-commit-ordning**: Committa plan-fil på main → PUSHA → SEDAN skapa feature-branch. Annars: divergent branches vid PR-merge. Fix om det hänt: `git rebase main` på feature-branchen. Se `.claude/rules/commit-strategy.md`.
- **git checkout-miss**: Verifiera alltid `git branch --show-current` INNAN commit. Om commit hamnade på fel branch: `git cherry-pick <hash>` på rätt branch + `git reset --hard HEAD~1` på fel branch.

**Vilken testplaybook?** Swift-fil -> iOS-testflöde (`ios-learnings.md`). TypeScript/JS-fil -> Webb-testflöde (nedan).

### Webb-testflöde

- **Nivå 1** (under arbete): `npx vitest run src/domain/<namn>` (~1s) + `npm run typecheck` (~10s)
- **Nivå 2** (inför PR): `npm run check:all` (~50s, 4 gates)
- **E2E**: Separat spår. `test:e2e:smoke` efter breda UI-ändringar, `test:e2e:critical` efter boknings-/betalningsändringar. Se `e2e-playbook.md`.
- **Offline E2E**: `npm run test:e2e:offline` efter Service Worker/offline-ändringar. Kräver prod-build (webpack + Serwist). Körs i CI som `offline-smoke`.
- **Dubbelkörning**: Pre-push-hooken kör samma som check:all. Kör inte båda.

---

## Debugging: 5 Whys

När vi hittar en bugg, kör alltid "5 Whys" innan vi börjar fixa. Fråga "varför?" upprepat tills vi hittar rotorsaken. Vi fixar grundproblemet, inte symptomen.

---

## Version & SDK Policy

- **Lita INTE på training data** -- sök upp aktuell version innan import/install.
- **AI modell-IDn: ALLTID alias** (`claude-sonnet-4-6`), ALDRIG daterade.

---

## Automated Quality Gates

- **Pre-commit:** `check:swedish` + `typecheck` (om .ts/.tsx staged) + plan-commit-gate (varning om story in_progress utan plan) + sprint-avslut-gate (varning om alla stories done utan retro)
- **Pre-push:** `check:swedish` + `test:run` + `typecheck` + `lint` + multi-commit-gate (varning om <2 commits på feature branch)
- **Allt-i-ett:** `npm run check:all` (alla 4 gates)
- **CI:** Unit tests + coverage, E2E, Offline E2E smoke, TypeScript, Build
- **Hooks:** 10 Claude Code hooks i `.claude/hooks/` (API-check, TDD-reminder, DoD, etc)

---

## Sprintar

> Se [docs/sprints/](docs/sprints/) för aktuell och tidigare sprintar.

---

## Resurser

- **prisma/schema.prisma** - Databasschema (source of truth)
- **src/lib/auth-dual.ts** - Auth helper (Supabase Auth, DB-lookup för providerId)
- **src/lib/supabase/server.ts** - Supabase server client
- **src/lib/supabase/browser.ts** - Supabase browser client
- [Next.js Docs](https://nextjs.org/docs) | [Prisma Docs](https://www.prisma.io/docs) | [shadcn/ui Docs](https://ui.shadcn.com)

---

## Working with Claude -- Proven Playbook

> Fullständig playbook i [retro](docs/retrospectives/2026-technical-cleanup-retro.md).

- **Workflow**: Analys -> Pilot (2-3 filer) -> Batch (parallella agenter) -> Pausa vid avtagande värde
- **Prompts**: Små avgränsade uppgifter, tydliga constraints, explicit före/efter-mönster
- **Stark på**: Mekaniska batchändringar, kodanalys, testgenerering, dokumentation
- **Svag på**: Säkerhetsbedömningar (verifiera manuellt), "allt klart"-påståenden (kör `git status`)
- **Guardrails**: `git status` efter varje session, `npm run lint` före push, verifiera auth/IDOR/payment manuellt
- **Anti-patterns**: "Migrera allt", flera concerns per commit, inte verifiera output, >30 rader i prompts

---

**Senast uppdaterad**: 2026-04-19
