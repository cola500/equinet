---
paths:
  - "src/app/api/**/route.ts"
---

# API Route Requirements

## Obligatorisk struktur

```typescript
export async function POST(request: Request) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })

    // 2. Rate limiting FORE request-parsing
    await rateLimiter(request)

    // 3. Parse JSON med error handling
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 4. Validera med Zod (.strict()!)
    const validated = schema.strict().parse(body)

    // 5. Authorization: providerId/customerId fran session, ALDRIG request body
    // 6. Databas-operation med select (aldrig include)
    const result = await prisma.model.create({
      data: validated,
      select: { id: true, /* ... */ }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Valideringsfel", details: error.issues }, { status: 400 })
    }
    logger.error("Error:", error)
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
```

## Filstruktur

```
src/app/api/[feature]/
├── route.ts              # GET, POST
├── route.test.ts         # Tester
├── [id]/
│   ├── route.ts          # GET, PUT, DELETE
│   └── route.test.ts
```

## Checklist

- [ ] `auth()` forst
- [ ] Rate limiting FORE request-parsing (annars kan angripare spamma utan throttling)
- [ ] JSON parsing i try-catch (400, inte 500)
- [ ] Zod med `.strict()` (avvisar okanda falt)
- [ ] `providerId`/`customerId` fran session, ALDRIG request body
- [ ] `select` (aldrig `include`) -- forhindrar PII-exponering (t.ex. passwordHash)
- [ ] Felmeddelanden pa svenska: "Ej inloggad", "Atkomst nekad", "Ogiltig JSON", "Valideringsfel", "Internt serverfel"
- [ ] `logger` (INTE `console.*`)
- [ ] Karndomaner (Booking, Provider, Service, CustomerReview, Horse) via repository, inte Prisma direkt
- [ ] `$transaction` kraver `@ts-expect-error` (kanda TS-inferensproblem)
- [ ] Admin-routes: `requireAdmin()` fran `src/lib/admin-auth.ts` (kastar Response 401/403)

## AI-route-specifikt

- LLM-output MASTE Zod-valideras: `safeParse()` + `.default()` + `.transform()`
- Validera referens-ID:n mot kand context (prompt injection-skydd)
- Rate limiting extra viktigt (kostnadsskydd)
- POST utan body for AI-generering ar OK (all data server-side)
