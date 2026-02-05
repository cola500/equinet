---
name: debug-e2e
description: Systematic debugging of flaky or failing E2E tests
argument-hint: "[test file or description, e.g. booking.spec.ts:16]"
---

Debug the failing E2E test: **$ARGUMENTS**

Follow this systematic checklist (from 5+ retrospectives on E2E issues):

## Step 1: Reproduce in isolation

```bash
npx playwright test $ARGUMENTS --headed
```

If the test name is ambiguous, find the exact file:
```bash
find e2e/ -name "*.spec.ts" | head -20
```

## Step 2: Check seed data

The test depends on data from `e2e/setup/seed-e2e.setup.ts`. Verify:

- Does the seed create the data this test expects?
- Seed data is tagged with `specialInstructions: 'E2E seed data'` / `customerNotes: 'E2E seed data'`
- Was the seed script modified recently? Check `git log --oneline -5 e2e/setup/`

## Step 3: Check for common flakiness patterns

### Timing issues (most common cause)
```typescript
// BAD: Fixed timeout - flaky!
await page.waitForTimeout(2000)

// GOOD: Explicit wait for element
await page.locator('[data-testid="booking-list"]').waitFor({ state: 'visible' })

// GOOD: Wait for network
await page.waitForResponse(resp => resp.url().includes('/api/bookings'))
```

### Test isolation issues
```typescript
// BAD: Hardcoded data that conflicts between tests
const email = 'test@example.com'

// GOOD: Unique per test run
const email = `test-${Date.now()}@example.com`
```

### Selector fragility
```typescript
// Prefer (most robust to least robust):
page.getByRole('button', { name: 'Boka' })     // Best
page.getByLabel('Email')                         // Good
page.getByTestId('booking-form')                 // OK
page.locator('.booking-form button')             // Fragile
```

## Step 4: Check cleanup

Cleanup runs via `e2e/setup/cleanup-utils.ts`:

- `cleanupDynamicTestData()` is called in fixtures afterEach + global teardown
- `E2E_CLEANUP=false` preserves data for debugging
- Check FK-safe deletion order (children before parents)

If cleanup fails silently, leftover data from previous runs can cause conflicts.

## Step 5: Check the API

If the UI test fails, check if the underlying API works:

```bash
# Run the dev server
npm run dev

# Test the API directly
curl -s http://localhost:3000/api/[endpoint] | jq .
```

## Step 6: Debug with traces

```bash
# Run with full trace for debugging
npx playwright test $ARGUMENTS --trace on

# View the trace
npx playwright show-trace test-results/[test-name]/trace.zip
```

## Environment variables

| Variable | Effect |
|----------|--------|
| `E2E_CLEANUP=false` | Preserve test data for inspection |
| `E2E_ALLOW_REMOTE_DB=true` | Allow running against hosted Supabase dev |

## Known pre-existing failures

- `horses.spec.ts:95` - Delete count mismatch
- `route-planning.spec.ts:47` - Missing heading element
