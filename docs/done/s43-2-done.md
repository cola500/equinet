---
title: "S43-2 Done — Första batch: flytta 5 specs till integration-nivå"
description: "Done-fil för S43-2: migration av 5 E2E-specs (data-display/CRUD-API) till integration-tester"
category: testing
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S43-2 Done — Första batch: flytta 5 specs till integration-nivå

**Branch:** `feature/s43-2-first-batch`  
**Datum:** 2026-04-19

---

## Acceptanskriterier

- [x] 4-6 specs flyttade (5 specs migrerade: due-for-service, customer-due-for-service, customer-insights, customer-registry, business-insights)
- [x] Integration/component-tester gröna (34 nya tester, alla gröna)
- [x] `npm run check:all` grön (4/4: typecheck, test:run 4232 passed, lint, check:swedish)
- [x] E2E-svit körs under nuvarande tid (5 specs borttagna = snabbare)
- [x] Batch-rapport i `docs/metrics/testpyramid/batch-1-2026-04-19.md`

---

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod, error handling, ingen XSS/injection)
- [x] Tester skrivna FÖRST (RED → GREEN), coverage >= 70%
- [x] Feature branch, `check:all` grön, klar för merge via PR

---

## Reviews körda

Kördes: ingen (trivial story — mekanisk migration, check:all grön, ingen ny logik, ingen API-yta ändrad, inga säkerhetsändringar)

---

## Docs uppdaterade

- `docs/metrics/testpyramid/batch-1-2026-04-19.md` — ny batch-rapport
- `docs/plans/s43-2-plan.md` — S43-2 plan (committad före implementation)
- `docs/done/s43-2-done.md` — denna fil

Ingen uppdatering av README.md/NFR.md (intern refactoring, inga nya features, inga användarvändiga ändringar).

---

## Verktyg använda

- Läste `docs/architecture/patterns.md` vid planering: nej (migration, inte ny arkitektur)
- Kollade `code-map.md` för att hitta filer: ja (verifierade auth-mönster per route)
- Hittade matchande pattern: "integration test-mönster" (`vi.hoisted` + `NextRequest` direkt) — etablerat i S43-1

---

## Arkitekturcoverage

Designdokument: `docs/plans/testpyramid-omfordelning.md` (Discovery-plan) + `docs/plans/s43-2-plan.md`  
Alla numrerade beslut implementerade: ja (5/5 specs i scope migrerade)

---

## Modell

`sonnet`

---

## Lärdomar

### Korrigering av Discovery-plan hittades i tid
Discovery-planen hade fel målsökväg för customer-insights (`customer/insights/` finns inte). Korrekt sökväg är `provider/customers/[customerId]/insights/`. Plan-granskning av faktisk kodbas behövs — Discovery-plan är skriven utan att läsa routes.

### Befintlig route.test.ts kan täcka integration-test-behovet
customer-insights och customer-registry har befintliga `route.test.ts` som redan importerar route-handler direkt och mockar bara gränser. Det ÄR integration-test-mönstret. I dessa fall: skapa minimal smoke (3-4 tester) som batch-ankar, inte fullständig kopia.

### `withApiHandler`-routes vs gamla routes — auth-mockningsskillnad
- **`withApiHandler`-routes**: mocka `@/lib/auth-dual` → `getAuthUser`; returnera `{ id, email, userType, providerId, stableId, authMethod }`
- **Gamla routes**: mocka `@/lib/auth-server` → `auth`; returnera `{ user: { id, providerId } }`
- Kontrollera alltid vilken import routen faktiskt använder.

### `RateLimitServiceError` måste inkluderas för withApiHandler-routes
Om `vi.mock('@/lib/rate-limit')` saknar `RateLimitServiceError: class RateLimitServiceError extends Error {}` kastar `withApiHandler` vid import.

### `setCachedProviderInsights` är fire-and-forget
Routen anropar `setCachedProviderInsights(...).catch(() => {})` — asynkront utan await. Verifiera med `vi.waitFor()` inte synkron assertion.

### `groupBy` returnerar `[]` som default
`prisma.booking.groupBy` är mockad med `vi.fn().mockResolvedValue([])` som default. Vid flera `groupBy`-anrop (t.ex. stats + noShows) — använd `mockResolvedValueOnce` för att kontrollera varje anrop separat.
