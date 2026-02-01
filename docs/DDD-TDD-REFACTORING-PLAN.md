# DDD & TDD Refaktoreringsplan — Strikt DDD

> Lärande-dokument + handlingsplan. Syftet är att teamet ska förstå *varför* och *hur*
> vi gör kodbasen strikt domändriven och testdriven.
>
> **Nivå: Strikt DDD** (inte DDD-Light). Vi använder allt: aggregat, domain events,
> specifications, bounded contexts. Planen utgår från det som redan finns i kodbasen.

---

## Del 1: Koncept

### DDD-Light vs Strikt DDD — vad skiljer?

| Koncept | DDD-Light (vi har idag) | Strikt DDD (vi vill ha) |
|---------|------------------------|------------------------|
| **Entiteter** | TypeScript interfaces (data-påsar) | Klasser med beteende och skydd |
| **Aggregat** | AggregateRoot.ts finns men används inte | Booking, Horse etc. ärver AggregateRoot |
| **Value Objects** | TimeSlot, Location (2 st) | +Rating, Money, DateRange, InviteCode |
| **Repository** | 3 domäner (Booking, Provider, Service) | Alla kärndomäner |
| **Domain Service** | BookingService (1 bra) | En per kärndomän med affärsregler |
| **Domain Events** | Kommenterat i AggregateRoot | Aktiva, med dispatcher och handlers |
| **Specifications** | Finns inte | Återanvändbara affärsregler |
| **Bounded Contexts** | Finns inte explicit | Tydliga gränser mellan subdomäner |
| **Factories** | Finns inte | För komplexa aggregat |

### Varför strikt? Vad får vi?

Tre konkreta vinster:

**1. Ogiltiga tillstånd blir omöjliga**

```typescript
// IDAG: Booking är ett interface. Ingenting hindrar detta:
booking.status = "completed"  // Direkt, utan validering
// Vad om bokningen redan var cancelled? Ingen kontroll.

// STRIKT DDD: Booking är en klass som skyddar sig själv:
class Booking extends AggregateRoot<BookingProps> {
  complete(): Result<void, BookingError> {
    if (this.status !== "confirmed") {
      return Result.fail({
        type: "INVALID_TRANSITION",
        message: `Kan inte slutföra en bokning med status "${this.status}"`
      })
    }
    this.props.status = "completed"
    this.addDomainEvent(new BookingCompletedEvent(this.id))
    return Result.ok(undefined)
  }
}

// Nu kan du INTE hoppa från "pending" till "completed" —
// du MÅSTE gå pending → confirmed → completed.
// Kompilatorn och testerna skyddar dig.
```

**2. Sidoeffekter blir deklarativa**

```typescript
// IDAG: Routen måste veta vilka sidoeffekter som ska hända
// och anropa dem manuellt. Glömmer du en → tyst bugg.
const result = await bookingService.createBooking(dto)
if (result.isSuccess) {
  await notificationService.createAsync(...)  // Glöm denna → ingen notis
  await invoiceService.createDraft(...)       // Glöm denna → ingen faktura
}

// STRIKT DDD: Aggregatet genererar events, en dispatcher hanterar dem.
// Routen behöver inte veta om notiser, fakturor eller loggning.
const result = await bookingService.createBooking(dto)
if (result.isSuccess) {
  await eventDispatcher.dispatchAll(result.value.domainEvents)
  // BookingCreatedEvent → NotificationHandler lyssnar
  // BookingCreatedEvent → InvoiceHandler lyssnar
  // BookingCreatedEvent → AuditLogHandler lyssnar
  // Ny handler? Lägg till en subscriber. Routen ändras inte.
}
```

**3. Affärsregler blir återanvändbara**

```typescript
// IDAG: "Har kunden redan reviewat den här bokningen?" kollas inline i routen.
// Behöver du samma koll på ett annat ställe? Copy-paste.
// route.ts:
const existingReview = await prisma.review.findFirst({
  where: { bookingId, customerId: session.user.id }
})
if (existingReview) return NextResponse.json({ error: "Already reviewed" }, { status: 409 })

// STRIKT DDD: En Specification kapslar in regeln.
// Kan återanvändas i route, service, test, cron job — var som helst.
class OneReviewPerBookingSpec implements ISpecification<CreateReviewDTO> {
  constructor(private reviewRepo: IReviewRepository) {}

  async isSatisfiedBy(dto: CreateReviewDTO): Promise<boolean> {
    const existing = await this.reviewRepo.findByBookingAndCustomer(
      dto.bookingId, dto.customerId
    )
    return existing === null  // true = OK att skapa review
  }
}
```

---

### Byggstenarna — visuellt

```
┌─────────────────────────────────────────────────────────────────┐
│  BOUNDED CONTEXT: Bokning                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Route (HTTP-lager)                                      │   │
│  │  - Tar emot request, validerar med Zod                   │   │
│  │  - Delegerar till Application Service                    │   │
│  │  - Dispatchar domain events                              │   │
│  │  - Mappar resultat till HTTP-svar                        │   │
│  │  - Innehåller INGEN affärslogik                          │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                           │
│  ┌──────────────────▼──────────────────────────────────────┐   │
│  │  Domain Service (koordinering)                           │   │
│  │  - Koordinerar mellan aggregat och repositories          │   │
│  │  - Använder Specifications för affärsregler              │   │
│  │  - Returnerar Result<Aggregat, Error>                    │   │
│  │  - Vet INGET om HTTP, Prisma eller databas               │   │
│  └────┬──────────────┬──────────────────┬──────────────────┘   │
│       │              │                  │                       │
│  ┌────▼─────┐  ┌─────▼──────┐  ┌───────▼────────┐             │
│  │ Aggregat │  │ Repository │  │ Specification  │             │
│  │ Root     │  │ (interface)│  │ (affärsregler) │             │
│  │          │  │            │  │                │             │
│  │ Booking  │  │ IBooking   │  │ NoOverlap      │             │
│  │ .confirm │  │ Repository │  │ Spec           │             │
│  │ .cancel  │  │            │  │                │             │
│  │ .complete│  │ .findById  │  │ OneReviewPer   │             │
│  │          │  │ .save      │  │ BookingSpec    │             │
│  │ Genererar│  │ .delete    │  │                │             │
│  │ Domain   │  │            │  │ .isSatisfiedBy │             │
│  │ Events   │  │            │  │ .and / .or     │             │
│  └────┬─────┘  └────────────┘  └────────────────┘             │
│       │                                                         │
│  ┌────▼──────────────────────┐                                 │
│  │  Value Objects            │                                 │
│  │  TimeSlot, Rating, Money  │                                 │
│  │  (immutable, självvalid.) │                                 │
│  └───────────────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │ Domain Events
          ▼
┌─────────────────────────────────┐
│  Event Dispatcher               │
│  BookingCreatedEvent            │
│    → NotificationHandler        │
│    → AuditLogHandler            │
│    → InvoiceHandler             │
└─────────────────────────────────┘
```

---

### Koncept: Aggregat

Ett aggregat är en grupp relaterade objekt som behandlas som en enhet.
**Aggregat-roten** är den enda ingångspunkten — all åtkomst går via den.

```
Booking (aggregat-rot)
├── status         — bara Booking själv kan ändra
├── timeSlot       — value object (TimeSlot)
├── horse          — referens (horseId), inte ägt
└── domainEvents[] — events som genererats

Regel: Du hämtar ALLTID Booking via BookingRepository.
       Du ändrar ALLTID status via booking.confirm() / booking.cancel().
       Du sparar ALLTID via BookingRepository.save(booking).
       Du sprider ALDRIG Prisma-anrop i routen.
```

**Vad ägs vs refereras?**

```
Booking-aggregatet ÄGER:
  - status, date, startTime, endTime, notes

Booking-aggregatet REFERERAR (via ID):
  - customerId  → User-aggregat (annan bounded context)
  - providerId  → Provider-aggregat (annan bounded context)
  - serviceId   → Service-aggregat (annan bounded context)
  - horseId     → Horse-aggregat (annan bounded context)
```

### Koncept: Domain Events

Ett event beskriver något som redan har hänt i domänen.

```typescript
// Event-definitionen (vad hände?)
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

// Handlers reagerar (registreras vid uppstart)
class SendNotificationOnBookingCreated implements IEventHandler<BookingCreatedEvent> {
  constructor(private notificationRepo: INotificationRepository) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    await this.notificationRepo.create({
      userId: event.providerId,
      type: "NEW_BOOKING",
      message: "Du har en ny bokning",
      relatedId: event.bookingId,
    })
  }
}
```

**Varför events istället för direktanrop?**
- Aggregatet behöver inte veta om notiser, fakturor etc.
- Nya sidoeffekter = ny handler, ingen ändring i befintlig kod
- Handlers kan köras async (fire-and-forget) eller i samma transaktion
- Testbart: verifiera att rätt events genereras, inte att rätt services anropas

### Koncept: Specifications

En specification kapslar in en affärsregel som kan frågas: "uppfyller X detta krav?"

```typescript
// Interface
interface ISpecification<T> {
  isSatisfiedBy(candidate: T): Promise<boolean> | boolean
}

// Konkret specification
class BookingMustBeCompletedSpec implements ISpecification<Booking> {
  isSatisfiedBy(booking: Booking): boolean {
    return booking.status === "completed"
  }
}

// Kombinera specifications
class CanCreateReviewSpec implements ISpecification<CreateReviewDTO> {
  constructor(
    private bookingCompleted: BookingMustBeCompletedSpec,
    private onePerBooking: OneReviewPerBookingSpec,
  ) {}

  async isSatisfiedBy(dto: CreateReviewDTO): Promise<boolean> {
    const booking = await this.bookingRepo.findById(dto.bookingId)
    return this.bookingCompleted.isSatisfiedBy(booking)
        && await this.onePerBooking.isSatisfiedBy(dto)
  }
}

// Användning i service
class ReviewService {
  async createReview(dto: CreateReviewDTO): Promise<Result<Review, ReviewError>> {
    if (!await this.canCreateReviewSpec.isSatisfiedBy(dto)) {
      return Result.fail({ type: "REVIEW_NOT_ALLOWED" })
    }
    // ...skapa review
  }
}
```

### Koncept: Bounded Contexts

En bounded context är en tydlig gräns runt en del av domänen.
Inom gränsen har termer en specifik betydelse. Utanför kan samma ord betyda
något annat.

```
┌───────────────────┐     ┌───────────────────┐
│  BOKNING          │     │  HÄST-HÄLSA       │
│                   │     │                   │
│  Booking          │     │  Horse            │
│  - customerId     │────→│  - ownerId        │
│  - horseId ───────│─────│  - healthTimeline │
│  - status         │     │  - notes          │
│  - timeSlot       │     │  - passport       │
│                   │     │                   │
│  "Horse" = bara   │     │  "Horse" = fullt  │
│  ett ID som       │     │  aggregat med     │
│  refereras        │     │  hälsohistorik    │
└───────────────────┘     └───────────────────┘

Kommunikation mellan contexts sker via:
  1. ID-referens (horseId) — inte hela objektet
  2. Domain events — "BookingCompleted" → hälsotidslinjen uppdateras
  3. Application service — koordinerar vid behov
```

I Equinet identifierar vi dessa bounded contexts:

| Context | Aggregat | Ansvar |
|---------|----------|--------|
| **Bokning** | Booking, GroupBookingRequest | Schemaläggning, tider, status |
| **Leverantör** | Provider, Service, Availability | Profil, tjänster, schema |
| **Häst-hälsa** | Horse, HorseNote | Register, hälsohistorik, pass |
| **Recension** | Review | Omdömen, betyg, svar |
| **Rutt** | RouteOrder | Ruttplanering, stops |
| **Betalning** | (framtida) | Fakturering, Swish/Stripe |
| **Notis** | Notification | Pushnotiser, påminnelser |

---

### Koncept: Varför repository-pattern?

Jämför hur tester ser ut med och utan:

```typescript
// UTAN repository — testet är kopplat till Prisma-schema
// Om du byter namn på en kolumn i schemat → testet går sönder
jest.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findMany: jest.fn().mockResolvedValue([{ id: "1", name: "Blansen" }]),
      create: jest.fn().mockResolvedValue({ id: "2", name: "Sansen" }),
    },
  },
}))

// MED repository — testet bryr sig bara om beteende
// Schemaändringar påverkar bara PrismaHorseRepository, inte testet
const mockRepo: IHorseRepository = {
  findByOwnerId: async () => [{ id: "1", name: "Blansen" }],
  create: async (data) => ({ id: "2", ...data }),
}
const service = new HorseService(mockRepo)
```

I strikt DDD använder **alla** kärndomäner repository — ingen undantag.

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
  │ möjliga kod för  │
  │ att testet ska   │
  │ passera          │
  └───────┬─────────┘
          │
  ┌───────▼─────────┐
  │ REFACTOR         │
  │ Förbättra koden  │
  │ utan att bryta   │
  │ testet           │
  └───────┬─────────┘
          │
          └──→ Tillbaka till RED
```

Nyckelinsikt: du skriver **testet först**. Det tvingar dig att tänka på API:et
(hur ska koden *användas*?) innan du tänker på implementation (hur ska koden *fungera*?).

### Koncept: git bisect

En binärsökningsteknik för att hitta vilken commit som introducerade ett problem.

**Scenario**: Du har 64 commits sedan allt fungerade. Något test failar nu.
Manuellt: testa commit för commit = 64 steg.
Med bisect: binärsökning = ~6 steg.

```bash
# 1. Starta bisect
git bisect start

# 2. Markera nuvarande commit som dålig
git bisect bad

# 3. Markera en commit där allt fungerade som bra
git bisect good abc1234

# Git checkar nu ut mitten-committen. Kör testet:
npm test -- --run src/domain/booking/BookingService.test.ts

# 4. Berätta för git om det fungerar eller inte
git bisect good    # om testet passerar
# ELLER
git bisect bad     # om testet failar

# Git hoppar till nästa mittpunkt. Upprepa steg 4 tills git säger:
# "abc5678 is the first bad commit"

# 5. Avsluta
git bisect reset
```

**Automatiserat** (ännu kraftfullare):

```bash
# Git kör testet automatiskt vid varje steg
git bisect start HEAD abc1234
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts
```

**Varför bisect + strikt DDD passar ihop:**

I strikt DDD gör du fler, mindre commits:
1. Skapa `BookingCreatedEvent` klass
2. Aktivera events i `AggregateRoot`
3. Skapa `EventDispatcher`
4. Skapa `NotificationHandler`
5. Koppla ihop i route
6. Ta bort gammal manuell `notificationService.createAsync()`

Varje steg = en commit, testerna gröna. Om steg 5 bryter något hittar
bisect det automatiskt. Utan bisect letar du manuellt.

**Tumregel**: en commit per logiskt steg, testerna gröna vid varje commit.

---

## Del 2: Nulägesanalys

### Vad vi har idag

Kodbasen har starka grunder men inkonsekvent adoption:

| Byggsten | Finns | Används | Bedömning |
|----------|-------|---------|-----------|
| `AggregateRoot.ts` | Ja | Nej (events kommenterade) | Aktivera |
| `Entity.ts` | Ja | Nej (entiteter är interfaces) | Migrera entiteter |
| `ValueObject.ts` | Ja | Ja (TimeSlot, Location) | Utöka |
| `Result.ts` | Ja | Ja (BookingService) | Behåll |
| `DomainError.ts` | Ja | Ja | Behåll |
| `Guard.ts` | Ja | Delvis | Använd mer |
| `BookingMapper.ts` | Ja | Ja | Mall för fler |

### Domän-status

| Domän | Routes | Repository | Aggregat-klass | Service | Events | Status |
|-------|--------|------------|----------------|---------|--------|--------|
| **Booking** | 2 | Ja | Nej (interface) | Ja | Nej | 60% |
| **Provider** | 2 | Ja | Nej | Nej | Nej | 40% |
| **Service** | 2 | Ja | Nej | Nej | Nej | 40% |
| **Horse** | 5 | Nej | Nej | Nej | Nej | 0% |
| **GroupBooking** | 6 | Nej | Nej | Delvis (Prisma direkt) | Nej | 15% |
| **Review** | 3 | Nej | Nej | Nej | Nej | 0% |
| **RouteOrder** | 6 | Nej | Nej | Nej | Nej | 0% |
| **Availability** | 3 | Nej | Nej | Nej | Nej | 0% |
| **Notification** | 4 | Nej | Nej | Delvis (Prisma direkt) | Nej | 10% |

### Var affärslogik bor idag (problem)

| Regel | Bor idag | Borde bo i strikt DDD |
|-------|----------|----------------------|
| Booking status-övergångar | BookingService | `Booking.confirm()`, `Booking.cancel()` |
| "Booking must be completed before review" | `/api/reviews/route.ts` | `BookingMustBeCompletedSpec` |
| "One review per booking" | `/api/reviews/route.ts` | `OneReviewPerBookingSpec` |
| "Max participants in group booking" | `/api/group-bookings/route.ts` | `GroupBookingRequest.addParticipant()` |
| "Date range max 30 days" | `/api/group-bookings/route.ts` | Value object `DateRange` |
| "Customer vs provider flow" | `/api/route-orders/route.ts` | `RouteOrderService` |
| "Send notification after booking" | `/api/bookings/route.ts` | `BookingCreatedEvent` → handler |

### Saknade value objects

| Value Object | Validerar | Används av |
|-------------|-----------|-----------|
| `Rating` | Heltal 1-5 | Review |
| `Money` / `Price` | Belopp > 0, valuta | Service, Booking |
| `DateRange` | start < end, konfigurerbar max span | GroupBooking, Availability |
| `InviteCode` | Rätt teckenuppsättning, längd | GroupBooking |
| `BookingStatus` | Giltiga övergångar (state machine) | Booking |

---

## Del 3: Handlingsplan — Strikt DDD

### Skillnad mot DDD-Light-planen

I DDD-Light-planen var det tre faser: (1) lägg till repositories, (2) test-coverage,
(3) value objects. Strikt DDD ändrar ordningen och lägger till fyra nya arbetspaket:

| Fas | DDD-Light | Strikt DDD (denna plan) |
|-----|-----------|------------------------|
| 0 | — | **Infrastruktur**: event dispatcher, specification-interface |
| 1 | Repositories | **Aggregat**: entiteter med beteende + repositories |
| 2 | Test-coverage | **Domain Events**: events + handlers |
| 3 | Value objects | **Specifications + Value Objects** |
| 4 | — | **Renodla routes**: alla sidoeffekter via events |

### Fas 0 — Infrastruktur (grunden som resten bygger på)

Innan vi kan skapa aggregat med events behövs plumbing.

#### 0.1 Aktivera Domain Events i AggregateRoot

Events är kommenterade i `src/domain/shared/base/AggregateRoot.ts`.
Aktivera dem.

**TDD-cykel:**
```
RED:    Skriv test: "AggregateRoot ska samla domain events"
        → aggregate.addDomainEvent(event)
        → expect(aggregate.domainEvents).toContain(event)

GREEN:  Avkommentera event-metoder i AggregateRoot

REFACTOR: Säkerställ att clearDomainEvents() fungerar
```

#### 0.2 Skapa EventDispatcher

```
Skapa: src/infrastructure/events/
├── IDomainEvent.ts           # interface: occurredAt, eventName
├── IEventHandler.ts          # interface: handle(event)
├── IEventDispatcher.ts       # interface: dispatch(event), register(handler)
├── InMemoryEventDispatcher.ts # implementation (synkron, enkel)
└── InMemoryEventDispatcher.test.ts
```

**TDD-cykel:**
```
RED:    Skriv test: "dispatcher ska anropa registrerade handlers"
        → dispatcher.register("BookingCreated", mockHandler)
        → dispatcher.dispatch(new BookingCreatedEvent(...))
        → expect(mockHandler.handle).toHaveBeenCalled()

GREEN:  Implementera InMemoryEventDispatcher med en Map<string, handler[]>

REFACTOR: Lägg till error handling (en handler som kraschar ska inte stoppa andra)
```

#### 0.3 Skapa ISpecification-interface

```
Skapa: src/domain/shared/specification/
├── ISpecification.ts         # interface: isSatisfiedBy(candidate)
└── CompositeSpecification.ts # and(), or(), not() — valfritt
```

Liten fil, ingen TDD nödvändig — det är bara ett interface.

### Fas 1 — Aggregat med beteende

Varje kärndomän får en riktig aggregat-klass. Vi börjar med Booking (bäst testad)
och använder den som mall.

#### 1.1 Booking-aggregat (mall för alla andra)

**Filer:**
```
src/domain/booking/
├── Booking.ts                # Aggregat-rot (NY)
├── BookingStatus.ts          # Value object för status-maskin (NY)
├── events/
│   ├── BookingCreatedEvent.ts
│   ├── BookingConfirmedEvent.ts
│   ├── BookingCancelledEvent.ts
│   └── BookingCompletedEvent.ts
├── BookingService.ts         # Finns, anpassa till aggregat
└── BookingService.test.ts    # Finns, uppdatera
```

**TDD-cykel för Booking-aggregat:**
```
RED:    test("Booking.create ska returnera aggregat med PENDING status")
GREEN:  Implementera Booking.create()

RED:    test("Booking.confirm ska ändra status till CONFIRMED")
GREEN:  Implementera Booking.confirm()

RED:    test("Booking.confirm ska faila om status inte är PENDING")
GREEN:  Lägg till statusvalidering

RED:    test("Booking.confirm ska generera BookingConfirmedEvent")
GREEN:  this.addDomainEvent(new BookingConfirmedEvent(this.id))

RED:    test("Booking.cancel ska faila om status är COMPLETED")
GREEN:  Implementera cancel() med state machine

REFACTOR: Extrahera BookingStatus value object med VALID_TRANSITIONS
```

**BookingStatus value object (state machine):**
```typescript
// Varje status vet vilka övergångar som är giltiga
class BookingStatus extends ValueObject<{ value: string }> {
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    pending:   ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled"],
    completed: [],         // terminal
    cancelled: [],         // terminal
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
    return BookingStatus.create(next)
  }
}
```

#### 1.2 Horse-aggregat + repository

**Filer:**
```
src/domain/horse/
├── Horse.ts                  # Aggregat-rot (NY)
├── HorseNote.ts              # Entitet inom aggregatet (NY)
└── events/
    └── HorseRegisteredEvent.ts

src/infrastructure/persistence/horse/
├── IHorseRepository.ts
├── PrismaHorseRepository.ts
└── MockHorseRepository.ts
```

**Affärsregler att flytta IN i aggregatet:**
- Soft delete: `horse.deactivate()` sätter `isActive = false`
- Note-kategorier: `horse.addNote(category, text)` validerar kategori
- IDOR: repository tar `ownerId` i alla queries

#### 1.3 Review-aggregat + repository + specifications

**Filer:**
```
src/domain/review/
├── Review.ts                 # Aggregat
├── specifications/
│   ├── BookingMustBeCompletedSpec.ts
│   └── OneReviewPerBookingSpec.ts
├── ReviewService.ts
└── ReviewService.test.ts

src/infrastructure/persistence/review/
├── IReviewRepository.ts
├── PrismaReviewRepository.ts
└── MockReviewRepository.ts
```

**TDD-cykel för specifications:**
```
RED:    test("BookingMustBeCompletedSpec returnerar false för pending booking")
GREEN:  Implementera isSatisfiedBy()

RED:    test("OneReviewPerBookingSpec returnerar false om review redan finns")
GREEN:  Implementera med mockRepo

RED:    test("ReviewService.createReview använder båda specs")
GREEN:  Injicera specs i service
```

#### 1.4 GroupBooking-aggregat + repository (refaktorera befintlig service)

**Ändring:** GroupBookingService kör idag Prisma direkt. Refaktorera till:
- `GroupBookingRequest` aggregat med `addParticipant()`, `matchToBookings()`
- `IGroupBookingRepository` interface
- Befintliga affärsregler (invite code, status transitions) flyttas in i aggregatet

#### 1.5 RouteOrder-aggregat + repository + service

**Ny domän.** Komplex logik (customer vs provider flow) motiverar eget aggregat.

### Fas 2 — Domain Events

Nu har aggregaten events. Dags att koppla ihop dem.

#### 2.1 Event handlers för Booking

```
src/infrastructure/events/handlers/
├── SendNotificationOnBookingCreated.ts
├── SendNotificationOnBookingConfirmed.ts
├── SendNotificationOnBookingCancelled.ts
└── LogBookingEvent.ts        # Audit trail
```

**TDD-cykel:**
```
RED:    test("SendNotificationOnBookingCreated skapar notification")
GREEN:  Implementera handler med MockNotificationRepository

RED:    test("handler hanterar fel utan att kasta vidare")
GREEN:  Wrap i try-catch, logga error
```

#### 2.2 Koppla dispatcher i routes

```typescript
// /api/bookings/route.ts — EFTER refaktorering
const result = await bookingService.createBooking(dto)

if (result.isSuccess) {
  const booking = result.value
  // Dispatcha alla events som aggregatet genererat
  await eventDispatcher.dispatchAll(booking.domainEvents)
  booking.clearDomainEvents()
  return NextResponse.json(booking, { status: 201 })
}
```

#### 2.3 Ta bort manuella sidoeffekter

Sök genom alla routes och ta bort:
```typescript
// BORT med dessa:
await notificationService.createAsync(...)
// De ersätts av event handlers
```

### Fas 3 — Specifications + Value Objects

#### 3.1 Value Objects

| Value Object | TDD-test | Implementation |
|-------------|----------|----------------|
| `Rating` | "Rating.create(6) ska returnera error" | Validera 1-5 |
| `Money` | "Money.create(-100) ska returnera error" | Validera > 0, valuta |
| `DateRange` | "DateRange med start > end ska returnera error" | Validera intervall |
| `InviteCode` | "InviteCode.generate() ska inte innehålla O/0/I/L" | Teckenuppsättning |
| `BookingStatus` | "canTransitionTo completed från pending ska vara false" | State machine |

#### 3.2 Specifications för alla domäner

| Specification | Domän | Regel |
|--------------|-------|-------|
| `NoOverlappingBookingsSpec` | Booking | Inga överlappande tider |
| `SufficientTravelTimeSpec` | Booking | Minst 60 min mellan bokningar |
| `BookingMustBeCompletedSpec` | Review | Bara completed bokningar kan reviewas |
| `OneReviewPerBookingSpec` | Review | Max en review per bokning |
| `MaxParticipantsSpec` | GroupBooking | Max antal deltagare |
| `ValidDateRangeSpec` | GroupBooking | Datumintervall max 30 dagar |

### Fas 4 — Renodla routes

Sista fasen: alla routes blir tunna HTTP-adaptrar.

**Före (route med logik):**
```typescript
export async function POST(request: Request) {
  const session = await auth()
  const body = await request.json()
  const validated = schema.parse(body)

  // Affärslogik i route 👎
  const existing = await prisma.review.findFirst({ where: { bookingId } })
  if (existing) return NextResponse.json({ error: "..." }, { status: 409 })
  const booking = await prisma.booking.findFirst({ where: { id: bookingId } })
  if (booking.status !== "completed") return NextResponse.json({...}, { status: 400 })

  const review = await prisma.review.create({ data: validated })
  await notificationService.createAsync(...)
  return NextResponse.json(review)
}
```

**Efter (tunn route):**
```typescript
export async function POST(request: Request) {
  const session = await auth()
  const body = await request.json()
  const validated = schema.parse(body)

  // Delegera allt till domain service 👍
  const result = await reviewService.createReview({
    ...validated,
    customerId: session.user.id,
  })

  if (result.isFailure) {
    return mapErrorToResponse(result.error)
  }

  await eventDispatcher.dispatchAll(result.value.domainEvents)
  return NextResponse.json(result.value, { status: 201 })
}
```

---

## Del 4: Arbetsmetod per domän

### Steg-för-steg (samma för varje domän)

```
Steg 1: Skapa aggregat-klass med TDD
        → Tester för create(), statusövergångar, events
        → Commit: "feat(domain): add Booking aggregate with state machine"

Steg 2: Skapa value objects (om domänen behöver)
        → TDD: validering, edge cases
        → Commit: "feat(domain): add BookingStatus value object"

Steg 3: Skapa events
        → BookingCreatedEvent, BookingConfirmedEvent etc.
        → Commit: "feat(domain): add booking domain events"

Steg 4: Skapa/uppdatera repository interface
        → save(aggregate), findById() etc.
        → Commit: "refactor: update IBookingRepository for aggregate"

Steg 5: Implementera PrismaRepository + MockRepository
        → Mapper: aggregat ↔ Prisma-modell
        → Commit: "refactor: update PrismaBookingRepository for aggregate"

Steg 6: Skapa specifications (om domänen behöver)
        → TDD: isSatisfiedBy() med true/false cases
        → Commit: "feat(domain): add booking specifications"

Steg 7: Uppdatera domain service
        → Använd aggregat + specs istället för rådata
        → Commit: "refactor: update BookingService to use aggregate"

Steg 8: Skapa event handlers
        → TDD: handler anropas med rätt data
        → Commit: "feat: add notification handler for BookingCreatedEvent"

Steg 9: Migrera routes (en per commit)
        → Tunn route → service → aggregat → events
        → Commit: "refactor: migrate POST /api/bookings to strict DDD"

Steg 10: Verifiera
         → npm test -- --run
         → npx playwright test (E2E)
         → Om fail: git bisect
```

---

## Del 5: git bisect i refaktoreringsarbetet

### När ska du använda bisect?

| Situation | Använd bisect? |
|-----------|---------------|
| Test failar efter refaktorering, oklart var | Ja |
| Du vet exakt vilken fil du ändrade | Nej, kolla git diff |
| E2E-test failar sporadiskt (flaky) | Nej, det är timing-problem |
| Bygget går sönder efter många commits | Ja |

### Exempel: refaktorering av Booking till aggregat

```bash
# Du har gjort 10 commits för Booking-aggregat.
# BookingService.test.ts failar. Vilken commit bröt det?

git bisect start
git bisect bad
git bisect good HEAD~10

# Automatisera: kör testet vid varje steg
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts

# Output: "a1b2c3d is the first bad commit"
# Commit: "refactor: update BookingService to use aggregate"
# → Nu vet du exakt var problemet är

git bisect reset
```

### Tips

1. **En commit per logiskt steg** — blanda inte aggregat med events
2. **Tester gröna vid varje commit** — annars ger bisect fel resultat
3. **Beskriv commits tydligt** — du behöver förstå vad committen gjorde
4. **Kör `npm test -- --run` innan varje commit** — billigare att fixa direkt

---

## Del 6: Filstruktur vid strikt DDD

```
src/
├── domain/                          # RENA domänobjekt (inga imports från infrastructure)
│   ├── shared/
│   │   ├── base/
│   │   │   ├── AggregateRoot.ts     # Bas med event-hantering
│   │   │   ├── Entity.ts
│   │   │   └── ValueObject.ts
│   │   ├── types/
│   │   │   ├── Result.ts
│   │   │   └── Guard.ts
│   │   ├── errors/
│   │   │   └── DomainError.ts
│   │   ├── events/
│   │   │   ├── IDomainEvent.ts
│   │   │   └── IEventHandler.ts
│   │   ├── specification/
│   │   │   └── ISpecification.ts
│   │   └── value-objects/
│   │       ├── TimeSlot.ts          # Finns
│   │       ├── Location.ts          # Finns
│   │       ├── Rating.ts            # NY
│   │       ├── Money.ts             # NY
│   │       ├── DateRange.ts         # NY
│   │       └── InviteCode.ts        # NY
│   │
│   ├── booking/
│   │   ├── Booking.ts               # Aggregat-rot (NY)
│   │   ├── BookingStatus.ts         # Value object (NY)
│   │   ├── BookingService.ts        # Finns, uppdatera
│   │   ├── BookingService.test.ts   # Finns, uppdatera
│   │   ├── events/                  # NY
│   │   │   ├── BookingCreatedEvent.ts
│   │   │   ├── BookingConfirmedEvent.ts
│   │   │   ├── BookingCancelledEvent.ts
│   │   │   └── BookingCompletedEvent.ts
│   │   └── specifications/          # NY
│   │       ├── NoOverlappingBookingsSpec.ts
│   │       └── SufficientTravelTimeSpec.ts
│   │
│   ├── horse/                       # NY
│   │   ├── Horse.ts
│   │   ├── HorseNote.ts
│   │   └── events/
│   │       └── HorseRegisteredEvent.ts
│   │
│   ├── review/                      # NY
│   │   ├── Review.ts
│   │   ├── ReviewService.ts
│   │   ├── ReviewService.test.ts
│   │   └── specifications/
│   │       ├── BookingMustBeCompletedSpec.ts
│   │       └── OneReviewPerBookingSpec.ts
│   │
│   ├── group-booking/
│   │   ├── GroupBookingRequest.ts    # NY aggregat
│   │   ├── GroupBookingService.ts    # Finns, refaktorera
│   │   └── events/
│   │       └── GroupBookingMatchedEvent.ts
│   │
│   └── route-order/                 # NY
│       ├── RouteOrder.ts
│       ├── RouteOrderService.ts
│       └── events/
│           └── RouteOrderCreatedEvent.ts
│
├── infrastructure/
│   ├── persistence/
│   │   ├── booking/
│   │   │   ├── IBookingRepository.ts    # Finns, uppdatera för aggregat
│   │   │   ├── PrismaBookingRepository.ts
│   │   │   ├── MockBookingRepository.ts
│   │   │   └── BookingMapper.ts         # Finns, uppdatera
│   │   ├── horse/                       # NY
│   │   │   ├── IHorseRepository.ts
│   │   │   ├── PrismaHorseRepository.ts
│   │   │   └── MockHorseRepository.ts
│   │   ├── review/                      # NY
│   │   │   ├── IReviewRepository.ts
│   │   │   ├── PrismaReviewRepository.ts
│   │   │   └── MockReviewRepository.ts
│   │   ├── group-booking/               # NY
│   │   │   ├── IGroupBookingRepository.ts
│   │   │   ├── PrismaGroupBookingRepository.ts
│   │   │   └── MockGroupBookingRepository.ts
│   │   ├── route-order/                 # NY
│   │   │   ├── IRouteOrderRepository.ts
│   │   │   ├── PrismaRouteOrderRepository.ts
│   │   │   └── MockRouteOrderRepository.ts
│   │   └── notification/                # NY
│   │       ├── INotificationRepository.ts
│   │       ├── PrismaNotificationRepository.ts
│   │       └── MockNotificationRepository.ts
│   │
│   └── events/                          # NY
│       ├── IEventDispatcher.ts
│       ├── InMemoryEventDispatcher.ts
│       ├── InMemoryEventDispatcher.test.ts
│       └── handlers/
│           ├── SendNotificationOnBookingCreated.ts
│           ├── SendNotificationOnBookingConfirmed.ts
│           ├── SendNotificationOnBookingCancelled.ts
│           └── LogDomainEvent.ts
│
└── app/api/                             # Tunna routes (ingen affärslogik)
    └── ...
```

---

## Del 7: Checklista per domän

Kopiera denna för varje domän du refaktorerar:

```markdown
## [Domännamn] — Strikt DDD-refaktorering

### Förberedelse
- [ ] Läs igenom alla routes för domänen
- [ ] Identifiera affärsregler (vad som INTE är CRUD)
- [ ] Identifiera status-övergångar (state machine?)
- [ ] Identifiera sidoeffekter (notiser, loggar etc.)
- [ ] Kolla att alla befintliga tester är gröna

### Aggregat
- [ ] TDD: Skapa aggregat-klass som ärver AggregateRoot
- [ ] TDD: Implementera factory method (static create)
- [ ] TDD: Implementera beteende-metoder (confirm, cancel etc.)
- [ ] TDD: Verifiera att rätt domain events genereras
- [ ] Skapa value objects om domänen behöver (Rating, DateRange etc.)

### Repository
- [ ] Skapa IXxxRepository interface (save, findById etc.)
- [ ] Implementera PrismaXxxRepository med mapper
- [ ] Implementera MockXxxRepository

### Specifications (om affärsregler finns)
- [ ] TDD: Skapa specs med isSatisfiedBy()
- [ ] Injicera specs i domain service

### Domain Service
- [ ] TDD: Uppdatera/skapa service att använda aggregat + specs
- [ ] Verifiera Result<T, Error> returtyp

### Events
- [ ] Skapa event-klasser
- [ ] TDD: Skapa handlers
- [ ] Registrera handlers i dispatcher

### Routes
- [ ] Migrera route 1 → commit → tester gröna
- [ ] Migrera route 2 → commit → tester gröna
- [ ] ... (en route per commit)
- [ ] Ta bort manuella sidoeffekter (ersatta av events)

### Verifiering
- [ ] Alla unit-tester gröna: npm test -- --run
- [ ] E2E-tester gröna (om de finns)
- [ ] Inga Prisma-direktanrop kvar i routes
- [ ] Inga manuella notis-anrop kvar i routes
- [ ] git log --oneline visar atomära commits
```

---

## Del 8: Prioritetsordning

Rekommenderad ordning att ta sig an domänerna:

| Prio | Domän | Motivering |
|------|-------|-----------|
| 0 | **Infrastruktur** (EventDispatcher, ISpecification) | Allt annat beror på detta |
| 1 | **Booking** (aggregat + events) | Mest mogen, bäst testad, blir mallen |
| 2 | **Review** (aggregat + specs + repo) | Tydliga affärsregler att flytta |
| 3 | **Horse** (aggregat + repo) | Enkel, bra övning |
| 4 | **GroupBooking** (refaktorera service + repo) | Befintlig service behöver fixas |
| 5 | **RouteOrder** (aggregat + service + repo) | Mest komplex, sist |
| 6 | **Notification** (repo, flytta Prisma) | Stöddomän, lägst prio |

---

## Ordlista

| Term | Förklaring |
|------|-----------|
| **Aggregat** | Grupp relaterade objekt med en rot. All åtkomst via roten. Konsistensgräns. |
| **Aggregat-rot** | Ingångspunkten till ett aggregat. Enda objektet som repositories hanterar. |
| **Bounded Context** | Explicit gräns runt en del av domänen. Termer har specifik betydelse inom gränsen. |
| **Domain Event** | Beskriver något som hänt i domänen. Genereras av aggregat, hanteras av handlers. |
| **Event Dispatcher** | Tar emot events och skickar dem till registrerade handlers. |
| **Event Handler** | Reagerar på ett specifikt event (skicka notis, logga, skapa faktura). |
| **Specification** | Kapslar in en affärsregel: "uppfyller X detta krav?" Återanvändbar. |
| **State Machine** | Definierar giltiga tillståndsövergångar (pending → confirmed → completed). |
| **Repository** | Abstraktionslager mellan domän och databas. Interface + implementation. |
| **Domain Service** | Koordinerar mellan aggregat. Vet inget om HTTP. |
| **Value Object** | Litet objekt som validerar sig vid skapande. Immutable. Ingen identitet. |
| **Result<T, E>** | Returtyp som tvingar hantering av success och error. Bättre än throw. |
| **Mapper** | Konverterar mellan domänobjekt och persistensmodell. |
| **Factory** | Skapar komplexa aggregat. Validerar vid skapande. |
| **IDOR** | Insecure Direct Object Reference — tillgång till andras data via ID. |
| **Bisect** | Git-kommando: binärsöker commits för att hitta var en bugg introducerades. |
| **TDD** | Test-Driven Development. Test först → implementera → refaktorera. |

---

*Skapat: 2026-02-01*
*Nivå: Strikt DDD*
*Använd som input till Claude Code: "Läs docs/DDD-TDD-REFACTORING-PLAN.md och börja med Fas 0.1"*
