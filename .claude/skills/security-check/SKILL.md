---
name: security-check
description: Security audit checklist for API routes based on project gotchas and retros
argument-hint: "[route path, e.g. src/app/api/bookings/route.ts]"
---

Run a security audit on: **$ARGUMENTS**

Read the file(s) and check each item below. Report findings as PASS/FAIL/N-A with specific line references.

## Checklist

### 1. Authentication (Gotcha #9)
- [ ] `auth()` called at the start of every handler
- [ ] Returns 401 if no session
- [ ] Uses `session.user.id` / `session.user.providerId` from session, NEVER from request body

### 2. Rate Limiting (Gotcha #5)
- [ ] Rate limiter applied BEFORE JSON parsing
- [ ] Uses Upstash Redis (`rateLimiters`), not in-memory Map
- [ ] Returns 429 on limit exceeded

### 3. Input Validation
- [ ] JSON parsing wrapped in try-catch (Gotcha #2 - otherwise 500 instead of 400)
- [ ] Zod schema with `.strict()` to reject extra fields
- [ ] Error response uses `error.issues` not `error.errors` (Gotcha #2)

### 4. Authorization - IDOR Prevention (Gotcha #6)
- [ ] No check-then-act pattern (TOCTOU race condition)
- [ ] Authorization is in WHERE clause (atomic): `where: { id, providerId }`
- [ ] Returns 404 (not 403) when record not found or not owned

### 5. Data Exposure (Gotcha #7)
- [ ] Uses `select` (NEVER `include`) in Prisma queries
- [ ] No `passwordHash`, `email`, `phone` in public API responses
- [ ] Response shape is intentional - no accidental field exposure

### 6. Error Handling
- [ ] Uses `logger.error()` not `console.error()`
- [ ] Catches ZodError separately (400) vs generic errors (500)
- [ ] No stack traces or internal details in production error responses

### 7. Next.js 16 Specifics (Gotcha #1)
- [ ] Dynamic params are awaited: `const { id } = await params`
- [ ] Not using `params.id` directly (would fail at runtime)

### 8. Database Safety (Gotchas #13, #14, #17)
- [ ] Batch operations use `$transaction` (not Promise.all with separate queries)
- [ ] Date fields use UTC: `new Date("YYYY-MM-DDT00:00:00.000Z")`
- [ ] Uses `upsert` instead of check-then-create where applicable

## Output format

For each check, report:
```
1. Auth:        PASS - auth() on line 12, 401 on line 14
2. Rate limit:  FAIL - rate limiting missing entirely
3. Validation:  PASS - Zod on line 25, try-catch on line 18
...
```

Summarize with total PASS/FAIL counts and prioritized fix recommendations.
