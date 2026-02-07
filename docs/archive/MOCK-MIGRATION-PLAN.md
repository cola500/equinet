# Mock-migrationsplan: Prisma-mocks -> Service-mocks

> **Syfte:** Dokumentera strategin för att migrera kvarvarande Prisma-mockar till
> service-mockar i testsviten. Självständig fas EFTER att DDD-refaktoreringen
> (Fas 1-3 i DDD-TDD-REFACTORING-PLAN.md) är klar.
>
> **Beroende:** Kravet är att domänen redan har repository + service + factory.
> Migrera inte tester för domäner som saknar service-lager.

---

## 1. Nulägets-analys

### Siffror (2026-02-01)

| Mätpunkt | Antal |
|----------|-------|
| Totalt `vi.mock()` anrop | 141 |
| Testfiler med mockar | 48 |
| Filer som mockar `@/lib/prisma` | 25 (52%) |
| Filer som mockar `@/domain/*` services | 24 (50%) |
| Filer som mockar `@/infrastructure/*` repos | 3 (6%) |

### Mock-fördelning per domän

| Domän | DDD-Light klar? | Route-tester | Mock-typ idag |
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

- **39% av route-testerna** använder redan DDD-Light-mockar (service/factory)
- **52% av testfilerna** mockar fortfarande Prisma direkt
- **6 filer** blandar båda mönstren (mixed) -- dessa är fragila och prioriterade

---

## 2. Två mock-strategier

### Prisma-mock (fragilt mönster)

```typescript
// Kopplar testet till Prisma-schema. Varje kolumnändring -> bruten test.
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
- Tester bryts vid kolumnändringar, relationsändringar, eller Prisma-uppgraderingar
- Testar HOW (Prisma-anrop), inte WHAT (API-beteende)
- Mocken måste spegla exakt hur routen anropar Prisma -- fragilt
- Saknar affärslogik-validering (reglerna bor i servicen)

### Service-mock (robust mönster)

```typescript
// Kopplar testet till API-kontraktet. Schema-ändringar påverkar bara repository.
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

**Fördelar:**
- Tester överlever Prisma-schema-ändringar
- Testar API-kontrakt (HTTP status + response shape)
- Affärsregler testas i service-tester (med MockRepository)
- En mock-ändring när servicen ändras -- inte N Prisma-mockar

### Mixed mock (värsta fallet)

```typescript
// Blandar båda mönstren -- dubbelt fragilt
vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))
vi.mock('@/domain/notification/NotificationService', () => ({ ... }))
```

Filer med mixed mocks är prioriterade för migrering -- de har den högsta underhållskostnaden.

---

## 3. Prioriterad migrationslista

### Prioritet 1: Mixed-mock-filer (6 filer)

Dessa blandar Prisma-mock + service-mock och är mest fragila.

| Fil | Prisma-mock | Service-mock | Aktion |
|-----|-------------|--------------|--------|
| `reviews/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `reviews/[id]/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `reviews/[id]/reply/route.test.ts` | `prisma.review.*` | NotificationService | Migrera till ReviewService factory |
| `bookings/[id]/route.test.ts` | `prisma.booking.*` | NotificationService + repos | Migrera till BookingService factory |
| `group-bookings/[id]/match/route.test.ts` | `prisma.provider.*` | GroupBookingService | Acceptera -- stöddomäns-lookup |
| `services/[id]/route.test.ts` | -- | ServiceRepository | Redan DDD-Light |

**Förväntad vinst:** 5 filer blir rent service-mockade, 1 accepteras som mixed.

### Prioritet 2: DDD-domäner med kvarvarande Prisma-mock (4 filer)

Dessa har service-lager men route-testerna använder fortfarande Prisma.

| Fil | Domän | Service finns? | Aktion |
|-----|-------|----------------|--------|
| `providers/[id]/reviews/route.test.ts` | Review | Ja | Migrera till ReviewService factory |
| `bookings/route.test.ts` | Booking | Ja | Migrera till BookingService factory |
| `providers/route.test.ts` | Provider | Repo finns | Migrera till ProviderRepository mock |
| `providers/[id]/route.test.ts` | Provider | Repo finns | Migrera till ProviderRepository mock |

### Prioritet 3: Stöddomäner -- LÅT VARA (11 filer)

Dessa har inget service-lager och Prisma-mock är rätt abstraktionsnivå.

| Fil | Domän | Motivering |
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

### När service-mock KRÄVS

Migrera till service-mock när:

- [x] Domänen har en service + factory (`createXxxService()`)
- [x] Route-testerna mockar Prisma men service finns
- [x] Filen blandar Prisma-mock + service-mock (mixed)
- [x] Testerna testar affärslogik som redan finns i servicen

### När Prisma-mock är OK

Behåll Prisma-mock när:

- [x] Domänen är stöddomäner (Prisma direkt enligt DDD-planen)
- [x] Ingen service eller repository existerar
- [x] Routen är enkel CRUD utan affärsregler
- [x] Det gör support-lookups i en DDD-route (t.ex. provider-lookup i `match/route.ts`)

### Decision tree

```
Har domänen en service + factory?
  |
  +-- Nej -> Behåll Prisma-mock
  |
  +-- Ja -> Använder route-testet Prisma-mock?
        |
        +-- Nej -> Redan migrerat, inget att göra
        |
        +-- Ja -> MIGRERA till service-mock
              |
              +-- Blandar filen Prisma + service? -> Prioritet 1
              +-- Bara Prisma-mock? -> Prioritet 2
```

### Migrerings-checklist per fil

```markdown
- [ ] Läs route-testet -- identifiera alla vi.mock() anrop
- [ ] Verifiera att servicen stödjer alla mockade operationer
- [ ] Byt vi.mock('@/lib/prisma') -> vi.mock('@/domain/xxx/XxxService')
- [ ] Uppdatera test-assertions till att testa HTTP-kontrakt
- [ ] Kör testet -- verifiera att det passerar
- [ ] Ta bort alla Prisma-relaterade imports
- [ ] Kör full testsvit (npm test -- --run)
```

---

## 5. Sammanfattning

| Kategori | Filer | Aktion |
|----------|-------|--------|
| Redan DDD-Light-mockar | 19 filer | Inget att göra |
| Prioritet 1 (mixed) | 5 filer | Migrera (högst prio) |
| Prioritet 2 (DDD-domän med Prisma-mock) | 4 filer | Migrera |
| Prioritet 3 (stöddomäner) | 11 filer | Behåll Prisma-mock |
| Domain service-tester | 5 filer | Inget att göra (MockRepository) |
| Övriga (hooks, cron) | 4 filer | Bedömning per fil |

**Total migreringsinsats:** 9 filer att migrera, 11 att medvetet låta vara.

**Förväntad situation efter migrering:**
- 28+ av 48 testfiler använder service-mocks (58% -> uppskattning)
- 0 mixed-mock-filer (ner från 6)
- 11 filer med medveten Prisma-mock för stöddomäner

---

*Skapat: 2026-02-01*
*Relaterat: [DDD-TDD-REFACTORING-PLAN.md](DDD-TDD-REFACTORING-PLAN.md)*
*Fas: Självständig -- genomför EFTER DDD-refaktorering (Fas 1-3 klara)*
