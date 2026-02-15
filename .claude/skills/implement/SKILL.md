---
name: implement
description: Autonomously implement a plan document with TDD, phase-by-phase verification, and quality gates
argument-hint: "<path to plan file, e.g. docs/plans/my-feature.md>"
---

Implement the plan at: **$ARGUMENTS**

Execute the plan autonomously with TDD, incremental verification between phases, and quality gates.

## 0. Pre-flight

Before starting, verify prerequisites:

```bash
npm run typecheck   # Must be 0 errors before we start
```

If typecheck fails, STOP and report. Do not implement on a broken baseline.

## 1. Analyze the plan

Read the plan document and extract:

1. **Phases/steps** -- identify the ordered implementation phases
2. **Files per phase** -- which files will be created or modified
3. **Dependencies** -- which phases depend on earlier phases
4. **Migration needs** -- any Prisma schema changes
5. **E2E impact** -- will existing E2E tests need updates?

Present a brief summary to the user:

```
Plan: <title>
Phases: N
Files: ~M total
Migrations: yes/no
E2E impact: yes/no

Phase 1: <description> (N files)
Phase 2: <description> (N files)
...
```

Then proceed to plan validation.

## 1b. Validate plan completeness

Before starting implementation, quickly scan the plan for common quality gaps.
For each item below, check if the plan addresses it. If not, note it and account
for it during implementation. This is NOT a gate -- it's a quick sanity check.

### API routes checklist (if plan includes new/changed API routes)
- [ ] Auth pattern specified (session check)
- [ ] Rate limiting mentioned
- [ ] Zod validation with `.strict()`
- [ ] Where does providerId/customerId come from? (must be session)
- [ ] Error messages language (must be Swedish)

### Data model checklist (if plan includes schema changes)
- [ ] Is this a core domain? (Booking, Provider, Service, Review, CustomerReview, Horse) -> needs repository
- [ ] New fields on existing models? -> check ALL select blocks in codebase
- [ ] Migration strategy for existing data? (NOT NULL without default fails)

### UI checklist (if plan includes new pages/components)
- [ ] Swedish strings identified (labels, placeholders, errors, toasts)
- [ ] Mobile-first considered? (responsive pattern)
- [ ] Which existing components to reuse? (Dialog, VoiceTextarea, StarRating)

### Missing from plan?

List anything the plan should have addressed but didn't. Add these as
notes to carry into implementation. If everything looks good, note "Plan covers
all quality dimensions" and proceed.

## 1c. Choose implementation strategy

The plan can be implemented with two strategies. Choose based on the feature's characteristics:

### Layer-by-layer (default)

Best for: features with well-understood integration points, pure backend work, or pure UI work.

```
Phase 1: Schema + migration
Phase 2: Repository + service + tests
Phase 3: API route + tests
Phase 4: UI components
Phase 5: Integration
```

### Walking Skeleton (alternative)

Best for: features that touch all three layers (schema + API + UI) AND where integration
contracts are uncertain (new data shapes, unfamiliar UI patterns, first use of an API).

```
Phase 1: Thin vertical slice (minimal schema + simple API route + simple UI component, all connected)
Phase 2: Fill in business logic (repository, service, validation, tests)
Phase 3: Fill in UI details (mobile, error handling, edge cases, polish)
```

**Walking Skeleton rules:**
- Phase 1 uses hardcoded/minimal data -- just enough to prove the layers connect
- Phase 1 skips tests (it's a spike through the stack, not production code yet)
- Phase 2 adds TDD as normal -- write tests for the real business logic
- Phase 3 handles all the edge cases the skeleton ignored

**When to choose Walking Skeleton:**
- The plan mentions a new data shape that the UI will consume (select-block mismatches found early)
- The feature involves a UI pattern you haven't used before in this project
- The plan has 4+ phases and the last phase is "integration" or "connect the pieces"
- You're unsure if the API response shape will work well for the UI

Note the strategy choice in your summary output:
```
Strategy: Walking Skeleton (touches all layers, new data shape)
```
or
```
Strategy: Layer-by-layer (backend-only change)
```

## 2. Implement phase by phase

For EACH phase, follow this cycle:

### 2a. TDD -- Write tests FIRST

- For API routes: write route.test.ts with behavior-based assertions
- For domain services: write service.test.ts
- For UI changes: skip unit tests (verified by typecheck + E2E)
- Run the new tests -- verify they FAIL (RED):

```bash
npm run test:run -- --reporter=dot <path-to-test-file> 2>&1 | tail -10
```

### 2b. Implement

- Write the minimum code to make tests pass
- Follow existing patterns in the codebase (check CLAUDE.md Key Learnings)
- ALL Swedish UI strings MUST use correct characters

### 2c. Verify phase (GREEN)

Run tests for the changed files:

```bash
npm run test:run -- --reporter=dot 2>&1 | tail -10
```

- If tests FAIL: fix the implementation, do NOT move to next phase
- If tests PASS: run typecheck:

```bash
npm run typecheck 2>&1
```

- If typecheck FAILS: fix type errors before moving on
- Maximum 3 fix attempts per phase. If still failing after 3, STOP and report what's blocking.

### 2d. Report phase completion

After each phase passes:

```
Phase N/M complete
  Files changed: <list>
  Tests: X passed, Y new
  Typecheck: 0 errors
```

Then proceed to next phase.

## 3. Final verification

After ALL phases are complete, run the full quality gate:

### 3a. Full test suite

```bash
npm run test:run -- --reporter=dot 2>&1 | tail -10
```

ALL tests must pass. If any regressed, fix them.

### 3b. TypeScript

```bash
npm run typecheck 2>&1
```

Must be 0 errors.

### 3b2. Lint

```bash
npm run lint 2>&1
```

Must have 0 errors. Fix any lint issues before proceeding.

### 3c. Swedish character audit

```bash
npm run check:swedish
```

If the check fails, fix the Swedish characters and run again.

### 3d. Security spot-check (for API routes)

First, check if any API routes were created or changed:

```bash
git diff --name-only | grep "src/app/api/"
```

If API route files were changed, run the security-check skill on each changed route.

Additionally verify manually:
- [ ] Auth check (session) at the top
- [ ] Rate limiting applied
- [ ] JSON parsing in try-catch
- [ ] Zod validation with `.strict()`
- [ ] providerId/customerId from session (NEVER from request body)
- [ ] `select` (never `include`) in Prisma queries
- [ ] Error messages in Swedish

### 3e. console.log check

```bash
# Check changed files for console.log in API routes
git diff --name-only | grep "src/app/api/" | head -20
```

If any API route files changed, verify they use `logger` not `console.*`.

### 3f. UX review flag

Check if new pages were created:

```bash
git diff --name-only | grep "src/app/(protected)\|src/app/(public)"
```

If new pages were created, add to the summary report:
"UX review recommended -- run cx-ux-reviewer on new pages."

## 4. Summary report

Present a final report:

```
Implementation complete

Plan: <title>
Phases completed: N/N

Files changed: X
Files created: Y
Tests added: Z
Total tests: NNNN (all passing)
Typecheck: 0 errors
Swedish audit: OK
Security: OK (or N/A if no API routes)

Changes ready to commit. Run /ship to commit and push.
```

## Important rules

- **NEVER skip the test-between-phases step** -- this is the whole point of the skill
- **NEVER continue to next phase if current phase has failing tests**
- **3 fix attempts max per phase** -- if still failing, stop and ask the user
- **Follow existing patterns** -- read nearby files before implementing
- **Migrations**: If the plan includes schema changes, create the migration FIRST before any code that depends on it
- **E2E tests**: Do NOT run E2E during implementation (too slow). Flag E2E impact in the summary so the user can run them separately.
- **Do NOT commit** -- leave that to the user (they'll run /ship)
- **Use todo-lists** to track phase progress so the user can follow along
