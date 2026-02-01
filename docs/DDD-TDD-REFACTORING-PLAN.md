# DDD & TDD Refaktoreringsplan

> Lärande-dokument + handlingsplan. Syftet är att teamet ska förstå *varför* och *hur*
> vi gör kodbasen mer domändriven och testdriven.

---

## Del 1: Koncept (lär dig innan du kodar)

### Vad är DDD-Light?

Domain-Driven Design handlar om att **organisera kod efter affärsdomänen**, inte efter
tekniska lager. "Light" betyder att vi tar de delar som ger mest värde utan att
införa hela DDD-apparaten (bounded contexts, aggregates, CQRS etc).

Vi använder fyra byggstenar:

```
┌─────────────────────────────────────────────────┐
│  Route (HTTP-lager)                             │
│  - Tar emot request, validerar med Zod          │
│  - Delegerar till service                       │
│  - Mappar resultat till HTTP-svar               │
│  - Innehåller INGEN affärslogik                 │
└──────────────────┬──────────────────────────────┘
                   │ anropar
┌──────────────────▼──────────────────────────────┐
│  Domain Service (affärslogik)                   │
│  - Koordinerar mellan repositories              │
│  - Innehåller affärsregler                      │
│  - Returnerar Result<T, Error> (aldrig throw)   │
│  - Vet INGET om HTTP, Prisma eller databas      │
└──────────────────┬──────────────────────────────┘
                   │ anropar
┌──────────────────▼──────────────────────────────┐
│  Repository (interface)                         │
│  - Definierar VAD vi behöver från persistens    │
│  - Implementeras av PrismaXxxRepository (prod)  │
│  - Implementeras av MockXxxRepository (test)    │
│  - Gör det möjligt att byta databas utan att    │
│    röra affärslogik                             │
└──────────────────┬──────────────────────────────┘
                   │ anropar
┌──────────────────▼──────────────────────────────┐
│  Value Object (validering vid skapande)         │
│  - Liten klass/funktion som garanterar giltigt  │
│    värde: TimeSlot, Rating, Money               │
│  - Om du kan skapa den = den är giltig          │
│  - Immutable (ändras aldrig efter skapande)     │
└─────────────────────────────────────────────────┘
```

### Varför repository-pattern?

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

**Tumregel**: Om domänen har affärsregler → repository. Om det bara är enkel CRUD
utan regler → Prisma direkt är OK.

### Vad är TDD-cykeln?

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

### Vad är git bisect?

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
# Git kör kommandot automatiskt vid varje steg
git bisect start HEAD abc1234
git bisect run npm test -- --run src/domain/booking/BookingService.test.ts
```

**Varför detta är relevant för DDD-refaktorering:**

Under refaktorering gör vi många små commits:
1. Lägg till `IHorseRepository` interface
2. Implementera `PrismaHorseRepository`
3. Implementera `MockHorseRepository`
4. Skapa `HorseService` med tester
5. Migrera `/api/horses/route.ts` att använda service
6. Migrera `/api/horses/[id]/route.ts`
7. Ta bort gammal Prisma-direktanrop

Om steg 6 råkar bryta ett E2E-test hittar `git bisect` det på sekunder.

**Tumregel för refaktorering**: en commit per logiskt steg, testerna gröna vid varje commit.
Då kan bisect alltid hitta var det gick fel.

---

## Del 2: Nulägesanalys

### Vad vi har idag

| Domän | Routes | Repository | Service | Tester | Status |
|-------|--------|------------|---------|--------|--------|
| **Booking** | 2 | IBookingRepository | BookingService | 100% | Mallen |
| **Provider** | 2 | IProviderRepository | - | 100% | Bra |
| **Service** | 2 | IServiceRepository | - | 100% | Bra |
| **Horse** | 5 | Saknas | Saknas | Prisma-mock | Behöver repo |
| **GroupBooking** | 6 | Saknas | Finns, men kör Prisma direkt | Fragila | Behöver repo |
| **Review** | 3 | Saknas | Saknas | Prisma-mock | Behöver repo + service |
| **RouteOrder** | 6 | Saknas | Saknas | Prisma-mock | Behöver repo + service |
| **Availability** | 3 | Saknas | Saknas | Prisma-mock | Låg prio |

### Var affärslogik ligger idag (problem)

Affärsregler ska bo i domain services, inte i route-filer. Idag finns regler på fel plats:

| Regel | Bor idag | Borde bo |
|-------|----------|----------|
| "Booking must be completed before review" | `/api/reviews/route.ts` | `ReviewService` |
| "One review per booking" | `/api/reviews/route.ts` | `ReviewService` |
| "Max participants in group booking" | `/api/group-bookings/route.ts` | `GroupBookingService` |
| "Date range max 30 days" | `/api/group-bookings/route.ts` | Value object `DateRange` |
| "Customer vs provider flow" | `/api/route-orders/route.ts` | `RouteOrderService` |

### Saknade value objects

| Value Object | Validerar | Exempel |
|-------------|-----------|---------|
| `Rating` | Heltal 1-5 | `Rating.create(3)` → OK, `Rating.create(6)` → Error |
| `Money` | Belopp > 0 | `Money.create(500, "SEK")` |
| `DateRange` | start < end, max span | `DateRange.create("2026-02-01", "2026-02-15")` |
| `InviteCode` | Rätt teckenuppsättning | `InviteCode.generate()` |

---

## Del 3: Handlingsplan

### Arbetsmetod per domän

Varje domän refaktoreras med samma mönster. Här är stegen för **Horse** som exempel:

```
Steg 1: Skapa interface (IHorseRepository)
        → Commit: "refactor: add IHorseRepository interface"
        → Tester: inga ändringar, allt grönt

Steg 2: Implementera PrismaHorseRepository
        → Flytta Prisma-anrop från routes hit
        → Commit: "refactor: add PrismaHorseRepository"
        → Tester: inga ändringar, allt grönt

Steg 3: Implementera MockHorseRepository
        → Commit: "test: add MockHorseRepository"
        → Tester: inga ändringar, allt grönt

Steg 4: (Valfritt) Skapa HorseService om affärsregler finns
        → TDD: skriv test FÖRST
        → Commit: "feat: add HorseService with validation rules"
        → Tester: nya tester gröna

Steg 5: Migrera routes en i taget
        → Byt från prisma.horse.xxx till repository/service
        → Uppdatera route-tester till MockRepository
        → Commit per route: "refactor: migrate /api/horses to repository"
        → Tester: gröna vid varje commit

Steg 6: Verifiera
        → Kör alla tester: npm test -- --run
        → Kör E2E om det finns: npx playwright test
        → Om något failar: git bisect för att hitta var
```

### Fas 1 — Snabba vinster (standardisera kärndomäner)

**Prioritetsordning baserad på komplexitet och påverkan:**

#### 1.1 HorseRepository

- **Varför först**: Enkel CRUD, 5 routes, bra för att öva mönstret
- **Affärsregler att flytta**: IDOR-skydd (ownerId i WHERE), soft delete (isActive)
- **Filer att skapa**:
  ```
  src/infrastructure/persistence/horse/IHorseRepository.ts
  src/infrastructure/persistence/horse/PrismaHorseRepository.ts
  src/infrastructure/persistence/horse/MockHorseRepository.ts
  ```
- **Filer att migrera**:
  ```
  src/app/api/horses/route.ts
  src/app/api/horses/[id]/route.ts
  src/app/api/horses/[id]/notes/route.ts
  src/app/api/horses/[id]/notes/[noteId]/route.ts
  src/app/api/horses/[horseId]/passport/route.ts
  ```

#### 1.2 GroupBookingRepository + refaktorera GroupBookingService

- **Varför**: Service finns redan men kör Prisma direkt — inkonsekvent
- **Affärsregler att behålla i service**: sekventiell tidsberäkning, invite code, status transitions
- **Ändring**: GroupBookingService tar `IGroupBookingRepository` i constructor istället för `prisma`

#### 1.3 ReviewRepository + ReviewService (ny)

- **Varför**: Affärslogik ("one review per booking") ligger i route
- **Ny service**:
  ```typescript
  class ReviewService {
    async createReview(dto): Promise<Result<Review, ReviewError>> {
      // 1. Hämta booking via bookingRepo
      // 2. Kontrollera att booking är "completed"
      // 3. Kontrollera att ingen review redan finns
      // 4. Skapa review via reviewRepo
    }
  }
  ```

### Fas 2 — Test-coverage

| Område | Nuläge | Mål | Åtgärd |
|--------|--------|-----|--------|
| API-routes | 44/67 (66%) | 54/67 (80%) | Testa auth, payment, profile |
| Lib utilities | 8/24 (33%) | 22/24 (90%) | Testa rate-limit, auth-server, logger |
| Domain services | 7/7 (100%) | Behåll | - |
| Value objects | 2/2 (100%) | Behåll | - |

**Prioritera dessa otestade filer** (säkerhetskritiska):
1. `src/lib/rate-limit.ts`
2. `src/lib/auth-server.ts`
3. `src/lib/encryption.ts`
4. `src/app/api/auth/*/route.ts`

### Fas 3 — Value objects och polish

1. Skapa `Rating`, `Money`, `DateRange` value objects
2. Använd dem i services och routes
3. Överväg domain events (infrastrukturen finns redan i `AggregateRoot`)

---

## Del 4: git bisect i praktiken

### När ska du använda bisect?

| Situation | Använd bisect? |
|-----------|---------------|
| Test failar efter refaktorering, oklart var | Ja |
| Du vet exakt vilken fil du ändrade | Nej, kolla git diff |
| E2E-test failar sporadiskt (flaky) | Nej, det är timing-problem |
| Bygget går sönder efter 20 commits | Ja |

### Komplett exempel: refaktorering av Horse-routes

```bash
# Du har gjort 7 commits för Horse-refaktorering.
# E2E-testet för hästar failar. Vilken commit bröt det?

# Starta bisect
git bisect start

# Nuvarande commit är dålig
git bisect bad

# Committen FÖRE refaktoreringen fungerade
git bisect good HEAD~7

# Automatisera: kör E2E-testet vid varje steg
git bisect run npx playwright test tests/horses.spec.ts

# Output:
# "a1b2c3d is the first bad commit"
# Commit message: "refactor: migrate /api/horses/[id] to repository"
# → Nu vet du exakt var problemet är

# Städa upp
git bisect reset
```

### Tips för att bisect ska fungera

1. **En commit per logiskt steg** — blanda inte route-migrering med ny feature
2. **Tester gröna vid varje commit** — annars ger bisect fel resultat
3. **Beskriv commits tydligt** — du behöver förstå vad committen gjorde
4. **Kör `npm test` innan varje commit** — billigare att fixa direkt

---

## Del 5: Checklista per domän

Kopiera denna för varje domän du refaktorerar:

```markdown
## [Domännamn] — DDD-refaktorering

### Förberedelse
- [ ] Läs igenom alla routes för domänen
- [ ] Identifiera affärsregler (vad som INTE är CRUD)
- [ ] Bestäm: behövs service eller räcker repository?
- [ ] Kolla att alla befintliga tester är gröna

### Implementation
- [ ] Skapa IXxxRepository interface
- [ ] Implementera PrismaXxxRepository
- [ ] Implementera MockXxxRepository
- [ ] (Om service behövs) TDD: skriv test → implementera service
- [ ] Migrera route 1 → commit → tester gröna
- [ ] Migrera route 2 → commit → tester gröna
- [ ] ... (en route per commit)

### Verifiering
- [ ] Alla unit-tester gröna: `npm test -- --run`
- [ ] E2E-tester gröna (om de finns för domänen)
- [ ] Inga Prisma-direktanrop kvar i routes för denna domän
- [ ] Kör `git log --oneline` — varje commit är atomär och beskriven
```

---

## Ordlista

| Term | Förklaring |
|------|-----------|
| **Repository** | Abstraktionslager mellan affärslogik och databas. Interface + implementation. |
| **Domain Service** | Klass med affärsregler som koordinerar repositories. Vet inget om HTTP. |
| **Value Object** | Litet objekt som validerar sig själv vid skapande. Immutable. |
| **Result<T, E>** | Returtyp som tvingar anroparen att hantera både success och error. Bättre än throw. |
| **IDOR** | Insecure Direct Object Reference — när en användare kan komma åt andras data via ID. |
| **Bisect** | Git-kommando som binärsöker genom commits för att hitta var en bugg introducerades. |
| **Behavior-based test** | Test som verifierar *vad* koden gör (HTTP 200, rätt data) istället för *hur* (vilka SQL-queries). |
| **Mock repository** | In-memory implementation av repository-interface, används i tester istället för riktig databas. |
| **Atomär commit** | En commit som gör exakt EN sak och lämnar koden i fungerande tillstånd. |
| **TDD** | Test-Driven Development. Skriv test först → implementera → refaktorera. |

---

*Skapat: 2026-02-01*
*Använd som input till Claude Code: "Läs docs/DDD-TDD-REFACTORING-PLAN.md och börja med Fas 1.1"*
