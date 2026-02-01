# Mock-migrationsplan: Prisma-mocks -> Service-mocks

> **Syfte:** Dokumentera strategin for att migrera kvarvarande Prisma-mockar till
> service-mockar i testsviten. Sjalvstandig fas EFTER att DDD-refaktoreringen
> (Fas 1-3 i DDD-TDD-REFACTORING-PLAN.md) ar klar.
>
> **Beroende:** Kravet ar att domanen redan har repository + service + factory.
> Migrera inte tester for domaner som saknar service-lager.

---

## 1. Nulagets-analys

### Siffror (2026-02-01)

| Matpunkt | Antal |
|----------|-------|
| Totalt `vi.mock()` anrop | 141 |
| Testfiler med mockar | 48 |
| Filer som mockar `@/lib/prisma` | 25 (52%) |
| Filer som mockar `@/domain/*` services | 24 (50%) |
| Filer som mockar `@/infrastructure/*` repos | 3 (6%) |

### Mock-fordelning per doman

| Doman | DDD-Light klar? | Route-tester | Mock-typ idag |
|-------|-----------------|--------------|---------------|
| **Horse** | Ja | 7 filer | Service-mock (HorseService factory) |
| **GroupBooking** | Ja | 6 filer | Service-mock (GroupBookingService factory) |
| **Auth** | Ja | 3 filer | Service-mock (AuthService factory) |
| **Review** | Ja | 3+1 filer | Prisma-mock (trots ReviewService finns!) |
| **Booking** | Ja (85%) | 2 filer | Mixed (Prisma + repos + NotificationService) |
| **Notification** | Nej (Prisma direkt) | 3 filer | Service-mock (NotificationService) |
| **RouteOrder** | Nej | 3 filer | Prisma-mock |
| **Provider** | Ja (repo) | 2 filer | Prisma-mock |
| **Availability** | Nej | 3 filer | Prisma-mock |
| **Upload** | Nej | 2 filer | Prisma-mock |
| **Verification** | Nej | 2 filer | Prisma-mock |
| **Passport** | Nej | 1 fil | Prisma-mock |
| **Export** | Nej | 1 fil | Prisma-mock |
| **Fortnox** | Nej | 2 filer | Mixed (Prisma + AccountingGateway) |

### Sammanfattning

- **39% av route-testerna** anvander redan DDD-Light-mockar (service/factory)
- **52% av testfilerna** mockar fortfarande Prisma direkt
- **6 filer** blandar bada monstren (mixed) -- dessa ar fragila och prioriterade

---

## 2. Tva mock-strategier

### Prisma-mock (fragilt monster)

```typescript
// Kopplar testet till Prisma-schema. Varje kolumnandrng -> bruten test.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', rating: 5, comment: 'Bra!', customerId: 'user-1' }
      ]),
      create: vi.fn().mockResolvedValue({ id: '2', rating: 4 }),
    },
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'b1', status: 'completed', customerId: 'user-1'
      }),
    }
  }
}))
```

**Problem:**
- Tester bryts vid kolumnandringar, relationsandringar, eller Prisma-uppgraderingar
- Testar HOW (Prisma-anrop), inte WHAT (API-beteende)
- Mocken maste spegla exakt hur routen anropar Prisma -- fragilt
- Saknar affarslogik-validering (reglerna bor i servicen)

### Service-mock (robust monster)

```typescript
// Kopplar testet till API-kontraktet. Schema-andringar paverkar bara repository.
vi.mock('@/domain/review/ReviewService', () => ({
  createReviewService: vi.fn(() => ({
    createReview: vi.fn().mockResolvedValue(
      Result.ok({ id: '2', rating: 4, comment: 'Bra!', createdAt: new Date() })
    ),
    getReviewsByProvider: vi.fn().mockResolvedValue(
      Result.ok([{ id: '1', rating: 5, comment: 'Bra!' }])
    ),
  }))
}))
```

**Fordelar:**
- Tester overlever Prisma-schema-andringar
- Testar API-kontrakt (HTTP status + response shape)
- Affarsregler testas i service-tester (med MockRepository)
- En mock-andring nar servicen andras -- inte N Prisma-mockar

### Mixed mock (varsta fallet)

```typescript
// Blandar bada monstren -- dubbelt fragilt
vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))
vi.mock('@/domain/notification/NotificationService', () => ({ ... }))
```

Filer med mixed mocks ar prioriterade for migrering -- de har den hogsta underhallskostnaden.

---

## 3. Prioriterad migrationslista

### Prioritet 1: Mixed-mock-filer (6 filer)

Dessa blandar Prisma-mock + service-mock och ar mest fragila.

| Fil | Prisma-mock | Service-mock | Aktion |
|-----|-------------|--------------|--------|
| `reviews/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `reviews/[id]/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `reviews/[id]/reply/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `bookings/[id]/route.test.ts` | `prisma.booking.*` | NotificationService + repos | Migrera till BookingService factory |
| `group-bookings/[id]/match/route.test.ts` | `prisma.provider.*` | GroupBookingService | Acceptera -- stoddomans-lookup |
| `services/[id]/route.test.ts` | -- | ServiceRepository | Redan DDD-Light |

**Forvantad vinst:** 5 filer blir rent service-mockade, 1 accepteras som mixed.

### Prioritet 2: DDD-domaner med kvarvarande Prisma-mock (4 filer)

Dessa har service-lager men route-testerna anvander fortfarande Prisma.

| Fil | Doman | Service finns? | Aktion |
|-----|-------|----------------|--------|
| `providers/[id]/reviews/route.test.ts` | Review | Ja | Migrera till ReviewService factory |
| `bookings/route.test.ts` | Booking | Ja | Migrera till BookingService factory |
| `providers/route.test.ts` | Provider | Repo finns | Migrera till ProviderRepository mock |
| `providers/[id]/route.test.ts` | Provider | Repo finns | Migrera till ProviderRepository mock |

### Prioritet 3: Stoddomaner -- LAT VARA (11 filer)

Dessa har inget service-lager och Prisma-mock ar ratt abstraktionsniva.

| Fil | Doman | Motivering |
|-----|-------|-----------|
| `route-orders/route.test.ts` | RouteOrder | Prisma direkt -- inget DDD planerat |
| `route-orders/[id]/bookings/route.test.ts` | RouteOrder | Prisma direkt |
| `route-orders/announcements/route.test.ts` | RouteOrder | Prisma direkt |
| `availability-schedule/route.test.ts` | Availability | Prisma direkt -- enkel CRUD |
| `availability-exceptions/route.test.ts` | Availability | Prisma direkt |
| `availability-exceptions/[date]/route.test.ts` | Availability | Prisma direkt |
| `verification-requests/route.test.ts` | Verification | Prisma direkt -- admin CRUD |
| `admin/verification-requests/[id]/route.test.ts` | Verification | Prisma direkt |
| `upload/route.test.ts` | Upload | Prisma direkt -- infrastruktur |
| `upload/[id]/route.test.ts` | Upload | Prisma direkt |
| `passport/[token]/route.test.ts` | Passport | Prisma direkt -- read-only |
| `export/my-data/route.test.ts` | Export | Prisma direkt -- GDPR-utility |
| `integrations/fortnox/disconnect/route.test.ts` | Fortnox | Prisma direkt |

---

## 4. Riktlinjer

### Nar service-mock KRAVS

Migrera till service-mock nar:

- [x] Domanen har en service + factory (`createXxxService()`)
- [x] Route-testerna mockar Prisma men service finns
- [x] Filen blandar Prisma-mock + service-mock (mixed)
- [x] Testerna testar affarslogik som redan finns i servicen

### Nar Prisma-mock ar OK

Behal Prisma-mock nar:

- [x] Domanen ar stoddomaner (Prisma direkt enligt DDD-planen)
- [x] Ingen service eller repository existerar
- [x] Routen ar enkel CRUD utan affarsregler
- [x] Det gar support-lookups i en DDD-route (t.ex. provider-lookup i `match/route.ts`)

### Decision tree

```
Har domanen en service + factory?
  |
  +-- Nej -> Behall Prisma-mock
  |
  +-- Ja -> Anvander route-testet Prisma-mock?
        |
        +-- Nej -> Redan migrerat, inget att gora
        |
        +-- Ja -> MIGRERA till service-mock
              |
              +-- Blandar filen Prisma + service? -> Prioritet 1
              +-- Bara Prisma-mock? -> Prioritet 2
```

### Migrerings-checklist per fil

```markdown
- [ ] Las route-testet -- identifiera alla vi.mock() anrop
- [ ] Verifiera att servicen stodjer alla mockade operationer
- [ ] Byt vi.mock('@/lib/prisma') -> vi.mock('@/domain/xxx/XxxService')
- [ ] Uppdatera test-assertions till att testa HTTP-kontrakt
- [ ] Kor testet -- verifiera att det passerar
- [ ] Ta bort alla Prisma-relaterade imports
- [ ] Kor full testsvit (npm test -- --run)
```

---

## 5. Sammanfattning

| Kategori | Filer | Aktion |
|----------|-------|--------|
| Redan DDD-Light-mockar | 19 filer | Inget att gora |
| Prioritet 1 (mixed) | 5 filer | Migrera (hogst prio) |
| Prioritet 2 (DDD-doman med Prisma-mock) | 4 filer | Migrera |
| Prioritet 3 (stoddomaner) | 11 filer | Behall Prisma-mock |
| Domain service-tester | 5 filer | Inget att gora (MockRepository) |
| Ovriga (hooks, cron) | 4 filer | Bedomning per fil |

**Total migreringsinsats:** 9 filer att migrera, 11 att medvetet lata vara.

**Forvantad situation efter migrering:**
- 28+ av 48 testfiler anvander service-mocks (58% -> uppskattning)
- 0 mixed-mock-filer (ner fran 6)
- 11 filer med medveten Prisma-mock for stoddomaner

---

*Skapat: 2026-02-01*
*Relaterat: [DDD-TDD-REFACTORING-PLAN.md](DDD-TDD-REFACTORING-PLAN.md)*
*Fas: Sjalvstandig -- genomfor EFTER DDD-refaktorering (Fas 1-3 klara)*
