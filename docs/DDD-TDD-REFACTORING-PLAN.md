# DDD & TDD Refaktoreringsplan — Hybrid (v2)

> Lärande-dokument + handlingsplan for en solo-utvecklare med Claude Code.
>
> **Niva: Hybrid** — DDD-Light for karndomaner, Prisma direkt for stoddomaner,
> uppgradering till strikt DDD for Booking nar sidoeffekter motiverar det.
>
> **v2 (2026-02-01):** Omarbetad efter team-review (tech-architect, security-reviewer,
> kodbasanalys). Inverterad prioritering, serverless-fix, sakerhetsriktlinjer.

---

## Del 1: Koncept

### Tre nivaer — och nar du anvander vilken

Inte varje doman fortjanar samma abstraktionsniva. Valj efter komplexitet:

```
Komplexitet:   Lag              Medel                 Hog
               |                |                     |
Approach:      Prisma direkt    DDD-Light             Strikt DDD
               |                |                     |
Vad du far:    Route -> Prisma  Route -> Service      Route -> Service
                                      -> Repository         -> Aggregat
                                                             -> Events
               |                |                     |
Equinet:       Notification     Horse, Review         Booking (framtida)
               Availability     GroupBooking
                                Provider (klar)
                                Service (klar)
```

**Tumregel: valj den enklaste nivan som loser ditt problem.**

| Fraga | Om ja -> |
|-------|---------|
| Har domanen affarsregler som spanner flera entiteter? | Minst DDD-Light |
| Har domanen en state machine (status-overgangar)? | DDD-Light + value object |
| Har domanen 3+ sidoeffekter som borde vara frikopplade? | Strikt DDD |
| Ar det mestadels CRUD? | Prisma direkt |
| Behover testerna sluta mocka Prisma direkt? | DDD-Light |

### Decision Tree for nya features

```
1. Ar det CRUD utan affarslogik?
   -> Prisma direkt

2. Finns affarsregler som behover testas isolerat?
   -> DDD-Light (repo + service)

3. Finns state machine ELLER 3+ sidoeffekter att frikoppla?
   -> DDD-Light + BookingStatus value object
   -> Uppgradera till strikt DDD FORST nar du faktiskt
      har 3+ handlers (inte hypotetiskt)
```

### Red Flags — uppgradera domanen

- DDD-Light service nar 300+ rader
- Service har if-statements for status-overgangar (-> value object)
- Manuella sidoeffekt-anrop pa 3+ stallen i routes (-> events)

### Equinets domaner — vilken niva?

| Doman | Niva | Motivering |
|-------|------|-----------|
| **Booking** | DDD-Light + BookingStatus VO | State machine via value object, overlap-validering i repo. Uppgradera till strikt DDD nar 3+ sidoeffekter motiverar events. |
| **Horse** | DDD-Light | IDOR-skydd, soft delete, notes — men inga komplexa regler |
| **Review** | DDD-Light | "One per booking" + "must be completed" — enkla regler, repo racker |
| **GroupBooking** | DDD-Light | Befintlig service behover fixas (Prisma direkt i service), men logiken ar begransad |
| **RouteOrder** | Prisma direkt (uppskjuten) | Mestadels CRUD — lagt ROI for refaktorering just nu |
| **Provider** | DDD-Light (klar) | Redan repo, behall |
| **Service** | DDD-Light (klar) | Redan repo, behall |
| **Auth** | DDD-Light | Sakerhetskritisk — behover repository for testbarhet av timing attacks, audit logging |
| **Notification** | Prisma direkt | Stoddoman, ren CRUD |
| **Availability** | Prisma direkt | Schema-hantering, inga affarsregler |

---

### Koncept: DDD-Light (det du anvander mest)

DDD-Light = **repository + service + value objects**. Ingen aggregat-klass, inga events.

```
+---------------------------------------------+
|  Route (HTTP-lager)                         |
|  - Auth, Zod-validering, error-mapping      |
|  - Delegerar till service                   |
|  - Innehaller INGEN affarslogik             |
+---------------------+-----------------------+
                      |
+---------------------v-----------------------+
|  Domain Service                             |
|  - Affarsregler (validering, koordinering)  |
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

**Varfor repository?** Testerna slutar mocka Prisma-schema:

```typescript
// FORE: Fragilt — byter du kolumnnamn i Prisma -> testet gar sonder
jest.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Blansen" }]),
    },
  },
}))

// EFTER: Stabilt — schemaandringar paverkar bara PrismaHorseRepository
const mockRepo: IHorseRepository = {
  findByOwnerId: async () => [{ id: "1", name: "Blansen" }],
}
const service = new HorseService(mockRepo)
```

### Koncept: Strikt DDD (framtida — nar Booking behover events)

Strikt DDD = allt ovan PLUS **aggregat med beteende, domain events**.

Booking KAN motivera detta i framtiden om sidoeffekterna vaxer:
- **Idag**: 1 sidoeffekt (notis) — DDD-Light + value object racker
- **Framtida trigger**: Payment flow, kalender-sync, email + notis + analytics
  -> Nar du har 3+ handlers per event, uppgradera

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
  | mojliga kod     |
  +-------+---------+
          |
  +-------v---------+
  | REFACTOR         |
  | Forbattra utan   |
  | att bryta test   |
  +-------+----------+
          |
          +---> Tillbaka till RED
```

### Koncept: git bisect

Binarsoekning genom commits for att hitta var ett test gick sonder.

```bash
# Automatiserat: git testar at dig
git bisect start HEAD abc1234
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts

# Output: "a1b2c3d is the first bad commit"
git bisect reset
```

**Forutsattning:** en commit per logiskt steg, testerna grona vid varje commit.

### Koncept: Domain Events (framtida — nar Booking behover det)

> **OBS**: Implementera INTE events an. Dokumenterat har for framtida referens.
> Uppgraderingskriterium: 3+ sidoeffekter per booking-handelse.

```typescript
// Eventet (vad hande)
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
    // 1. Idempotency check (forhindra replay)
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
ar tom vid cold start. Losning: **Factory Pattern** som skapar dispatcher
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

## Del 2: Nulagesanalys

### Vad vi har idag

| Byggsten | Finns | Anvands |
|----------|-------|---------|
| `AggregateRoot.ts` | Ja (67 rader) | Nej (events utkommenterade) |
| `Entity.ts` | Ja (105 rader) | Ja (AggregateRoot extends det) |
| `ValueObject.ts` | Ja (138 rader) | Ja (TimeSlot, Location) |
| `Result.ts` | Ja (129 rader) | Ja (BookingService) |
| `DomainError.ts` | Ja | Ja |
| `BookingMapper.ts` | Ja | Ja |

### Doman-status (verifierat mot kodbasen)

| Doman | Routes | Repository | Service | Mal-niva | Status |
|-------|--------|------------|---------|----------|--------|
| **Booking** | 3+ | Ja (fullstandig) | Ja (461 rader, 100% komplett) | DDD-Light + VO | 85% — saknar BookingStatus VO |
| **Provider** | 2 | Ja (interface + impl + mock) | Nej | DDD-Light (klar) | 80% |
| **Service** | 2 | Ja (interface + impl + mock) | Nej | DDD-Light (klar) | 80% |
| **Horse** | 7 | Ja (interface + impl + mock) | Ja (HorseService, 91 tester) | DDD-Light (klar) | 100% |
| **GroupBooking** | 6+ | Nej | Ja (186 rader, Prisma direkt) | DDD-Light | 15% |
| **Review** | 3 | Ja (interface + impl + mock) | Ja (ReviewService, 14 tester) | DDD-Light (klar) | 100% |
| **RouteOrder** | 6+ | Nej | Nej | Prisma direkt (uppskjuten) | N/A |
| **Auth** | 3 | Nej | Nej | DDD-Light | 0% |
| **Notification** | 4 | Nej | Prisma direkt | Prisma direkt (klar) | 90% |
| **Availability** | 3 | Nej | Nej | Prisma direkt (klar) | 90% |

### Var affarslogik bor fel idag

| Regel | Bor idag | Ska bo |
|-------|----------|--------|
| Booking status-overgangar | BookingService (if-satser) | `BookingStatus` value object |
| "Must be completed before review" | `/api/reviews/route.ts` | `ReviewService` |
| "One review per booking" | `/api/reviews/route.ts` | `ReviewService` |
| "Max participants" | `/api/group-bookings/route.ts` | `GroupBookingService` (redan delvis) |
| "Send notification" | 3 booking-routes (manuella anrop) | Behall i service — events nar 3+ sidoeffekter |

### Test-coverage (verifierat)

| Fil | Tester | Status |
|-----|--------|--------|
| `rate-limit.ts` | Nej | SAKNAS — prioritet 1 |
| `auth-server.ts` | Nej | SAKNAS — prioritet 2 |
| `encryption.ts` | Ja (6 test cases) | OK |
| `auth/*/route.ts` | Nej | SAKNAS — prioritet 3 |

---

## Del 3: Handlingsplan

### Oversikt (inverterad prioritering — enklast forst)

| Fas | Vad | Domaner | Nya filer |
|-----|-----|---------|-----------|
| 0 | Forberedelse + baseline | — | 0 |
| 1 | DDD-Light for karndomaner | Review, Horse, GroupBooking | ~4 per doman |
| 2 | BookingStatus value object | Booking | ~2 |
| 3 | Auth repository (sakerhet) | Auth | ~4 |
| 4 | Test-coverage for otestade filer | Alla | 0 (bara tester) |
| 5 | (Framtida) Event-infrastruktur | Booking | ~4 (konsoliderat) |

**Totalt Fas 0-4: ~20 nya filer** (ner fran ~35 i v1).
Fas 5 laggs till forst nar events motiveras (se "Red Flags" ovan).

**Varfor inverterad ordning?**
- Fas 1 validerar repo-pattern pa enkel doman (Review) innan den anvands pa komplex (Booking)
- Snabbare feedback-loop — du far resultat redan efter forsta domanen
- Booking ar redan 85% klar, behover bara BookingStatus VO (Fas 2)
- Tester lopande istallet for efterkonstruktion

---

### Fas 0 — Forberedelse

Innan nagon kod andras:

```
- [ ] Verifiera att alla tester ar grona: npm test -- --run
- [ ] Dokumentera nuvarande API latency (baseline)
- [ ] Skapa feature branch: git checkout -b refactor/ddd-light
```

---

### Fas 1 — DDD-Light for karndomaner

Samma monster for alla tre domaner. **Ingen aggregat-klass, inga events.**
Bara repository + service.

**Ordning: Review (pilot) -> Horse -> GroupBooking**

Review ar enklast (3 routes, tydliga regler) och fungerar som pilot for att
validera att monstret funkar innan vi anvander det pa Horse och GroupBooking.

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

Affarsregler att flytta fran route.ts:
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

Affarsregler att flytta:
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

#### 1.3 GroupBooking (DDD-Light)

Befintlig `GroupBookingService` anvander Prisma direkt. Refaktorera till repository.

**Steg 1: Skapa repository**
```
src/infrastructure/persistence/group-booking/
  IGroupBookingRepository.ts
  PrismaGroupBookingRepository.ts
  MockGroupBookingRepository.ts
```

**Steg 2: Refaktorera GroupBookingService**
- Ta bort `import { prisma }` fran servicen
- Injicera repository via constructor
- Behall befintlig logik (invite code, status, max participants)

**Steg 3: Migrera routes (en per commit)**

---

### Fas 2 — BookingStatus value object

Booking ar redan 85% klar (fullstandig service + repository). Det enda som saknas
ar en BookingStatus value object for state machine-validering.

**INTE aggregat, INTE events.** Bara ett value object som gor status-overgangar typsäkra.

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
        message: `Kan inte ga fran "${this.value}" till "${next}"`
      })
    }
    return Result.ok(BookingStatus.create(next))
  }
}
```

**TDD-cykel:**
```
RED:    "pending kan ga till confirmed"
GREEN:  Implementera canTransitionTo()

RED:    "completed kan INTE ga till pending"
GREEN:  Returnera false for ogiltiga overgangar

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

#### 2.3 Factory Pattern for BookingService DI

BookingService har manga dependencies. Skapa factory for att minska boilerplate i routes:

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

// For test:
export function createMockBookingService(
  overrides?: Partial<BookingServiceDeps>
): BookingService {
  return new BookingService({
    bookingRepository: new MockBookingRepository(),
    getService: vi.fn().mockResolvedValue(mockService),
    ...overrides,
  })
}

// I route.ts (manga rader -> 1 rad):
const bookingService = createBookingService()
```

---

### Fas 3 — Auth DDD-Light (sakerhetskritisk)

Auth ar sakerhetskritisk och behover repository-abstraktion for testbarhet.

```
src/infrastructure/persistence/auth/
  IAuthRepository.ts
  PrismaAuthRepository.ts
  MockAuthRepository.ts

src/domain/auth/
  AuthService.ts
  AuthService.test.ts
```

**Varfor?**
- Timing attack prevention (testbart med mock)
- Audit logging for misslyckade login
- Rate limiting integration
- Konstant svarstid oavsett om email finns eller ej

```typescript
class AuthService {
  async authenticate(email: string, password: string) {
    const user = await this.repo.findUserByEmail(email)
    if (!user) {
      // Constant-time response (forhindra timing attack)
      await bcrypt.compare(password, FAKE_HASH)
      await this.repo.recordLoginAttempt(email, false)
      return null
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    await this.repo.recordLoginAttempt(email, isValid)
    return isValid ? user : null
  }
}
```

---

### Fas 4 — Test-coverage

Inga nya abstraktioner. Bara tester for otestade filer.

**Prioriterade (sakerhetskritiska):**
1. `src/lib/rate-limit.ts` (saknar tester)
2. `src/lib/auth-server.ts` (saknar tester)
3. `src/app/api/auth/*/route.ts` (saknar tester)

**OBS:** `src/lib/encryption.ts` har redan 6 tester — behover inte skrivas.

**Utokad test-scope (fran security-review):**
4. Logger — verifiera att kanslig data INTE loggas
5. Auth routes — timing attack resistance
6. IDOR — cross-user access (E2E)

**Mal:** API-routes 66% -> 80%, lib utilities 33% -> 90%.

---

### Fas 5 — (Framtida) Event-infrastruktur + Booking aggregat

> **Implementera INTE denna fas nu.** Dokumenterad for framtida referens.
> Uppgraderingskriterium: 3+ sidoeffekter per booking-handelse
> (t.ex. payment flow, kalender-sync, analytics).

#### 5.1 Aktivera Domain Events i AggregateRoot

`src/domain/shared/base/AggregateRoot.ts` har events utkommenterade. Aktivera dem.

#### 5.2 Skapa EventDispatcher (Factory Pattern)

**VIKTIGT:** Anvand Factory Pattern for serverless-kompatibilitet (Vercel).

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

Konsolidera filer for locality of behavior:

```
src/domain/booking/
  Booking.ts                    # Aggregat-rot
  BookingEvents.ts              # ALLA events i en fil
  BookingEventHandlers.ts       # ALLA handlers i en fil
```

2 filer istallet for 8 — relaterad kod tillsammans.

**Event Handler Security Guidelines:**
- Zod-validering av event payload i varje handler
- Idempotency check (forhindra replay)
- Try-catch + logger.error (en handler som kraschar stoppar inte andra)

---

## Del 4: Arbetsmetod

### Migration Strategy: Branch-by-Abstraction

For att undvika breaking changes under migrering:

```
1. Skapa NYA klasser (ReviewService, IReviewRepository)
   utan att radera gamla monstret

2. Migrera EN route i taget:
   - Route 1 -> anvand ny service + repository
   - Commit + tester grona
   - Route 2 -> anvand ny service + repository
   - Commit + tester grona

3. Nar ALLA routes for domanen ar migrerade:
   - Verifiera att inga Prisma-anrop finns kvar i routes
   - Radera eventuell gammal kod
   - Merge feature branch till main

4. Om problem uppstar:
   - Varje route-migrering ar 1 commit
   - git revert <commit> for att backa en specifik route
   - git bisect for att hitta var testet gick sonder
```

**Branch-strategi:**
```bash
git checkout -b refactor/ddd-light-review    # Per doman
# ... migrera alla routes ...
git checkout main && git merge refactor/ddd-light-review
```

### DDD-Light-doman (7 steg)

```
Steg 1: Skapa IXxxRepository interface
        -> Commit: "refactor: add IReviewRepository interface"

Steg 2: Implementera PrismaXxxRepository
        -> Commit: "refactor: add PrismaReviewRepository"

Steg 3: Implementera MockXxxRepository
        -> Commit: "test: add MockReviewRepository"

Steg 4: TDD: Skapa XxxService (om affarsregler finns)
        -> Commit: "feat: add ReviewService with validation"

Steg 5: Migrera route 1 -> tester grona
        -> Commit: "refactor: migrate POST /api/reviews to repository"

Steg 6: Migrera route 2 -> tester grona
        -> Commit per route

Steg 7: Verifiera
        -> npm test -- --run
        -> E2E (om det finns)
        -> Om fail: git bisect
```

---

## Del 5: Sakerhetsriktlinjer

### IDOR-skydd vid repository-migrering (KRITISKT)

Nar routes migreras till repositories MASTE ownership-checks bevaras.

**Repository-metoder MASTE inkludera userId/providerId:**

```typescript
// RATT: Ownership baked in
async findById(id: string, userId: string): Promise<Review | null>

// FEL: Saknar ownership-parameter
async findById(id: string): Promise<Review | null>
```

**Tester MASTE verifiera ownership:**

```typescript
test("findById returns null for other user's review", async () => {
  const review = await repo.findById(existingId, "different-user-id")
  expect(review).toBeNull()
})
```

### Sensitive Data Protection i repositories

**ALLTID anvand `select`, aldrig `include`:**

```typescript
// RATT:
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
        // passwordHash UTELAMNAT
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

Alla operationer som andrar flera entiteter MASTE vara transaktionella:

```typescript
// RATT: All-or-nothing
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

### Checklista for varje repository-migrering

```markdown
- [ ] Alla finder-metoder tar userId/providerId som parameter
- [ ] Ownership verifieras i WHERE-clause (atomart)
- [ ] `select` anvands (aldrig `include`)
- [ ] passwordHash aldrig exponerad (test verifierar)
- [ ] Flerstegs-operationer anvander $transaction
- [ ] Unit test for cross-user access (forvantar null/403)
- [ ] E2E test forsoker hamta annan users data
```

---

## Del 6: git bisect

### Nar?

| Situation | Bisect? |
|-----------|---------|
| Test failar efter refaktorering, oklart var | Ja |
| Du vet vilken fil du andrade | Nej — git diff |
| Flaky E2E-test | Nej — timing |
| Bygget sonder efter 10+ commits | Ja |

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
        AggregateRoot.ts         # Finns (events utkommenterade — Fas 5)
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

**Totalt Fas 0-4: ~20 nya filer** (ner fran ~35 i v1 tack vare:
RouteOrder uppskjuten, events uppskjutna, event-filer konsoliderade).

---

## Del 8: Checklista

### DDD-Light-doman

```markdown
## [Doman] — DDD-Light

### Forberedelse
- [ ] Las igenom alla routes
- [ ] Identifiera affarsregler
- [ ] Kolla att befintliga tester ar grona
- [ ] Dokumentera nuvarande IDOR-skydd per route

### Implementation
- [ ] Skapa IXxxRepository (med userId i finder-metoder)
- [ ] Implementera PrismaXxxRepository (select, aldrig include)
- [ ] Implementera MockXxxRepository
- [ ] TDD: Skapa service (om regler finns)
- [ ] Migrera route 1 -> commit -> gront
- [ ] Migrera route 2 -> commit -> gront
- [ ] ...

### Sakerhet (BLOCKERANDE)
- [ ] Alla finder-metoder tar userId/providerId
- [ ] Test: cross-user access returnerar null
- [ ] Test: passwordHash aldrig exponerad
- [ ] Flerstegs-operationer i $transaction

### Verifiering
- [ ] npm test -- --run
- [ ] E2E (om det finns)
- [ ] Inga Prisma-anrop kvar i routes for denna doman
- [ ] API latency: < 20ms regression vs baseline
```

### BookingStatus value object

```markdown
## Booking — BookingStatus VO

### Forberedelse
- [ ] Las BookingService.ts (461 rader)
- [ ] Identifiera status-overgangar
- [ ] Kolla befintliga tester

### Implementation
- [ ] TDD: BookingStatus value object (state machine)
- [ ] Uppdatera BookingService att anvanda VO
- [ ] Skapa BookingServiceFactory (DI)

### Verifiering
- [ ] npm test -- --run
- [ ] E2E
- [ ] Status-overgangar valideras av VO (inte if-satser)
```

---

## Del 9: Prioritetsordning

| Prio | Fas | Doman | Steg | Status |
|------|-----|-------|------|--------|
| 0 | Fas 0 | Forberedelse | Baseline, feature branch | KLAR |
| 1 | Fas 1.1 | Review (pilot) | Repo + service + migrera 3 routes | KLAR — [retro](retrospectives/2026-02-01-ddd-light-review-pilot.md) |
| 2 | Fas 1.2 | Horse | Repo + service + migrera 7 routes | KLAR — [retro](retrospectives/2026-02-01-ddd-light-horse-migration.md) |
| 3 | Fas 1.3 | GroupBooking | Repo + refaktorera service + migrera routes | |
| 4 | Fas 2 | Booking | BookingStatus VO + factory | |
| 5 | Fas 3 | Auth | Repo + service (sakerhet) | |
| 6 | Fas 4 | Test-coverage | rate-limit, auth-server, auth routes | |

### Nar uppgradera en doman?

Om du i framtiden marker att Booking behover events:

1. Aktivera events i AggregateRoot (Fas 5.1)
2. Skapa EventDispatcher med Factory Pattern (Fas 5.2)
3. Skapa Booking aggregat + event handlers (Fas 5.3)
4. Migrera BookingService -> aggregat
5. Migrera routes -> dispatcha events

**Trigger:** 3+ sidoeffekter per booking-handelse (notis + email + kalender + ...)

---

## Del 10: Performance

### Baseline (mata INNAN refaktorering)

```bash
# Enkel latency-check
curl -w "@curl-format.txt" -X GET http://localhost:3000/api/bookings
```

### Forvantat overhead

| Andring | Overhead |
|---------|----------|
| Repository-lager (DDD-Light) | ~0.1ms (function call) — NEGLIGIBLE |
| BookingStatus value object | ~0.1ms — NEGLIGIBLE |
| Event dispatch (framtida) | ~5-10ms per booking |

### Acceptanskriterium

- Regression < 20ms per fas
- p95 latency < 200ms for booking-endpoints

---

## Ordlista

| Term | Forklaring |
|------|-----------|
| **Repository** | Abstraktionslager mellan doman och databas. Interface + implementation. |
| **Domain Service** | Klass med affarsregler. Vet inget om HTTP. |
| **Value Object** | Immutable objekt som validerar sig vid skapande. |
| **Aggregat** | Klass med beteende som skyddar sina regler. Genererar events. (Framtida) |
| **Domain Event** | Beskriver nagot som hant. Genereras av aggregat, hanteras av handlers. (Framtida) |
| **State Machine** | Giltiga tillstandsovergangar (pending -> confirmed -> completed). |
| **Result<T, E>** | Returtyp som tvingar hantering av success och error. |
| **Factory Pattern** | Funktion som skapar fullt konfigurerade objekt (DI utan framework). |
| **Branch-by-Abstraction** | Migrationsstrategi: ny kod + gammal kod lever parallellt tills migrering klar. |
| **Bisect** | Git-kommando: binarsoker commits for att hitta var en bugg uppstod. |
| **TDD** | Test forst -> implementera -> refaktorera. |
| **IDOR** | Insecure Direct Object Reference — nar en anvandare kan komma at andras data. |

---

*Skapat: 2026-02-01*
*v2: 2026-02-01 — Omarbetad efter team-review*
*Niva: Hybrid (DDD-Light for karndomaner, uppgradering till strikt DDD nar motiverat)*
*Solo-utvecklare + Claude Code*

### Andringslogg

**v1 (2026-02-01):** Ursprunglig plan — strikt DDD for Booking, DDD-Light for ovriga.

**v2 (2026-02-01):** Omarbetad efter team-review:
- Inverterad prioritering (enklast forst, Booking sist)
- Booking nedskalad till DDD-Light + BookingStatus VO (strikt DDD uppskjuten)
- RouteOrder uppskjuten (lagt ROI)
- Auth uppgraderad till DDD-Light (sakerhetskritisk)
- Sakerhetsriktlinjer tillagda (IDOR, select, transactions)
- Migration strategy (Branch-by-Abstraction) tillagd
- EventDispatcher: Factory Pattern for serverless-kompatibilitet
- Event-filer konsoliderade (2 istallet for 8)
- BookingServiceFactory for DI
- Performance baseline tillagd
- Faktafel fixade (BookingService 100%, Horse 7 routes, encryption tester finns)
