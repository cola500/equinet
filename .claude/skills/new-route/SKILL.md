---
name: new-route
description: Scaffold a new API route following the project's established patterns with TDD
argument-hint: "[resource name, e.g. invoices]"
---

Create a new API route for **$ARGUMENTS** using TDD and the project's established patterns.

## Step 1: Plan the route

Before writing code, clarify:
- What HTTP methods are needed? (GET, POST, PUT, DELETE)
- Is this a core domain (needs repository) or support domain (Prisma direct OK)?
- What error codes should each failure return? Define the error contract first.

Core domains requiring repository: Booking, Provider, Service, Review, CustomerReview.

## Step 2: Write the TEST first (TDD Red phase)

Create `src/app/api/$ARGUMENTS/route.test.ts` following behavior-based testing:

```typescript
// Test the HTTP CONTRACT, not implementation details
// MANDATORY assertions for every route test:
// 1. Response status codes
// 2. Response body shape (toMatchObject)
// 3. Security: no sensitive data leaked (passwordHash, email in public endpoints)
// 4. Auth: 401 for unauthenticated requests
// 5. Validation: 400 for invalid input
```

Run the test - verify it FAILS (Red).

## Step 3: Implement the route (TDD Green phase)

Create `src/app/api/$ARGUMENTS/route.ts` following this EXACT order:

```typescript
export async function POST(request: Request) {
  try {
    // 1. AUTH - always first
    const session = await auth()
    if (!session) return new Response("Unauthorized", { status: 401 })

    // 2. RATE LIMIT - BEFORE parsing (prevents spam without triggering limit)
    const { success } = await rateLimiters.general.limit(session.user.id)
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    // 3. PARSE JSON - must have try-catch! (Gotcha #2)
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // 4. ZOD VALIDATION - use .strict() to reject extra fields
    const validated = schema.strict().parse(body)

    // 5. DOMAIN LOGIC
    // Core domain: use service via factory
    //   const service = createXyzService()
    //   const result = await service.doSomething(validated)
    // Support domain: Prisma direct is OK
    //   const result = await prisma.model.create({ data: validated })

    // 6. AUTHORIZATION - atomic WHERE clause, NEVER check-then-act (Gotcha #6 IDOR)
    // where: { id, providerId: session.user.providerId }

    // 7. RESPONSE
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    logger.error("Error in POST $ARGUMENTS:", error)
    return new Response("Internal error", { status: 500 })
  }
}
```

Run the test - verify it PASSES (Green).

## Step 4: Refactor

- Extract shared logic if needed
- Ensure `select` is used (NEVER `include`) for Prisma queries (Gotcha #7)
- Verify no PII leaks in response

## Critical gotchas to avoid

- **Dynamic params are Promises** in Next.js 16: `const { id } = await params` (Gotcha #1)
- **JSON parse needs try-catch**: Otherwise 500 instead of 400 (Gotcha #2)
- **Rate limit BEFORE parsing**: Otherwise attackers bypass it (Gotcha #5)
- **Atomic WHERE for auth**: Never check-then-act, put auth in WHERE clause (Gotcha #6)
- **select, never include**: Prevents PII exposure + better performance (Gotcha #7)
- **Zod uses `.issues`**, not `.errors` (Gotcha #2)
- **Use `logger`**, not `console.error`

## File structure

```
src/app/api/$ARGUMENTS/
├── route.ts              # GET, POST
├── route.test.ts         # Tests for GET, POST
├── [id]/
│   ├── route.ts          # GET, PUT, DELETE by ID
│   └── route.test.ts     # Tests for single-resource operations
```
