# DDD & TDD Refaktoreringsplan — Hybrid

> Lärande-dokument + handlingsplan för en solo-utvecklare med Claude Code.
>
> **Nivå: Hybrid** — strikt DDD för Booking (komplext nog), DDD-Light för övriga
> kärndomäner, Prisma direkt för stöddomäner. Maximalt värde, minimal overhead.

---

## Del 1: Koncept

### Tre nivåer — och när du använder vilken

Inte varje domän förtjänar samma abstraktionsnivå. Välj efter komplexitet:

```
Komplexitet:   Låg              Medel                 Hög
               │                │                     │
Approach:      Prisma direkt    DDD-Light             Strikt DDD
               │                │                     │
Vad du får:    Route → Prisma   Route → Service       Route → Service
                                      → Repository          → Aggregat
                                                             → Events
                                                             → Specifications
               │                │                     │
Equinet:       Notification     Horse, Review         Booking
               Availability     GroupBooking
               Auth             RouteOrder
```

**Tumregel: välj den enklaste nivån som löser ditt problem.**

| Fråga | Om ja → |
|-------|---------|
| Har domänen affärsregler som spänner flera entiteter? | Minst DDD-Light |
| Har domänen en state machine (status-övergångar)? | Strikt DDD |
| Har domänen sidoeffekter som borde vara frikopplade? | Strikt DDD |
| Är det mestadels CRUD? | Prisma direkt |
| Behöver testerna sluta mocka Prisma direkt? | DDD-Light |

### Equinets domäner — vilken nivå?

| Domän | Nivå | Motivering |
|-------|------|-----------|
| **Booking** | Strikt DDD | State machine, overlap-validering, restidsberäkning, notiser |
| **Horse** | DDD-Light | IDOR-skydd, soft delete, notes — men inga komplexa regler |
| **Review** | DDD-Light | "One per booking" + "must be completed" — enkla regler, repo räcker |
| **GroupBooking** | DDD-Light | Befintlig service behöver fixas (Prisma direkt), men logiken är begränsad |
| **RouteOrder** | DDD-Light | Komplex route men mestadels CRUD med validering |
| **Provider** | DDD-Light | Redan repo, behåll |
| **Service** | DDD-Light | Redan repo, behåll |
| **Notification** | Prisma direkt | Stöddomän, ren CRUD |
| **Availability** | Prisma direkt | Schema-hantering, inga affärsregler |
| **Auth** | Prisma direkt | Cross-cutting, NextAuth hanterar |

---

### Koncept: DDD-Light (det du använder mest)

DDD-Light = **repository + service + value objects**. Ingen aggregat-klass, inga events.

```
┌─────────────────────────────────────────────┐
│  Route (HTTP-lager)                         │
│  - Auth, Zod-validering, error-mapping      │
│  - Delegerar till service                   │
│  - Innehåller INGEN affärslogik             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Domain Service                             │
│  - Affärsregler (validering, koordinering)  │
│  - Returnerar Result<T, Error>              │
│  - Vet inget om HTTP eller Prisma           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Repository (interface + implementation)    │
│  - IHorseRepository (interface)             │
│  - PrismaHorseRepository (produktion)       │
│  - MockHorseRepository (test)               │
└─────────────────────────────────────────────┘
```

**Varför repository?** Testerna slutar mocka Prisma-schema:

```typescript
// FÖRE: Fragilt — byter du kolumnnamn i Prisma → testet går sönder
jest.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Blansen" }]),
    },
  },
}))

// EFTER: Stabilt — schemaändringar påverkar bara PrismaHorseRepository
const mockRepo: IHorseRepository = {
  findByOwnerId: async () => [{ id: "1", name: "Blansen" }],
}
const service = new HorseService(mockRepo)
```

### Koncept: Strikt DDD (bara för Booking)

Strikt DDD = allt ovan PLUS **aggregat med beteende, domain events, specifications**.

Booking motiverar detta för att den har:
- **State machine**: pending → confirmed → completed/cancelled
- **Sidoeffekter**: notiser vid statusändring
- **Komplexa regler**: overlap, restid, self-booking prevention

```typescript
// Aggregat skyddar sina egna regler
class Booking extends AggregateRoot<BookingProps> {
  confirm(): Result<void, BookingError> {
    if (this.status !== "pending") {
      return Result.fail({
        type: "INVALID_TRANSITION",
        message: `Kan inte bekräfta en bokning med status "${this.status}"`
      })
    }
    this.props.status = "confirmed"
    this.addDomainEvent(new BookingConfirmedEvent(this.id))
    return Result.ok(undefined)
  }
}

// Events ersätter manuella notis-anrop
// Route:
const result = await bookingService.createBooking(dto)
if (result.isSuccess) {
  await eventDispatcher.dispatchAll(result.value.domainEvents)
}
// Handlers:
// BookingCreatedEvent → skicka notis
// BookingConfirmedEvent → skicka notis
// Ny sidoeffekt? Lägg till handler. Routen ändras inte.
```

**Horse, Review etc. behöver INTE detta.** En enkel service + repository räcker.

### Koncept: TDD-cykeln

```
  ┌───── RED ──────┐
  │ Skriv test som  │
  │ INTE passerar   │
  └───────┬─────────┘
          │
  ┌───────▼─────────┐
  │ GREEN            │
  │ Skriv MINSTA     │
  │ möjliga kod      │
  └───────┬─────────┘
          │
  ┌───────▼─────────┐
  │ REFACTOR         │
  │ Förbättra utan   │
  │ att bryta test   │
  └───────┬─────────┘
          │
          └──→ Tillbaka till RED
```

### Koncept: git bisect

Binärsökning genom commits för att hitta var ett test gick sönder.

```bash
# Automatiserat: git testar åt dig
git bisect start HEAD abc1234
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts

# Output: "a1b2c3d is the first bad commit"
git bisect reset
```

**Förutsättning:** en commit per logiskt steg, testerna gröna vid varje commit.

### Koncept: Domain Events (bara Booking)

```typescript
// Eventet (vad hände)
class BookingCreatedEvent implements IDomainEvent {
  readonly occurredAt = new Date()
  constructor(
    readonly bookingId: string,
    readonly customerId: string,
    readonly providerId: string,
  ) {}
}

// Aggregatet genererar eventet
class Booking extends AggregateRoot<BookingProps> {
  static create(dto: CreateBookingDTO): Result<Booking, BookingError> {
    const booking = new Booking(dto)
    booking.addDomainEvent(
      new BookingCreatedEvent(booking.id, dto.customerId, dto.providerId)
    )
    return Result.ok(booking)
  }
}

// Handler reagerar
class SendNotificationOnBookingCreated implements IEventHandler<BookingCreatedEvent> {
  constructor(private notificationRepo: INotificationRepository) {}
  async handle(event: BookingCreatedEvent): Promise<void> {
    await this.notificationRepo.create({
      userId: event.providerId,
      type: "NEW_BOOKING",
      relatedId: event.bookingId,
    })
  }
}
```

**Varför bara Booking?** De andra domänerna har inga sidoeffekter som behöver
frikopplas. Review skapar ingen notis, Horse har inga events. Om det ändras
i framtiden — uppgradera då, inte nu.

### Koncept: Specifications (bara Booking + Review)

```typescript
// Kapslar in en affärsregel som kan återanvändas
class OneReviewPerBookingSpec implements ISpecification<CreateReviewDTO> {
  constructor(private reviewRepo: IReviewRepository) {}

  async isSatisfiedBy(dto: CreateReviewDTO): Promise<boolean> {
    const existing = await this.reviewRepo.findByBookingAndCustomer(
      dto.bookingId, dto.customerId
    )
    return existing === null
  }
}
```

Specifications motiveras bara när regeln *återanvänds*. "One review per booking"
används i route + potentiellt i admin-UI. De flesta andra regler är enklare att
ha som if-satser i en service.

---

## Del 2: Nulägesanalys

### Vad vi har idag

| Byggsten | Finns | Används |
|----------|-------|---------|
| `AggregateRoot.ts` | Ja | Nej (events kommenterade) |
| `Entity.ts` | Ja | Nej (entiteter är interfaces) |
| `ValueObject.ts` | Ja | Ja (TimeSlot, Location) |
| `Result.ts` | Ja | Ja (BookingService) |
| `DomainError.ts` | Ja | Ja |
| `BookingMapper.ts` | Ja | Ja |

### Domän-status

| Domän | Routes | Repository | Service | Mål-nivå | Klart |
|-------|--------|------------|---------|----------|-------|
| **Booking** | 2 | Ja | Ja | Strikt DDD | 60% |
| **Provider** | 2 | Ja | Nej | DDD-Light (klar) | 80% |
| **Service** | 2 | Ja | Nej | DDD-Light (klar) | 80% |
| **Horse** | 5 | Nej | Nej | DDD-Light | 0% |
| **GroupBooking** | 6 | Nej | Prisma direkt | DDD-Light | 15% |
| **Review** | 3 | Nej | Nej | DDD-Light | 0% |
| **RouteOrder** | 6 | Nej | Nej | DDD-Light | 0% |
| **Notification** | 4 | Nej | Prisma direkt | Prisma direkt (klar) | 90% |
| **Availability** | 3 | Nej | Nej | Prisma direkt (klar) | 90% |

### Var affärslogik bor fel idag

| Regel | Bor idag | Ska bo |
|-------|----------|--------|
| Booking status-övergångar | BookingService | `Booking.confirm()` (aggregat) |
| "Must be completed before review" | `/api/reviews/route.ts` | `ReviewService` |
| "One review per booking" | `/api/reviews/route.ts` | `ReviewService` |
| "Max participants" | `/api/group-bookings/route.ts` | `GroupBookingService` |
| "Send notification" | `/api/bookings/route.ts` | `BookingCreatedEvent` → handler |

---

## Del 3: Handlingsplan

### Översikt

| Fas | Vad | Domäner | Nya filer |
|-----|-----|---------|-----------|
| 0 | Event-infrastruktur (bara det Booking behöver) | — | ~5 |
| 1 | Booking → strikt DDD (aggregat + events) | Booking | ~10 |
| 2 | DDD-Light för övriga kärndomäner | Horse, Review, GroupBooking, RouteOrder | ~4 per domän |
| 3 | Test-coverage för otestade filer | Alla | 0 (bara tester) |

**Totalt: ~35 nya filer** (jämfört med ~50+ för strikt DDD överallt).

### Fas 0 — Event-infrastruktur (minimal)

Bara det som Booking-aggregatet behöver. Inget mer.

#### 0.1 Aktivera Domain Events i AggregateRoot

`src/domain/shared/base/AggregateRoot.ts` har events kommenterade. Aktivera dem.

**TDD-cykel:**
```
RED:    "AggregateRoot ska samla domain events"
GREEN:  Avkommentera event-metoder
REFACTOR: Verifiera clearDomainEvents()
```

#### 0.2 Skapa EventDispatcher (enkel)

```
src/infrastructure/events/
├── IDomainEvent.ts
├── IEventHandler.ts
├── IEventDispatcher.ts
├── InMemoryEventDispatcher.ts
└── InMemoryEventDispatcher.test.ts
```

**TDD-cykel:**
```
RED:    "dispatcher ska anropa registrerade handlers"
GREEN:  Map<string, handler[]> + dispatch()
REFACTOR: Error handling (en handler som kraschar stoppar inte andra)
```

### Fas 1 — Booking → Strikt DDD

Booking är den enda domänen som motiverar aggregat + events.

#### 1.1 BookingStatus value object (state machine)

```typescript
class BookingStatus extends ValueObject<{ value: string }> {
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    pending:   ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  }

  canTransitionTo(next: string): boolean {
    return BookingStatus.VALID_TRANSITIONS[this.value]?.includes(next) ?? false
  }
}
```

**TDD-cykel:**
```
RED:    "pending kan gå till confirmed"
GREEN:  Implementera canTransitionTo()

RED:    "completed kan INTE gå till pending"
GREEN:  Returnera false för ogiltiga övergångar

RED:    "transitionTo returnerar ny BookingStatus"
GREEN:  Implementera transitionTo() med Result
```

#### 1.2 Booking-aggregat

```
src/domain/booking/
├── Booking.ts               # NY aggregat-rot
├── BookingStatus.ts          # NY value object
├── events/
│   ├── BookingCreatedEvent.ts
│   ├── BookingConfirmedEvent.ts
│   ├── BookingCancelledEvent.ts
│   └── BookingCompletedEvent.ts
├── BookingService.ts         # Finns — uppdatera att använda aggregat
└── BookingService.test.ts    # Finns — uppdatera
```

**TDD-cykel:**
```
RED:    "Booking.create returnerar aggregat med PENDING status"
GREEN:  Implementera Booking.create()

RED:    "Booking.confirm ändrar status + genererar event"
GREEN:  this.addDomainEvent(new BookingConfirmedEvent(this.id))

RED:    "Booking.confirm failar om status inte är PENDING"
GREEN:  Använd BookingStatus.canTransitionTo()

RED:    "Booking.cancel failar om COMPLETED"
GREEN:  Implementera cancel()
```

#### 1.3 Event handlers

```
src/infrastructure/events/handlers/
├── SendNotificationOnBookingCreated.ts
├── SendNotificationOnBookingConfirmed.ts
└── SendNotificationOnBookingCancelled.ts
```

**TDD-cykel:**
```
RED:    "handler skapar notification med rätt typ"
GREEN:  Implementera med MockNotificationRepository

RED:    "handler sväljer fel utan att kasta vidare"
GREEN:  Try-catch + logger.error
```

#### 1.4 Migrera routes

Uppdatera `/api/bookings/route.ts` och `/api/bookings/[id]/route.ts`:
- Använd aggregat via service
- Dispatcha events istället för manuella notis-anrop
- En route per commit, tester gröna vid varje steg

### Fas 2 — DDD-Light för övriga kärndomäner

Samma mönster för alla fyra. **Ingen aggregat-klass, inga events.** Bara
repository + service.

#### Per domän (Horse som exempel):

**Steg 1: Skapa repository**
```
src/infrastructure/persistence/horse/
├── IHorseRepository.ts
├── PrismaHorseRepository.ts
└── MockHorseRepository.ts
```

**Steg 2: Skapa service (om affärsregler finns)**
```
src/domain/horse/
├── HorseService.ts
└── HorseService.test.ts
```

**Steg 3: Migrera routes (en per commit)**
```
src/app/api/horses/route.ts                      → repository
src/app/api/horses/[id]/route.ts                  → repository
src/app/api/horses/[id]/notes/route.ts            → repository
src/app/api/horses/[id]/notes/[noteId]/route.ts   → repository
src/app/api/horses/[horseId]/passport/route.ts    → repository
```

#### Alla DDD-Light-domäner:

| Domän | Repo | Service | Affärsregler att flytta |
|-------|------|---------|------------------------|
| **Horse** | IHorseRepository | HorseService | IDOR, soft delete, note-kategorier |
| **Review** | IReviewRepository | ReviewService | "One per booking", "must be completed" |
| **GroupBooking** | IGroupBookingRepository | Refaktorera befintlig | Invite code, status, max participants |
| **RouteOrder** | IRouteOrderRepository | RouteOrderService | Customer/provider flow |

### Fas 3 — Test-coverage

Inga nya abstraktioner. Bara tester för otestade filer.

**Prioriterade (säkerhetskritiska):**
1. `src/lib/rate-limit.ts`
2. `src/lib/auth-server.ts`
3. `src/lib/encryption.ts`
4. `src/app/api/auth/*/route.ts`

**Mål:** API-routes 66% → 80%, lib utilities 33% → 90%.

---

## Del 4: Arbetsmetod

### DDD-Light-domän (7 steg)

```
Steg 1: Skapa IXxxRepository interface
        → Commit: "refactor: add IHorseRepository interface"

Steg 2: Implementera PrismaXxxRepository
        → Commit: "refactor: add PrismaHorseRepository"

Steg 3: Implementera MockXxxRepository
        → Commit: "test: add MockHorseRepository"

Steg 4: TDD: Skapa XxxService (om affärsregler finns)
        → Commit: "feat: add HorseService with validation"

Steg 5: Migrera route 1 → tester gröna
        → Commit: "refactor: migrate /api/horses to repository"

Steg 6: Migrera route 2 → tester gröna
        → Commit per route

Steg 7: Verifiera
        → npm test -- --run
        → Om fail: git bisect
```

### Strikt DDD-domän (10 steg, bara Booking)

```
Steg 1-3: Samma som ovan (repo)

Steg 4: TDD: Skapa aggregat-klass
        → create(), confirm(), cancel(), complete()
        → Commit: "feat(domain): add Booking aggregate"

Steg 5: Skapa BookingStatus value object
        → Commit: "feat(domain): add BookingStatus state machine"

Steg 6: Skapa domain events
        → Commit: "feat(domain): add booking domain events"

Steg 7: Uppdatera BookingService att använda aggregat
        → Commit: "refactor: BookingService uses aggregate"

Steg 8: Skapa event handlers
        → Commit: "feat: add booking event handlers"

Steg 9: Migrera routes + byt manuella notiser till events
        → Commit per route

Steg 10: Verifiera
```

---

## Del 5: git bisect

### När?

| Situation | Bisect? |
|-----------|---------|
| Test failar efter refaktorering, oklart var | Ja |
| Du vet vilken fil du ändrade | Nej — git diff |
| Flaky E2E-test | Nej — timing |
| Bygget sönder efter 10+ commits | Ja |

### Automatiserat exempel

```bash
git bisect start HEAD HEAD~10
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts
# "a1b2c3d is the first bad commit"
git bisect reset
```

---

## Del 6: Filstruktur

```
src/
├── domain/
│   ├── shared/
│   │   ├── base/
│   │   │   ├── AggregateRoot.ts     # Aktivera events (fas 0)
│   │   │   ├── Entity.ts            # Finns
│   │   │   └── ValueObject.ts       # Finns
│   │   ├── types/
│   │   │   ├── Result.ts            # Finns
│   │   │   └── Guard.ts             # Finns
│   │   └── errors/
│   │       └── DomainError.ts       # Finns
│   │
│   ├── booking/                     # STRIKT DDD
│   │   ├── Booking.ts               # Aggregat-rot (NY)
│   │   ├── BookingStatus.ts         # Value object (NY)
│   │   ├── BookingService.ts        # Finns — uppdatera
│   │   ├── BookingService.test.ts   # Finns — uppdatera
│   │   ├── TravelTimeService.ts     # Finns
│   │   └── events/                  # NY
│   │       ├── BookingCreatedEvent.ts
│   │       ├── BookingConfirmedEvent.ts
│   │       ├── BookingCancelledEvent.ts
│   │       └── BookingCompletedEvent.ts
│   │
│   ├── horse/                       # DDD-LIGHT
│   │   ├── HorseService.ts          # NY
│   │   └── HorseService.test.ts     # NY
│   │
│   ├── review/                      # DDD-LIGHT
│   │   ├── ReviewService.ts         # NY
│   │   └── ReviewService.test.ts    # NY
│   │
│   ├── group-booking/               # DDD-LIGHT
│   │   ├── GroupBookingService.ts    # Finns — refaktorera bort Prisma
│   │   └── GroupBookingService.test.ts
│   │
│   └── route-order/                 # DDD-LIGHT
│       ├── RouteOrderService.ts     # NY
│       └── RouteOrderService.test.ts
│
├── infrastructure/
│   ├── persistence/
│   │   ├── booking/                 # Finns — uppdatera mapper för aggregat
│   │   ├── provider/                # Finns — klar
│   │   ├── service/                 # Finns — klar
│   │   ├── horse/                   # NY
│   │   │   ├── IHorseRepository.ts
│   │   │   ├── PrismaHorseRepository.ts
│   │   │   └── MockHorseRepository.ts
│   │   ├── review/                  # NY
│   │   │   ├── IReviewRepository.ts
│   │   │   ├── PrismaReviewRepository.ts
│   │   │   └── MockReviewRepository.ts
│   │   ├── group-booking/           # NY
│   │   │   ├── IGroupBookingRepository.ts
│   │   │   ├── PrismaGroupBookingRepository.ts
│   │   │   └── MockGroupBookingRepository.ts
│   │   └── route-order/             # NY
│   │       ├── IRouteOrderRepository.ts
│   │       ├── PrismaRouteOrderRepository.ts
│   │       └── MockRouteOrderRepository.ts
│   │
│   └── events/                      # NY (bara för Booking)
│       ├── IEventDispatcher.ts
│       ├── InMemoryEventDispatcher.ts
│       ├── InMemoryEventDispatcher.test.ts
│       └── handlers/
│           ├── SendNotificationOnBookingCreated.ts
│           ├── SendNotificationOnBookingConfirmed.ts
│           └── SendNotificationOnBookingCancelled.ts
│
└── app/api/                         # Routes — successivt tunnare
```

**Totalt ~35 nya filer** (vs ~50+ vid strikt DDD för alla domäner).

---

## Del 7: Checklista

### DDD-Light-domän

```markdown
## [Domän] — DDD-Light

### Förberedelse
- [ ] Läs igenom alla routes
- [ ] Identifiera affärsregler
- [ ] Kolla att befintliga tester är gröna

### Implementation
- [ ] Skapa IXxxRepository
- [ ] Implementera PrismaXxxRepository
- [ ] Implementera MockXxxRepository
- [ ] TDD: Skapa service (om regler finns)
- [ ] Migrera route 1 → commit → grönt
- [ ] Migrera route 2 → commit → grönt
- [ ] ...

### Verifiering
- [ ] npm test -- --run
- [ ] E2E (om det finns)
- [ ] Inga Prisma-anrop kvar i routes för denna domän
```

### Strikt DDD-domän (bara Booking)

```markdown
## Booking — Strikt DDD

### Förberedelse
- [ ] Läs routes + befintlig BookingService
- [ ] Identifiera status-övergångar
- [ ] Identifiera sidoeffekter (notiser)

### Aggregat
- [ ] TDD: BookingStatus value object (state machine)
- [ ] TDD: Booking aggregat-rot (create, confirm, cancel, complete)
- [ ] TDD: Verifiera att rätt events genereras

### Events
- [ ] Skapa event-klasser
- [ ] TDD: Event handlers (notification)
- [ ] Koppla dispatcher

### Integration
- [ ] Uppdatera BookingService → aggregat
- [ ] Migrera routes → events istället för manuella notiser
- [ ] Ta bort notificationService.createAsync() i routes

### Verifiering
- [ ] npm test -- --run
- [ ] E2E
- [ ] Inga manuella notis-anrop i booking-routes
```

---

## Del 8: Prioritetsordning

| Prio | Fas | Domän | Steg |
|------|-----|-------|------|
| 0 | Fas 0 | Event-infrastruktur | Aktivera AggregateRoot, skapa dispatcher |
| 1 | Fas 1 | Booking (strikt DDD) | Aggregat + events + migrera routes |
| 2 | Fas 2 | Horse (DDD-Light) | Repo + service + migrera 5 routes |
| 3 | Fas 2 | Review (DDD-Light) | Repo + service + migrera 3 routes |
| 4 | Fas 2 | GroupBooking (DDD-Light) | Repo + refaktorera service + migrera 6 routes |
| 5 | Fas 2 | RouteOrder (DDD-Light) | Repo + service + migrera 6 routes |
| 6 | Fas 3 | Test-coverage | rate-limit, auth-server, encryption, auth routes |

### När uppgradera en domän?

Om du i framtiden märker att Horse eller Review behöver events eller state machine
— uppgradera *då*. Stegen är:

1. Skapa aggregat-klass med TDD
2. Skapa events
3. Skapa handlers
4. Uppdatera service
5. Migrera routes

Du behöver inte planera det nu. Infrastrukturen (EventDispatcher) finns redan
efter Fas 0.

---

## Ordlista

| Term | Förklaring |
|------|-----------|
| **Repository** | Abstraktionslager mellan domän och databas. Interface + implementation. |
| **Domain Service** | Klass med affärsregler. Vet inget om HTTP. |
| **Value Object** | Immutable objekt som validerar sig vid skapande. |
| **Aggregat** | Klass med beteende som skyddar sina regler. Genererar events. |
| **Domain Event** | Beskriver något som hänt. Genereras av aggregat, hanteras av handlers. |
| **State Machine** | Giltiga tillståndsövergångar (pending → confirmed → completed). |
| **Result<T, E>** | Returtyp som tvingar hantering av success och error. |
| **Bisect** | Git-kommando: binärsöker commits för att hitta var en bugg uppstod. |
| **TDD** | Test först → implementera → refaktorera. |

---

*Skapat: 2026-02-01*
*Nivå: Hybrid (strikt DDD för Booking, DDD-Light för övriga kärndomäner)*
*Solo-utvecklare + Claude Code*
*Använd: "Läs docs/DDD-TDD-REFACTORING-PLAN.md och börja med Fas 0.1"*
