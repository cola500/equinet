---
paths:
  - "e2e/**/*.spec.ts"
  - "e2e/**/*.ts"
---

# E2E Test Requirements

## Seed & Cleanup

- **Global seed**: `seed-e2e.setup.ts` -- BARA read-only basdata
- **Per-spec seed**: `e2e/setup/seed-helpers.ts` -- `seedBooking()`, `seedRouteOrders()`, etc.
- **Marker**: `E2E-spec:<specTag>` i customerNotes/specialInstructions
- **Cleanup**: Global teardown + per-spec `afterAll` med `cleanupSpecData(tag)`
- **Rate limit**: `reset-rate-limit` endpoint resettar ALLA 9 limiter-typer

## Selektorer

- `getByRole` > `getByLabel` > `getByPlaceholder` -- mest robust
- shadcn Cards: `[data-slot="card"]` eller `getByRole('link', { name: /.../ })` (INTE `.border.rounded-lg`)
- Kalender-block: `button.absolute.border-l-4[class*="bg-green"]`
- Mobil viewport: `getByRole('heading', { exact: true })` (desktop-nav doljs med `hidden md:block`)

## Obligatoriska patterns

- **Cookie-consent dismissal**: Hanteras globalt i `e2e/fixtures.ts` via `addInitScript(() => localStorage.setItem('equinet-cookie-notice-dismissed', 'true'))`. Behöver INTE göras per test.
- **Rate-limit reset**: ALLTID i `beforeEach` -- `await page.request.post('/api/test/reset-rate-limit').catch(() => {})`. Saknad reset är vanligaste orsaken till flaky E2E.

## Gotchas

- **Undvik `waitForTimeout()`** -- anvand explicit waits (`waitFor({ state: 'visible' })`)
- **Unika identifiers** med `Date.now()` for test isolation
- **Varje test MASTE vara oberoende** -- dela ALDRIG state mellan tester
- **`futureWeekday()`** fran `e2e/setup/e2e-utils.ts` -- garanterar vardag (man-fre)
- **Annons-status**: `seedProviderAnnouncement()` maste ha `status: 'open'` (inte `pending`)
- **Route stop tvastegsflode**: pending -> "Paborja besok" -> in_progress -> "Markera som klar"
- **Iterate-pattern**: `cards.nth(i)` istallet for `.first()` nar UI har flera matchande element
- **Kor ALDRIG desktop+mobil E2E samtidigt**: Delar dev-server, ger falska failures
- **Skip-pattern**: `test.skip(test.info().project.name === 'mobile', 'reason')`
- **Kor isolerat vid debugging**: `npx playwright test file.spec.ts:215`
