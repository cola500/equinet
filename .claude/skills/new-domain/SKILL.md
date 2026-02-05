---
name: new-domain
description: Scaffold a new DDD-Light domain with repository, service, and factory patterns
argument-hint: "[domain name, e.g. Invoice]"
---

Scaffold a new DDD-Light domain for **$ARGUMENTS** following the proven Review pattern (5 successful migrations).

## Overview

Create these files in order (TDD - tests first for each layer):

```
src/infrastructure/persistence/$ARGUMENTS/
├── I${Name}Repository.ts      # Interface (contract)
├── Mock${Name}Repository.ts   # In-memory (for tests)
├── ${Name}Repository.ts       # Prisma (production)
└── ${Name}Repository.test.ts  # Repository tests

src/domain/$ARGUMENTS/
├── ${Name}Service.ts           # Business logic
├── ${Name}Service.test.ts      # Service tests (uses MockRepository)
└── types.ts                    # Error types, DTOs (optional)
```

## Step 1: Prisma Schema

Add the model to `prisma/schema.prisma` first (schema-first development). Then run:
```bash
npx prisma migrate dev --name add_$ARGUMENTS
```

## Step 2: Repository Interface

Define the contract in `I${Name}Repository.ts`:

```typescript
import { IRepository } from '../IRepository'

export interface ${Name} {
  id: string
  // ... fields matching Prisma model
  createdAt: Date
}

export interface Create${Name}Data {
  // ... fields needed for creation (no id, no createdAt)
}

export interface I${Name}Repository extends IRepository<${Name}> {
  // Domain-specific queries
  findByProviderId(providerId: string): Promise<${Name}[]>

  // Auth-aware mutations (atomic WHERE clause)
  updateWithAuth(id: string, data: Partial<${Name}>, ownerId: string): Promise<${Name} | null>
  deleteWithAuth(id: string, ownerId: string): Promise<boolean>

  create(data: Create${Name}Data): Promise<${Name}>
}
```

## Step 3: Mock Repository (for testing)

Create `Mock${Name}Repository.ts`:

```typescript
export class Mock${Name}Repository implements I${Name}Repository {
  private items: Map<string, ${Name}> = new Map()

  // Implement all interface methods using the Map
  // Add test helpers: clear(), seed(), getAll()
}
```

## Step 4: Prisma Repository (production)

Create `${Name}Repository.ts`:

```typescript
export class ${Name}Repository implements I${Name}Repository {
  // CRITICAL: Define select objects, NEVER use include
  private readonly baseSelect = {
    id: true,
    // ... only fields needed
    createdAt: true,
  } satisfies Prisma.${Name}Select

  // Auth-aware mutations use atomic WHERE clause:
  async updateWithAuth(id: string, data: Partial<${Name}>, ownerId: string): Promise<${Name} | null> {
    try {
      return await prisma.${name}.update({
        where: { id, ownerId },  // Auth in WHERE = atomic
        data,
        select: this.baseSelect,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null  // Not found or not authorized
      }
      throw error
    }
  }
}
```

## Step 5: Domain Service

Create `${Name}Service.ts` with dependency injection:

```typescript
export interface ${Name}ServiceDeps {
  repository: I${Name}Repository
  // ... other dependencies
}

export class ${Name}Service {
  constructor(private readonly deps: ${Name}ServiceDeps) {}

  async create(input: Create${Name}Input): Promise<Result<${Name}, ${Name}Error>> {
    // 1. Validate business rules
    // 2. Authorization checks
    // 3. Delegate to repository
    // 4. Side effects (notifications, etc.)
    return Result.ok(created)
  }
}

// Factory function for production use in routes
export function create${Name}Service(): ${Name}Service {
  return new ${Name}Service({
    repository: new ${Name}Repository(),
    // ... wire up dependencies
  })
}
```

## Step 6: Write tests (TDD)

**Service tests** use MockRepository - fast, no DB needed:
```typescript
describe('${Name}Service', () => {
  let service: ${Name}Service
  let mockRepo: Mock${Name}Repository

  beforeEach(() => {
    mockRepo = new Mock${Name}Repository()
    service = new ${Name}Service({ repository: mockRepo })
  })
})
```

**Route tests** are behavior-based - test HTTP contract, not internals.

## Checklist

- [ ] Prisma schema added + migration created
- [ ] IRepository interface defined
- [ ] MockRepository implements interface
- [ ] PrismaRepository uses `select` (never `include`)
- [ ] PrismaRepository uses atomic WHERE for auth
- [ ] Domain Service with Result pattern
- [ ] Factory function for production DI
- [ ] Tests written FIRST at each layer
- [ ] Error contract defined (error type -> HTTP status)
