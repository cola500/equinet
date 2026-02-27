---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Unit Test Requirements

## TDD-cykeln

1. RED: Skriv test som failar
2. GREEN: Skriv minsta mojliga kod for att passera
3. REFACTOR: Forbattra utan att bryta test

## Coverage-mal

- API Routes >= 80%
- Utilities >= 90%
- Overall >= 70%

## Behavior-Based Testing (API Routes)

Testa **vad** API:et gor, inte **hur** det gor det.

```typescript
// FEL: Implementation-based
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({ include: { services: true } })
)

// RATT: Behavior-based
expect(response.status).toBe(200)
expect(data[0]).toMatchObject({
  id: expect.any(String),
  businessName: expect.any(String),
})

// OBLIGATORISKT: Sakerhet-assertions
expect(data[0].user.passwordHash).toBeUndefined()
```

## Mock-patterns

- **`as never` i testmockar**: Ersätt `as any` med `as never` i alla mock-returvärden. `never` är assignerbar till alla typer utan att trigga `no-explicit-any`. Universellt mönster.

## Gotchas

- **Zod v4 UUID**: Kraver korrekt UUID v4-format. `a0000000-0000-4000-a000-000000000001` funkar, `00000000-0000-0000-0000-000000000001` funkar INTE.
- **FormData i vitest**: JSDOM stodjer inte `FormData` + `File` -- mocka `request.formData()` direkt.
- **Class-baserade mocks for `new`-anrop**: Arrow functions ger "is not a constructor".
- **`vi.mock()` maste inkludera ALLA exports**: Icke-mockade exports blir `undefined`. Inkludera ALLTID alla anvanda exports i mock-factory.
