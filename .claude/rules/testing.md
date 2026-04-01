---
title: "Test Requirements"
description: "BDD dual-loop, TDD-cykeln, integration vs unit, coverage-mal, behavior-based testing och mock-patterns"
category: rule
status: active
last_updated: 2026-04-01
tags: [testing, tdd, bdd, vitest, mocking, behavior-based, integration]
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.integration.test.ts"
sections:
  - BDD Dual-Loop
  - Integration vs Unit -- nar anvanda vad
  - TDD-cykeln
  - Coverage-mal
  - Behavior-Based Testing (API Routes)
  - Mock-patterns
  - Gotchas
---

# Test Requirements

## BDD Dual-Loop

För API routes och domain services -- använd **BDD dual-loop**:

```
1. RED (integration)  -- Skriv ETT integrationstest som beskriver onskad beteende.
                         Bekrafta att det failar av ratt anledning.
2. Inre loop (unit)   -- Upprepa tills integrationstestet passerar:
     RED:    minsta unit-test for nasta saknade del
     GREEN:  minimum kod for att passera
     REFACTOR: rensa medan unit-tester ar grona
3. GREEN (integration) -- Kor integrationstestet igen. Failar det -> tillbaka till steg 2.
4. REFACTOR           -- ALLA tester maste forbli grona.
```

## Integration vs Unit -- nar anvanda vad

| Typ | Fil-suffix | Vad mockas | Vad kor riktigt | Nar |
|-----|------------|------------|-----------------|-----|
| **Integration** | `.integration.test.ts` | DB (Prisma), extern I/O (email, Redis, Stripe) | Route handler + domain service + repositories (via class mock) | Karndomaner, kritiska floden |
| **Unit** | `.test.ts` | Allt utom det som testas | En enskild funktion/klass | Utilities, helpers, isolerad logik |

### Integration test -- mock-strategi

Mocka bara **granser** (databas, extern I/O). Lat **domain services kora riktigt**:

```typescript
// 1. Class mock for repository (ALDRIG vi.fn().mockImplementation -- funkar inte for new)
const mockRepo = {
  findById: vi.fn(),
  create: vi.fn(),
}

vi.mock('@/infrastructure/persistence/X/PrismaXRepository', () => ({
  PrismaXRepository: class MockRepo {
    findById = mockRepo.findById
    create = mockRepo.create
  },
}))

// 2. Mock extern I/O
vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/email', () => ({
  sendEmailVerificationNotification: vi.fn(),
}))

// 3. DO NOT mock domain services -- lat createXService() kora riktigt
// import { POST } from './route'  // efter alla mocks
```

### Nar kravs integration test?

- **Obligatoriskt**: Karndomaner (Booking, Auth, Payment, Review, Customer, GroupBooking)
- **Rekommenderat**: Alla nya API routes med affarslogik
- **Ej nodvandigt**: Simpel CRUD utan affarslogik, admin-routes, utilities

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

- **`as never` i testmockar**: Ersatt `as any` med `as never` i alla mock-returvarden. `never` ar assignerbar till alla typer utan att trigga `no-explicit-any`. Universellt monster.
- **Class mock för `new`-anrop**: `vi.fn().mockImplementation(() => obj)` funkar INTE för constructors i Vitest. Använd `class MockX { method = mockObj.method }` i vi.mock-factory.
- **Alla repository-metoder i class mock**: Inkludera ALLA metoder fran IRepository-interfacet, aven om testet bara anvandar nagra. Annars kastar riktig service `undefined is not a function`.

## Gotchas

- **Zod v4 UUID**: Kraver korrekt UUID v4-format. `a0000000-0000-4000-a000-000000000001` funkar, `00000000-0000-0000-0000-000000000001` funkar INTE.
- **FormData i vitest**: JSDOM stodjer inte `FormData` + `File` -- mocka `request.formData()` direkt.
- **`vi.mock()` maste inkludera ALLA exports**: Icke-mockade exports blir `undefined`. Inkludera ALLTID alla anvanda exports i mock-factory.
