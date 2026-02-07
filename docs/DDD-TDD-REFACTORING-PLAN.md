# DDD & TDD Refaktoreringsplan — Hybrid (v2)

> Lärande-dokument + handlingsplan för en solo-utvecklare med Claude Code.
>
> **Nivå: Hybrid** — DDD-Light för kärndomäner, Prisma direkt för stöddomäner,
> uppgradering till strikt DDD för Booking när sidoeffekter motiverar det.
>
> **v2 (2026-02-01):** Omarbetad efter team-review (tech-architect, security-reviewer,
> kodbasanalys). Inverterad prioritering, serverless-fix, säkerhetsriktlinjer.

---

## Del 1: Koncept

### Tre nivåer — och när du använder vilken

Inte varje domän förtjänar samma abstraktionsnivå. Välj efter komplexitet:

```
Komplexitet:   Låg              Medel                 Hög
               |                |                     |
Approach:      Prisma direkt    DDD-Light             Strikt DDD
               |                |                     |
Vad du får:    Route -> Prisma  Route -> Service      Route -> Service
                                      -> Repository         -> Aggregat
                                                             -> Events
               |                |                     |
Equinet:       Notification     Horse, Review         Booking (framtida)
               Availability     GroupBooking
                                Provider (klar)
                                Service (klar)
```

**Tumregel: välj den enklaste nivån som löser ditt problem.**

| Fråga | Om ja -> |
|-------|---------|
| Har domänen affärsregler som spänner flera entiteter? | Minst DDD-Light |
| Har domänen en state machine (status-övergångar)? | DDD-Light + value object |
| Har domänen 3+ sidoeffekter som borde vara frikopplade? | Strikt DDD |
| Är det mestadels CRUD? | Prisma direkt |
| Behöver testerna sluta mocka Prisma direkt? | DDD-Light |

### Decision Tree för nya features

```
1. Är det CRUD utan affärslogik?
   -> Prisma direkt

2. Finns affärsregler som behöver testas isolerat?
   -> DDD-Light (repo + service)

3. Finns state machine ELLER 3+ sidoeffekter att frikoppla?
   -> DDD-Light + BookingStatus value object
   -> Uppgradera till strikt DDD FÖRST när du faktiskt
      har 3+ handlers (inte hypotetiskt)
```

### Red Flags — uppgradera domänen

- DDD-Light service når 300+ rader
- Service har if-statements för status-övergångar (-> value object)
- Manuella sidoeffekt-anrop på 3+ ställen i routes (-> events)

### Equinets domäner — vilken nivå?

| Domän | Nivå | Motivering |
|-------|------|-----------|
| **Booking** | DDD-Light + BookingStatus VO + Events | State machine via value object, overlap-validering i repo, domain events för sidoeffekter (Fas 5). |
| **Horse** | DDD-Light | IDOR-skydd, soft delete, notes — men inga komplexa regler |
| **Review** | DDD-Light | "One per booking" + "must be completed" — enkla regler, repo räcker |
| **GroupBooking** | DDD-Light (klar) | Repo + service + factory, 25 tester, 95% coverage |
| **RouteOrder** | Prisma direkt (uppskjuten) | Mestadels CRUD — lågt ROI för refaktorering just nu |
| **Provider** | DDD-Light (klar) | Redan repo, behåll |
| **Service** | DDD-Light (klar) | Redan repo, behåll |
| **Auth** | DDD-Light (klar) | Specialized repo (ej IRepository), service + factory, 21 tester, säkerhetsfixar |
| **Notification** | Prisma direkt | Stöddomän, ren CRUD |
| **Availability** | Prisma direkt | Schema-hantering, inga affärsregler |

---

### Koncept: DDD-Light (det du använder mest)

DDD-Light = **repository + service + value objects**. Ingen aggregat-klass, inga events.

```
+---------------------------------------------+
|  Route (HTTP-lager)                         |
|  - Auth, Zod-validering, error-mapping      |
|  - Delegerar till service                   |
|  - Innehåller INGEN affärslogik             |
+---------------------+-----------------------+
                      |
+---------------------v-----------------------+
|  Domain Service                             |
|  - Affärsregler (validering, koordinering)  |
|  - Returnerar Result<T, Error>              |
|  - Vet inget om HTTP eller Prisma           |
+---------------------+-----------------------+
                      |
+---------------------v-----------------------+
|  Repository (interface + implementation)    |
|  - IHorseRepository (interface)             |
|  - PrismaHorseRepository (produktion)       |
|  - MockHorseRepository (test)               |
+---------------------------------------------+
```

**Varför repository?** Testerna slutar mocka Prisma-schema:

```typescript
// FÖRE: Fragilt — byter du kolumnnamn i Prisma -> testet går sönder
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

### Koncept: Strikt DDD (framtida — när Booking behöver events)

Strikt DDD = allt ovan PLUS **aggregat med beteende, domain events**.

Booking KAN motivera detta i framtiden om sidoeffekterna växer:
- **Idag**: 1 sidoeffekt (notis) — DDD-Light + value object räcker
- **Framtida trigger**: Payment flow, kalender-sync, email + notis + analytics
  -> När du har 3+ handlers per event, uppgradera

```typescript
// Framtida pattern (INTE nu):
class Booking extends AggregateRoot<BookingProps> {
  confirm(): Result<void, BookingError> {
    if (!this.status.canTransitionTo("confirmed")) {
      return Result.fail({ type: "INVALID_TRANSITION" })
    }
    this.props.status = BookingStatus.create("confirmed")
    this.addDomainEvent(new BookingConfirmedEvent(this.id))
    return Result.ok(undefined)
  }
}
```

### Koncept: TDD-cykeln

```
  +---- RED ------+
  | Skriv test som |
  | INTE passerar  |
  +-------+--------+
          |
  +-------v--------+
  | GREEN           |
  | Skriv MINSTA    |
  | möjliga kod     |
  +-------+---------+
          |
  +-------v---------+
  | REFACTOR         |
  | Förbättra utan   |
  | att bryta test   |
  +-------+----------+
          |
          +---> Tillbaka till RED
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

### Koncept: Domain Events (framtida — när Booking behöver det)

> **OBS**: Implementera INTE events än. Dokumenterat här för framtida referens.
> Uppgraderingskriterium: 3+ sidoeffekter per booking-händelse.

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

// Handler reagerar
class SendNotificationOnBookingCreated implements IEventHandler<BookingCreatedEvent> {
  constructor(private notificationRepo: INotificationRepository) {}
  async handle(event: BookingCreatedEvent): Promise<void> {
    // 1. Idempotency check (förhindra replay)
    const existing = await this.notificationRepo.findByTypeAndRelatedId(
      "NEW_BOOKING", event.bookingId
    )
    if (existing) return

    // 2. Skapa notis
    await this.notificationRepo.create({
      userId: event.providerId,
      type: "NEW_BOOKING",
      relatedId: event.bookingId,
    })
  }
}
```

**EventDispatcher i serverless (Vercel):**

InMemoryEventDispatcher fungerar INTE direkt i serverless — handlers-mappen
är tom vid cold start. Lösning: **Factory Pattern** som skapar dispatcher
med pre-registrerade handlers per request.

```typescript
// Factory — alltid fullt konfigurerad
export function createBookingEventDispatcher(): IEventDispatcher {
  const dispatcher = new InMemoryEventDispatcher()
  dispatcher.register('BookingCreatedEvent',
    new SendNotificationOnBookingCreated(new PrismaNotificationRepository()))
  dispatcher.register('BookingConfirmedEvent',
    new SendNotificationOnBookingConfirmed(new PrismaNotificationRepository()))
  return dispatcher
}

// I route.ts:
const dispatcher = createBookingEventDispatcher() // Stateless, skapas per request
await dispatcher.dispatchAll(booking.domainEvents)
```

---

## Del 2: Nulägesanalys

### Vad vi har idag

| Byggsten | Finns | Används |
|----------|-------|---------|
| `AggregateRoot.ts` | Ja (58 rader) | Ja (events aktiverade, Fas 5) |
| `Entity.ts` | Ja (105 rader) | Ja (AggregateRoot extends det) |
| `ValueObject.ts` | Ja (138 rader) | Ja (TimeSlot, Location) |
| `Result.ts` | Ja (129 rader) | Ja (BookingService) |
| `DomainError.ts` | Ja | Ja |
| `BookingMapper.ts` | Ja | Ja |

### Domän-status (verifierat mot kodbasen)

| Domän | Routes | Repository | Service | Mål-nivå | Status |
|-------|--------|------------|---------|----------|--------|
| **Booking** | 3+ | Ja (fullständig) | Ja (461 rader, 100% komplett) | DDD-Light + VO | 85% — saknar BookingStatus VO |
| **Provider** | 2 | Ja (interface + impl + mock) | Nej | DDD-Light (klar) | 80% |
| **Service** | 2 | Ja (interface + impl + mock) | Nej | DDD-Light (klar) | 80% |
| **Horse** | 7 | Ja (interface + impl + mock) | Ja (HorseService, 91 tester) | DDD-Light (klar) | 100% |
| **GroupBooking** | 6+ | Ja (interface + impl + mock) | Ja (555 rader, DI + Result, 25 tester) | DDD-Light (klar) | 100% |
| **Review** | 3 | Ja (interface + impl + mock) | Ja (ReviewService, 14 tester) | DDD-Light (klar) | 100% |
| **RouteOrder** | 6+ | Nej | Nej | Prisma direkt (uppskjuten) | N/A |
| **Auth** | 3 | Ja (interface + impl + mock) | Ja (AuthService, 21 tester) | DDD-Light (klar) | 100% |
| **Notification** | 4 | Nej | Prisma direkt | Prisma direkt (klar) | 90% |
| **Availability** | 3 | Nej | Nej | Prisma direkt (klar) | 90% |

### Var affärslogik bor fel idag

| Regel | Bor idag | Ska bo |
|-------|----------|--------|
| Booking status-övergångar | BookingService (if-satser) | `BookingStatus` value object |
| "Must be completed before review" | `/api/reviews/route.ts` | `ReviewService` |
| "One review per booking" | `/api/reviews/route.ts` | `ReviewService` |
| "Max participants" | `/api/group-bookings/route.ts` | `GroupBookingService` (redan delvis) |
| "Send notification" | 3 booking-routes (manuella anrop) | Behåll i service — events när 3+ sidoeffekter |

### Test-coverage (verifierat)

| Fil | Tester | Status |
|-----|--------|--------|
| `rate-limit.ts` | Nej | SAKNAS — prioritet 1 |
| `auth-server.ts` | Nej | SAKNAS — prioritet 2 |
| `encryption.ts` | Ja (6 test cases) | OK |
| `auth/*/route.ts` | Nej | SAKNAS — prioritet 3 |

---

## Del 3: Handlingsplan

### Översikt (inverterad prioritering — enklast först)

| Fas | Vad | Domäner | Nya filer |
|-----|-----|---------|-----------|
| 0 | Förberedelse + baseline | — | 0 |
| 1 | DDD-Light för kärndomäner | Review, Horse, GroupBooking | ~4 per domän |
| 2 | BookingStatus value object | Booking | ~2 |
| 3 | Auth repository (säkerhet) | Auth | ~4 |
| 4 | Test-coverage för otestade filer | Alla | 0 (bara tester) |
| 5 | (Framtida) Event-infrastruktur | Booking | ~4 (konsoliderat) |

**Totalt Fas 0-4: ~20 nya filer** (ner från ~35 i v1).
Fas 5 läggs till först när events motiveras (se "Red Flags" ovan).

**Varför inverterad ordning?**
- Fas 1 validerar repo-pattern på enkel domän (Review) innan den används på komplex (Booking)
- Snabbare feedback-loop — du får resultat redan efter första domänen
- Booking är redan 85% klar, behöver bara BookingStatus VO (Fas 2)
- Tester löpande istället för efterkonstruktion

---

### Fas 0 — Förberedelse

Innan någon kod ändras:

```
- [ ] Verifiera att alla tester är gröna: npm test -- --run
- [ ] Dokumentera nuvarande API latency (baseline)
- [ ] Skapa feature branch: git checkout -b refactor/ddd-light
```

---

### Fas 1 — DDD-Light för kärndomäner

Samma mönster för alla tre domäner. **Ingen aggregat-klass, inga events.**
Bara repository + service.

**Ordning: Review (pilot) -> Horse -> GroupBooking**

Review är enklast (3 routes, tydliga regler) och fungerar som pilot för att
validera att mönstret funkar innan vi använder det på Horse och GroupBooking.

#### 1.1 Review (DDD-Light) — PILOT (KLAR)

> **Retrospektiv:** [docs/retrospectives/2026-02-01-ddd-light-review-pilot.md](retrospectives/2026-02-01-ddd-light-review-pilot.md)

**Steg 1: Skapa repository**
```
src/infrastructure/persistence/review/
  IReviewRepository.ts
  PrismaReviewRepository.ts
  MockReviewRepository.ts
```

**Steg 2: TDD: Skapa ReviewService**
```
src/domain/review/
  ReviewService.ts
  ReviewService.test.ts
```

Affärsregler att flytta från route.ts:
- "Booking must be completed" (rad 59 i reviews/route.ts)
- "One review per booking" (rad 67 i reviews/route.ts)
- Authorization: customer must own booking

**Steg 3: Migrera routes (en per commit)**
```
src/app/api/reviews/route.ts           -> repository + service
src/app/api/reviews/[id]/route.ts      -> repository + service
src/app/api/reviews/[id]/reply/route.ts -> repository
```

#### 1.2 Horse (DDD-Light) — KLAR

> **Retrospektiv:** [docs/retrospectives/2026-02-01-ddd-light-horse-migration.md](retrospectives/2026-02-01-ddd-light-horse-migration.md)

**Steg 1: Skapa repository**
```
src/infrastructure/persistence/horse/
  IHorseRepository.ts
  PrismaHorseRepository.ts
  MockHorseRepository.ts
```

**Steg 2: TDD: Skapa HorseService**
```
src/domain/horse/
  HorseService.ts
  HorseService.test.ts
```

Affärsregler att flytta:
- IDOR-skydd (ownerId i WHERE-clause)
- Soft delete (isActive=false)
- Note-kategorier (provider vs customer access)

**Steg 3: Migrera routes (en per commit)**
```
src/app/api/horses/route.ts                       -> repository
src/app/api/horses/[id]/route.ts                   -> repository
src/app/api/horses/[id]/notes/route.ts             -> repository
src/app/api/horses/[id]/notes/[noteId]/route.ts    -> repository
src/app/api/horses/[id]/timeline/route.ts          -> repository
src/app/api/horses/[id]/passport/route.ts          -> repository
src/app/api/horses/[id]/export/route.ts            -> repository
```

#### 1.3 GroupBooking (DDD-Light) — KLAR

> **Retrospektiv:** [docs/retrospectives/2026-02-01-ddd-light-groupbooking-migration.md](retrospectives/2026-02-01-ddd-light-groupbooking-migration.md)

**Steg 1: Skapa repository**
```
src/infrastructure/persistence/group-booking/
  IGroupBookingRepository.ts
  PrismaGroupBookingRepository.ts
  MockGroupBookingRepository.ts
```

**Steg 2: Refaktorera GroupBookingService**
- Ta bort `import { prisma }` från servicen
- Injicera repository via constructor DI (5 dependencies -> factory)
- Alla 8 metoder returnerar `Result<T, GroupBookingError>`
- 25 service-tester med MockRepository

**Steg 3: Migrera routes (en per commit)**
- Alla 8 routes delegerar till `createGroupBookingService()`
- `mapGroupBookingErrorToStatus` centraliserad (28 rader)
- `match/route.ts` behåller Prisma för provider/service-lookup (support-domän)

---

### Fas 2 — BookingStatus value object

**Session:** 1 (liten ändring, ~2 nya filer)

Booking är redan 85% klar (fullständig service + repository). Det enda som saknas
är en BookingStatus value object för state machine-validering.

**INTE aggregat, INTE events.** Bara ett value object som gör status-övergångar typsäkra.

#### 2.1 BookingStatus value object

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

  transitionTo(next: string): Result<BookingStatus, BookingError> {
    if (!this.canTransitionTo(next)) {
      return Result.fail({
        type: "INVALID_TRANSITION",
        message: `Kan inte gå från "${this.value}" till "${next}"`
      })
    }
    return Result.ok(BookingStatus.create(next))
  }
}
```

**TDD-cykel:**
```
RED:    "pending kan gå till confirmed"
GREEN:  Implementera canTransitionTo()

RED:    "completed kan INTE gå till pending"
GREEN:  Returnera false för ogiltiga övergångar

RED:    "transitionTo returnerar Result med ny BookingStatus"
GREEN:  Implementera transitionTo()
```

#### 2.2 Uppdatera BookingService

```typescript
// I BookingService (befintlig):
async updateStatus(id: string, newStatus: string): Promise<Result<...>> {
  const booking = await this.deps.bookingRepository.findById(id)

  // NY: Validera transition med value object
  const currentStatus = BookingStatus.create(booking.status)
  const transitionResult = currentStatus.transitionTo(newStatus)
  if (transitionResult.isFailure) {
    return Result.fail(transitionResult.error)
  }

  // Resten som vanligt...
}
```

#### 2.3 Factory Pattern för BookingService DI

BookingService har många dependencies. Skapa factory för att minska boilerplate i routes:

```typescript
// src/domain/booking/BookingServiceFactory.ts
export function createBookingService(): BookingService {
  return new BookingService({
    bookingRepository: new PrismaBookingRepository(),
    getService: async (id) => { ... },
    getProvider: async (id) => { ... },
    getRouteOrder: async (id) => { ... },
    getCustomerLocation: async (customerId) => { ... },
    travelTimeService: new TravelTimeService(),
  })
}

// För test:
export function createMockBookingService(
  overrides?: Partial<BookingServiceDeps>
): BookingService {
  return new BookingService({
    bookingRepository: new MockBookingRepository(),
    getService: vi.fn().mockResolvedValue(mockService),
    ...overrides,
  })
}

// I route.ts (många rader -> 1 rad):
const bookingService = createBookingService()
```

---

### Fas 3 — Auth DDD-Light (säkerhetskritisk) — KLAR

> **Retrospektiv:** [docs/retrospectives/2026-02-01-ddd-light-auth-migration.md](retrospectives/2026-02-01-ddd-light-auth-migration.md)

**Steg 1: Skapa repository (specialized -- ej IRepository<T>)**
```
src/infrastructure/persistence/auth/
  IAuthRepository.ts          # Specialized metoder, strikta projektioner
  PrismaAuthRepository.ts     # select överallt, aldrig include
  MockAuthRepository.ts       # seedUser/seedProvider/seedToken helpers
  index.ts                    # Re-exports
```

**Steg 2: TDD: Skapa AuthService**
```
src/domain/auth/
  AuthService.ts              # 4 metoder + createAuthService() factory
  AuthService.test.ts         # 21 tester med MockAuthRepository
  mapAuthErrorToStatus.ts     # Centraliserad error -> HTTP status
```

Metoder: register, verifyEmail, resendVerification, verifyCredentials
DI: hashPassword, comparePassword, generateToken, emailService

**Steg 3: Migrera routes + auth.ts**
```
register/route.ts             # 136 -> 86 rader (-37%)
verify-email/route.ts         # 85 -> 51 rader (-40%), fixar include -> select
resend-verification/route.ts  # 87 -> 55 rader (-37%)
src/lib/auth.ts               # prisma + bcrypt borta, använder verifyCredentials()
```

**Säkerhetsfix:** verify-email använde `include: { user: true }` (exponerade passwordHash). Fixat via `select` i PrismaAuthRepository.

---

### Fas 4 — Test-coverage

**Sessioner:** 2-3 (en per testgrupp)
- Session A: rate-limit.ts + auth-server.ts tester
- Session B: auth routes tester
- Session C (om behövs): Logger + IDOR E2E-tester

Inga nya abstraktioner. Bara tester för otestade filer.

**Prioriterade (säkerhetskritiska):**
1. `src/lib/rate-limit.ts` (saknar tester)
2. `src/lib/auth-server.ts` (saknar tester)
3. `src/app/api/auth/*/route.ts` (saknar tester)

**OBS:** `src/lib/encryption.ts` har redan 6 tester — behöver inte skrivas.

**Utökad test-scope (från security-review):**
4. Logger — verifiera att känslig data INTE loggas
5. Auth routes — timing attack resistance
6. IDOR — cross-user access (E2E)

**Mål:** API-routes 66% -> 80%, lib utilities 33% -> 90%.

---

### Fas 5 — Event-infrastruktur för Booking — KLAR

> **Retrospektiv:** [docs/retrospectives/2026-02-01-ddd-light-event-infrastructure.md](retrospectives/2026-02-01-ddd-light-event-infrastructure.md)
>
> Events utan fullständigt aggregat. BookingService orördes -- events emitteras från routes EFTER service-anrop.

#### 5.1 Aktivera Domain Events i AggregateRoot

`src/domain/shared/base/AggregateRoot.ts` har events utkommenterade. Aktivera dem.

#### 5.2 Skapa EventDispatcher (Factory Pattern)

**VIKTIGT:** Använd Factory Pattern för serverless-kompatibilitet (Vercel).

```
src/infrastructure/events/
  IDomainEvent.ts
  IEventHandler.ts
  IEventDispatcher.ts
  InMemoryEventDispatcher.ts
  InMemoryEventDispatcher.test.ts
  BookingEventDispatcherFactory.ts
```

#### 5.3 Booking-aggregat + event handlers

Konsolidera filer för locality of behavior:

```
src/domain/booking/
  Booking.ts                    # Aggregat-rot
  BookingEvents.ts              # ALLA events i en fil
  BookingEventHandlers.ts       # ALLA handlers i en fil
```

2 filer istället för 8 — relaterad kod tillsammans.

**Event Handler Security Guidelines:**
- Zod-validering av event payload i varje handler
- Idempotency check (förhindra replay)
- Try-catch + logger.error (en handler som kraschar stoppar inte andra)

---

## Del 4: Arbetsmetod

### Migration Strategy: Branch-by-Abstraction

För att undvika breaking changes under migrering:

```
1. Skapa NYA klasser (ReviewService, IReviewRepository)
   utan att radera gamla mönstret

2. Migrera EN route i taget:
   - Route 1 -> använd ny service + repository
   - Commit + tester gröna
   - Route 2 -> använd ny service + repository
   - Commit + tester gröna

3. När ALLA routes för domänen är migrerade:
   - Verifiera att inga Prisma-anrop finns kvar i routes
   - Radera eventuell gammal kod
   - Merge feature branch till main

4. Om problem uppstår:
   - Varje route-migrering är 1 commit
   - git revert <commit> för att backa en specifik route
   - git bisect för att hitta var testet gick sönder
```

**Branch-strategi:**
```bash
git checkout -b refactor/ddd-light-review    # Per domän
# ... migrera alla routes ...
git checkout main && git merge refactor/ddd-light-review
```

### DDD-Light-domän (7 steg)

```
Steg 1: Skapa IXxxRepository interface
        -> Commit: "refactor: add IReviewRepository interface"

Steg 2: Implementera PrismaXxxRepository
        -> Commit: "refactor: add PrismaReviewRepository"

Steg 3: Implementera MockXxxRepository
        -> Commit: "test: add MockReviewRepository"

Steg 4: TDD: Skapa XxxService (om affärsregler finns)
        -> Commit: "feat: add ReviewService with validation"

Steg 5: Migrera route 1 -> tester gröna
        -> Commit: "refactor: migrate POST /api/reviews to repository"

Steg 6: Migrera route 2 -> tester gröna
        -> Commit per route

Steg 7: Verifiera
        -> npm test -- --run
        -> E2E (om det finns)
        -> Om fail: git bisect
```

### Session Management (Context Window)

**Lärdom från Fas 1:** GroupBooking (8 routes, 19 filer) fyllde context-fönstret.
Review (3 routes) och Horse (7 routes) klarade sig men var nära gränsen med retro + docs.

**Tumregel:** En session klarar ~5-6 routes + tester ELLER repo + service + tester.
Retro + docs kräver egen session om migreringen är stor (6+ routes).

**Splitting-strategi för DDD-Light-domäner:**

| Storlek | Routes | Sessioner | Split |
|---------|--------|-----------|-------|
| Liten (Review) | 1-3 | 1 | Allt i en session inkl retro |
| Medel (Horse) | 4-6 | 1-2 | Kan klara en session, splitta om retro ingår |
| Stor (GroupBooking) | 7+ | 2 | Obligatorisk split |

**Session A: Infrastruktur + Service**
- Steg 1-4: Interface, Prisma-repo, Mock-repo, Service med TDD
- Kör tester, commit
- DoD: Service-tester gröna, inga TypeScript-fel

**Session B: Routes + Retro + Docs**
- Steg 5-N: Migrera alla routes (en per commit)
- Steg N+1: Verifiering (full testsvit + typecheck)
- Retro med agenter (tech-architect + test-lead)
- Uppdatera CLAUDE.md key learnings
- Uppdatera DDD-TDD-REFACTORING-PLAN.md (markera klar, länka retro)
- Commit docs
- DoD: Alla tester gröna, retro sparad, docs uppdaterade

**För små domäner (1-3 routes):** Allt i en session är OK.

---

## Del 5: Säkerhetsriktlinjer

### IDOR-skydd vid repository-migrering (KRITISKT)

När routes migreras till repositories MÅSTE ownership-checks bevaras.

**Repository-metoder MÅSTE inkludera userId/providerId:**

```typescript
// RÄTT: Ownership baked in
async findById(id: string, userId: string): Promise<Review | null>

// FEL: Saknar ownership-parameter
async findById(id: string): Promise<Review | null>
```

**Tester MÅSTE verifiera ownership:**

```typescript
test("findById returns null for other user's review", async () => {
  const review = await repo.findById(existingId, "different-user-id")
  expect(review).toBeNull()
})
```

### Sensitive Data Protection i repositories

**ALLTID använd `select`, aldrig `include`:**

```typescript
// RÄTT:
return await prisma.review.findFirst({
  where: { id, customerId: userId },
  select: {
    id: true,
    rating: true,
    comment: true,
    customer: {
      select: {
        id: true,
        name: true,
        // passwordHash UTELÄMNAT
      }
    }
  }
})

// FEL:
include: { customer: true }  // Exponerar passwordHash
```

**Test-verifiering:**

```typescript
test("findById never exposes passwordHash", async () => {
  const review = await repo.findById(id, userId)
  expect(review.customer.passwordHash).toBeUndefined()
})
```

### Transaction Safety

Alla operationer som ändrar flera entiteter MÅSTE vara transaktionella:

```typescript
// RÄTT: All-or-nothing
return await prisma.$transaction(async (tx) => {
  const booking = await tx.booking.update(...)
  await tx.notification.create(...)
  return booking
})

// FEL: Flera DB-operationer utan transaction
await prisma.booking.update(...)
await prisma.notification.create(...)
// Om notification failar = inkonsistent state
```

### Checklista för varje repository-migrering

```markdown
- [ ] Alla finder-metoder tar userId/providerId som parameter
- [ ] Ownership verifieras i WHERE-clause (atomärt)
- [ ] `select` används (aldrig `include`)
- [ ] passwordHash aldrig exponerad (test verifierar)
- [ ] Flerstegs-operationer använder $transaction
- [ ] Unit test för cross-user access (förväntar null/403)
- [ ] E2E test försöker hämta annan users data
```

---

## Del 6: git bisect

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
git bisect run npm test -- --run src/domain/review/ReviewService.test.ts
# "a1b2c3d is the first bad commit"
git bisect reset
```

---

## Del 7: Filstruktur

```
src/
  domain/
    shared/
      base/
        AggregateRoot.ts         # Finns (events aktiverade — Fas 5)
        Entity.ts                # Finns
        ValueObject.ts           # Finns
      types/
        Result.ts                # Finns
        Guard.ts                 # Finns
      errors/
        DomainError.ts           # Finns

    booking/                     # DDD-LIGHT + BookingStatus VO (Fas 2)
      BookingStatus.ts           # NY value object (state machine)
      BookingService.ts          # Finns (461 rader) — uppdatera med VO
      BookingService.test.ts     # Finns — uppdatera
      BookingServiceFactory.ts   # NY (DI factory)
      TravelTimeService.ts       # Finns

    horse/                       # DDD-LIGHT (Fas 1)
      HorseService.ts            # NY
      HorseService.test.ts       # NY

    review/                      # DDD-LIGHT (Fas 1 — pilot)
      ReviewService.ts           # NY
      ReviewService.test.ts      # NY

    group-booking/               # DDD-LIGHT (Fas 1)
      GroupBookingService.ts     # Finns — refaktorera bort Prisma
      GroupBookingService.test.ts

    auth/                        # DDD-LIGHT (Fas 3)
      AuthService.ts             # NY
      AuthService.test.ts        # NY

  infrastructure/
    persistence/
      booking/                   # Finns — klar
      provider/                  # Finns — klar
      service/                   # Finns — klar
      horse/                     # NY (Fas 1)
        IHorseRepository.ts
        PrismaHorseRepository.ts
        MockHorseRepository.ts
      review/                    # NY (Fas 1 — pilot)
        IReviewRepository.ts
        PrismaReviewRepository.ts
        MockReviewRepository.ts
      group-booking/             # NY (Fas 1)
        IGroupBookingRepository.ts
        PrismaGroupBookingRepository.ts
        MockGroupBookingRepository.ts
      auth/                      # NY (Fas 3)
        IAuthRepository.ts
        PrismaAuthRepository.ts
        MockAuthRepository.ts

  app/api/                       # Routes — successivt tunnare
```

**Totalt Fas 0-4: ~20 nya filer** (ner från ~35 i v1 tack vare:
RouteOrder uppskjuten, events uppskjutna, event-filer konsoliderade).

---

## Del 8: Checklista

### DDD-Light-domän

```markdown
## [Domän] — DDD-Light

### Förberedelse
- [ ] Läs igenom alla routes
- [ ] Identifiera affärsregler
- [ ] Kolla att befintliga tester är gröna
- [ ] Dokumentera nuvarande IDOR-skydd per route

### Implementation
- [ ] Skapa IXxxRepository (med userId i finder-metoder)
- [ ] Implementera PrismaXxxRepository (select, aldrig include)
- [ ] Implementera MockXxxRepository
- [ ] TDD: Skapa service (om regler finns)
- [ ] Migrera route 1 -> commit -> grönt
- [ ] Migrera route 2 -> commit -> grönt
- [ ] ...

### Säkerhet (BLOCKERANDE)
- [ ] Alla finder-metoder tar userId/providerId
- [ ] Test: cross-user access returnerar null
- [ ] Test: passwordHash aldrig exponerad
- [ ] Flerstegs-operationer i $transaction

### Verifiering
- [ ] npm test -- --run
- [ ] E2E (om det finns)
- [ ] Inga Prisma-anrop kvar i routes för denna domän
- [ ] API latency: < 20ms regression vs baseline
```

### Session DoD

```markdown
- [ ] Alla tester gröna innan session avslutas
- [ ] Commit gjord (inte opushat arbete över sessionsgränser)
- [ ] Om sista sessionen: retro + docs uppdaterade
```

### BookingStatus value object

```markdown
## Booking — BookingStatus VO

### Förberedelse
- [ ] Läs BookingService.ts (461 rader)
- [ ] Identifiera status-övergångar
- [ ] Kolla befintliga tester

### Implementation
- [ ] TDD: BookingStatus value object (state machine)
- [ ] Uppdatera BookingService att använda VO
- [ ] Skapa BookingServiceFactory (DI)

### Verifiering
- [ ] npm test -- --run
- [ ] E2E
- [ ] Status-övergångar valideras av VO (inte if-satser)
```

---

## Del 9: Prioritetsordning

| Prio | Fas | Domän | Steg | Status |
|------|-----|-------|------|--------|
| 0 | Fas 0 | Förberedelse | Baseline, feature branch | KLAR |
| 1 | Fas 1.1 | Review (pilot) | Repo + service + migrera 3 routes | KLAR — [retro](retrospectives/2026-02-01-ddd-light-review-pilot.md) |
| 2 | Fas 1.2 | Horse | Repo + service + migrera 7 routes | KLAR — [retro](retrospectives/2026-02-01-ddd-light-horse-migration.md) |
| 3 | Fas 1.3 | GroupBooking | Repo + refaktorera service + migrera routes | KLAR -- [retro](retrospectives/2026-02-01-ddd-light-groupbooking-migration.md) |
| 4 | Fas 2 | Booking | BookingStatus VO + factory | KLAR -- [retro](retrospectives/2026-02-01-ddd-light-booking-status-vo.md) |
| 5 | Fas 3 | Auth | Repo + service + factory (säkerhet) | KLAR -- [retro](retrospectives/2026-02-01-ddd-light-auth-migration.md) |
| 6 | Fas 4 | Test-coverage | rate-limit, auth-server, logger, auth routes | KLAR -- [retro](retrospectives/2026-02-01-ddd-light-test-coverage.md) |
| 7 | Fas 5 | Event-infrastruktur | InMemoryEventDispatcher, 3 event-typer, 7 handlers, 3 routes migrerade | KLAR -- [retro](retrospectives/2026-02-01-ddd-light-event-infrastructure.md) |

### När uppgradera nästa domän till events?

Event-mönstret är nu bevisat för Booking. För att använda events i en annan domän:

1. Skapa `XxxEvents.ts` med event-typer + factory-funktioner
2. Skapa `XxxEventHandlers.ts` med handlers + dispatcher factory
3. Migrera routes från manuella sidoeffekter till event dispatch
4. Kör befintliga tester -- behavior-based tester överlever

**Trigger för nya domäner:** 3+ sidoeffekter per händelse (notis + email + kalender + ...)

---

## Del 10: Performance

### Baseline (mät INNAN refaktorering)

```bash
# Enkel latency-check
curl -w "@curl-format.txt" -X GET http://localhost:3000/api/bookings
```

### Förväntat overhead

| Ändring | Overhead |
|---------|----------|
| Repository-lager (DDD-Light) | ~0.1ms (function call) — NEGLIGIBLE |
| BookingStatus value object | ~0.1ms — NEGLIGIBLE |
| Event dispatch (framtida) | ~5-10ms per booking |

### Acceptanskriterium

- Regression < 20ms per fas
- p95 latency < 200ms för booking-endpoints

---

## Ordlista

| Term | Förklaring |
|------|-----------|
| **Repository** | Abstraktionslager mellan domän och databas. Interface + implementation. |
| **Domain Service** | Klass med affärsregler. Vet inget om HTTP. |
| **Value Object** | Immutable objekt som validerar sig vid skapande. |
| **Aggregat** | Klass med beteende som skyddar sina regler. Genererar events. (Framtida) |
| **Domain Event** | Beskriver något som hänt. Genereras av aggregat, hanteras av handlers. (Framtida) |
| **State Machine** | Giltiga tillståndsövergångar (pending -> confirmed -> completed). |
| **Result<T, E>** | Returtyp som tvingar hantering av success och error. |
| **Factory Pattern** | Funktion som skapar fullt konfigurerade objekt (DI utan framework). |
| **Branch-by-Abstraction** | Migrationsstrategi: ny kod + gammal kod lever parallellt tills migrering klar. |
| **Bisect** | Git-kommando: binärsöker commits för att hitta var en bugg uppstod. |
| **TDD** | Test först -> implementera -> refaktorera. |
| **IDOR** | Insecure Direct Object Reference — när en användare kan komma åt andras data. |

---

## Del 11: Slutsummering

> **Alla 8 faser (0-5) är genomförda.** Planen är 100% avklarad per 2026-02-01.

### Vad som byggdes

| Fas | Domän | Resultat |
|-----|-------|----------|
| 0 | Förberedelse | Baseline, feature branch, alla tester gröna |
| 1.1 | Review | IReviewRepository + PrismaReviewRepository + MockReviewRepository + ReviewService (14 tester) |
| 1.2 | Horse | IHorseRepository + PrismaHorseRepository + MockHorseRepository + HorseService (91 tester) |
| 1.3 | GroupBooking | IGroupBookingRepository + PrismaGroupBookingRepository + MockGroupBookingRepository + GroupBookingService refaktorerad (25 tester, 95% coverage) |
| 2 | Booking | BookingStatus value object (state machine) + BookingServiceFactory (DI) |
| 3 | Auth | IAuthRepository (specialized) + PrismaAuthRepository + MockAuthRepository + AuthService (21 tester) + säkerhetsfixar (include -> select) |
| 4 | Test-coverage | Tester för rate-limit, auth-server, logger, auth routes. Hittade produktionsbuggar (saknad try-catch, rate limit efter JSON-parsing) |
| 5 | Event-infrastruktur | IDomainEvent, IEventHandler, IEventDispatcher, InMemoryEventDispatcher + 3 event-typer + 7 handlers + 3 routes migrerade |

### Nyckeltal

| Metric | Värde |
|--------|-------|
| Domäner migrerade till DDD-Light | 6 (Review, Horse, GroupBooking, Booking, Auth, Provider/Service) |
| Domäner på Prisma direkt (medvetet val) | 3 (Notification, Availability, RouteOrder) |
| Nya tester tillagda | 150+ (över alla faser) |
| Retrospektiv dokumenterade | 7 (en per fas + event-infrastruktur) |
| Säkerhetsbuggar hittade via migrering | 2 (include -> select i verify-email, rate limit ordering i register) |

### Bevisade patterns

1. **Repository + Service + Factory** — standard DDD-Light-stack för alla kärndomäner
2. **Value Object för state machines** — BookingStatus validerar övergångar typsäkert
3. **Behavior-based route-tester** — överlever refactoring utan ändringar
4. **MockRepository med seedable data** — snabbare och mer förutsägbart än Prisma-mocks
5. **Factory Pattern för DI** — `createXxxService()` i routes OCH callbacks (t.ex. NextAuth)
6. **Event dispatch från routes** — pragmatisk lösning utan full aggregat-omskrivning
7. **Per-handler error isolation** — en handlers fel blockerar inte andra

### Vad som INTE gjordes (medvetet)

| Vad | Varför |
|-----|--------|
| RouteOrder DDD-Light | Lågt ROI — mestadels CRUD, inga affärsregler |
| Fullständigt Booking-aggregat | Service-lagret fungerar. Uppgradera först när aggregatet ger tydligt mervärde |
| Strikt DDD för någon domän | Inget behov ännu — DDD-Light + events räcker |

### När uppgradera vidare?

Event-mönstret är bevisat. Använd det på fler domäner när triggern uppfylls:

- **3+ sidoeffekter per händelse** i en domän -> lägg till events
- **DDD-Light service når 300+ rader** -> dela upp eller uppgradera
- **Status-övergångar utan value object** -> skapa VO (bevisat mönster)
- **Booking behöver fullständigt aggregat** -> först när service-lagret begränsar (inte hypotetiskt)

---

*Skapat: 2026-02-01*
*v3: 2026-02-01 — Slutsummering tillagd, alla faser avklarade*
*Nivå: Hybrid (DDD-Light för kärndomäner, uppgradering till strikt DDD när motiverat)*
*Solo-utvecklare + Claude Code*

### Ändringslogg

**v1 (2026-02-01):** Ursprunglig plan — strikt DDD för Booking, DDD-Light för övriga.

**v2 (2026-02-01):** Omarbetad efter team-review:
- Inverterad prioritering (enklast först, Booking sist)
- Booking nedskalad till DDD-Light + BookingStatus VO (strikt DDD uppskjuten)
- RouteOrder uppskjuten (lågt ROI)
- Auth uppgraderad till DDD-Light (säkerhetskritisk)
- Säkerhetsriktlinjer tillagda (IDOR, select, transactions)
- Migration strategy (Branch-by-Abstraction) tillagd
- EventDispatcher: Factory Pattern för serverless-kompatibilitet
- Event-filer konsoliderade (2 istället för 8)
- BookingServiceFactory för DI
- Performance baseline tillagd
- Faktafel fixade (BookingService 100%, Horse 7 routes, encryption tester finns)

**v3 (2026-02-01):** Slutsummering:
- Alla 8 faser (0-5) markerade KLAR
- Nyckeltal, bevisade patterns och uppgraderingskriterier dokumenterade
- Medvetna utelämnanden dokumenterade (RouteOrder, strikt DDD)
