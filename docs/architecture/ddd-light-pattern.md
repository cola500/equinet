---
title: "DDD-Light Pattern (Equinet)"
description: "Equinets befintliga 4-lagermönster: API route → Domain service → Repository → Prisma. När det används, när det är overkill, och referensexempel."
category: architecture
status: active
last_updated: 2026-05-06
tags: [architecture, ddd, repository-pattern, domain-service, prisma]
related:
  - domain-boundaries-discovery.md
  - service-without-repo-audit.md
  - ../../.claude/rules/code-map.md
sections:
  - Översikt
  - Lager och ansvar
  - När använda repository-pattern
  - När direkt Prisma i route är OK
  - När repository är overkill
  - Referensexempel - Booking
  - Checklista för ny domän
  - Checklista för att lyfta en domän till repo-pattern
  - Anti-patterns att undvika
---

# DDD-Light Pattern (Equinet)

> Detta dokument formaliserar mönstret som redan används i kodbasen. Inga ändringar i koden krävs — det är dokumentation av befintlig praxis. För varför detta är rätt nivå nu, se [domain-boundaries-discovery.md](domain-boundaries-discovery.md).

---

## Översikt

Equinet använder **DDD-Light** — en pragmatisk fyralager-arkitektur som tar de viktigaste idéerna från Domain-Driven Design utan att kräva formell terminologi (Aggregate Root, Bounded Context, etc.). Värdet är konkret: testbarhet, schema-isolering, kontrakt mellan API och DB-lagret.

```
┌────────────────────────────────────────────────┐
│ 1. API Route          src/app/api/.../route.ts │
│    auth → rate limit → Zod → service-anrop     │
└────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────┐
│ 2. Domain Service     src/domain/<name>/*.ts   │
│    business logic → repository-anrop           │
└────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────┐
│ 3. Repository         src/infrastructure/      │
│    IRepository + Mock + Prisma                 │
└────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────┐
│ 4. Prisma             src/lib/prisma.ts        │
└────────────────────────────────────────────────┘
```

Inte alla domäner behöver alla fyra lager. Sektion "När direkt Prisma i route är OK" och "När repository är overkill" beskriver undantagen.

---

## Lager och ansvar

### 1. API Route

**Ansvarar för:**
- Autentisering (`auth()` från `auth-server.ts`)
- Rate limiting (efter auth, före JSON-parsing)
- Input-validering (Zod med `.strict()`)
- HTTP-mappning (status codes, error responses på svenska)
- Anrop till en (1) domain service eller direkt Prisma för enkel CRUD

**Ansvarar INTE för:**
- Business logic (= service)
- Direkta Prisma-queries om service finns
- Cross-domain-orkestrering (= service-funktion gör det)

**Filplats:** `src/app/api/<resource>/route.ts`

**Exempel-struktur:**

```typescript
export async function POST(request: Request) {
  // 1. Auth
  const session = await auth() // throws 401

  // 2. Rate limit
  const allowed = await rateLimiters.booking(getClientIP(request))
  if (!allowed) return NextResponse.json({ error: "..." }, { status: 429 })

  // 3. Parse + validate
  let body
  try { body = await request.json() } catch { return ... }
  const validated = bookingSchema.strict().parse(body)

  // 4. Delegate to service
  const service = createBookingService()
  const result = await service.create({
    ...validated,
    customerId: session.user.id, // ALDRIG från body
  })

  // 5. HTTP-mappning
  if (result.isFailure) {
    return NextResponse.json(
      { error: result.error.message },
      { status: mapBookingErrorToStatus(result.error) }
    )
  }
  return NextResponse.json(result.value)
}
```

### 2. Domain Service

**Ansvarar för:**
- Business rules (validering bortom Zod, status-övergångar, beräkningar)
- Cross-aggregate orkestrering (skapa Booking + skicka Notification)
- Domain events (publicerad via fire-and-forget eller `BookingEventHandlers`)
- Felhantering med domain-specifika error-typer (mappas av `mapXErrorToStatus`)
- Återanvändbar logik som flera routes/cron/scripts behöver

**Ansvarar INTE för:**
- HTTP-detaljer (status codes, JSON-formatering — det är route)
- Direct Prisma-queries (= repository)

**Filplats:** `src/domain/<name>/<NameService>.ts`

**Beroenden via dependency injection:** Service tar repository som constructor-arg så att tester kan injicera `MockRepository`. Factory-pattern (`createXService()`) används vid 3+ dependencies för att hålla call-sites tunna.

### 3. Repository

**Ansvarar för:**
- Definiera kontrakt (`IXRepository` interface) över DB-operations som domänen behöver
- Mock-implementation för tester (`MockXRepository`)
- Prisma-implementation för runtime (`PrismaXRepository`)
- Mapping mellan Prisma-typer och domain-typer (frikoppling från schema-detaljer)

**Ansvarar INTE för:**
- Business logic (= service)
- HTTP-detaljer (= route)

**Filplats:** `src/infrastructure/persistence/<name>/`

Tre filer per domän:
- `IXRepository.ts` — interface (kontraktet)
- `MockXRepository.ts` — in-memory implementation (tester)
- `PrismaXRepository.ts` — Prisma-implementation (runtime)

Plus optional: `XMapper.ts` för komplex mapping.

### 4. Prisma

**Ansvarar för:**
- Schema-definition (`prisma/schema.prisma`)
- Type-säker query-API (`PrismaClient`)
- Migrations (`prisma migrate`)

**Ansvarar INTE för:**
- Business logic
- Validering bortom schema-typer

Inkapslat **bara av repositories** för kärndomäner. Stöddomäner kan importera Prisma direkt i routes (se nedan).

---

## När använda repository-pattern

Använd 4-lagerflödet (Route → Service → Repository → Prisma) när minst **två** av dessa kriterier är sanna:

1. **Domänen har komplex business logic** — status-maskin, validering bortom field-format, derived state
2. **Flera routes behöver samma queries** — duplicerade `select`-block är kostsamma att underhålla
3. **Schema-ändringar är frekventa** — new fields, new relations, new constraints
4. **Tester behöver isolation från DB** — integration-tester kan vara långsamma; service-unit-tester med mock är snabba

**Domäner i Equinet som matchar:** Booking, Provider, Service, Horse, CustomerReview, Follow, Subscription, Stable, Group-booking, Auth, Municipality-watch, Provider-customer-note, Review.

(Listan finns i `.claude/rules/code-map.md` under "kärndomäner".)

---

## När direkt Prisma i route är OK

Det är OK att importera `prisma` direkt i en route när **alla** dessa är sanna:

1. **Endast en route använder queryn** — ingen duplicering, inget kontrakt att skydda
2. **CRUD-tunn** — operation handlar om data, inte business logic
3. **Inga komplexa relationer** — inget cross-aggregate ansvar
4. **Schema är stabilt** — sällan ändringar förväntade

**Exempel som matchar:**
- AvailabilityException, AvailabilitySchedule (CRUD med få fält)
- FeatureFlag (admin-tooling, simpel toggle)
- AdminAuditLog (append-only)
- Små admin-endpoints som listar/raderar
- Health-check-endpoints

**Tumregel:** Om du börjar copy-paste:a `select`-block till en andra route — lyft till repository.

---

## När repository är overkill

Repository är **bara wrapping** (= overkill) när:

1. Repon har 1:1-mappning mellan metod och Prisma-anrop utan business value-add
2. Domänen är ren data-access utan logic (FeatureFlag, Settings)
3. Det bara finns en konsument och den är trivial

I dessa fall: använd Prisma direkt. Lägg INTE till repo "för säkerhets skull". Det är dead code.

**Exempel:** Tidigare versioner av FeatureFlag hade en repository som bara wrapade Prisma 1:1. Den togs bort. Idag är `prisma.featureFlag` direkt-anropad i `src/lib/feature-flags.ts`.

---

## Referensexempel — Booking

Booking är den mest mogna DDD-Light-domänen i Equinet och är referensen för nya kärndomäner.

### Filstruktur

```
src/domain/booking/
├── BookingService.ts                # Huvudservice - all business logic
├── BookingValidation.ts             # Validation-helpers (status-övergångar, dubbelbokning)
├── BookingStatus.ts                 # Value Object - giltiga status + övergångar
├── BookingEvents.ts                 # Domain events (BookingCreated, BookingConfirmed, etc.)
├── BookingEventHandlers.ts          # Event handlers (notify, log, sync calendar)
├── BookingSeriesService.ts          # Sub-service för återkommande bokningar
├── TravelTimeService.ts             # Sub-service för restid-beräkning
├── mapBookingErrorToStatus.ts       # Domain error → HTTP status
├── createBookingService.ts          # Factory (DI för 5+ dependencies)
└── index.ts                         # Public exports

src/infrastructure/persistence/booking/
├── IBookingRepository.ts            # Interface
├── MockBookingRepository.ts         # In-memory för tester
├── PrismaBookingRepository.ts       # Prisma runtime
├── BookingMapper.ts                 # Prisma row → domain object
└── index.ts                         # Public exports

src/app/api/bookings/
├── route.ts                         # POST (skapa), GET (lista)
├── [id]/route.ts                    # GET, PATCH, DELETE per booking
├── [id]/payment/route.ts            # POST betalning
├── [id]/reschedule/route.ts         # POST omboknng
├── [id]/receipt/route.ts            # GET kvitto
└── manual/route.ts                  # POST manuell bokning från provider
```

### Mönster att replikera

| Mönster | Var i Booking |
|---------|---------------|
| Value Object | `BookingStatus.ts` (giltiga status + övergångar) |
| Domain Events | `BookingEvents.ts` + `BookingEventHandlers.ts` |
| Error mapper per domän | `mapBookingErrorToStatus.ts` |
| Factory vid 3+ dependencies | `createBookingService.ts` |
| Atomic operations | `BookingService.create()` använder `prisma.$transaction` via repo för dubbelbokningsskydd |
| Ownership-guard | `findByIdForProvider()` / `findByIdForCustomer()` i repo (atomisk WHERE) |

---

## Checklista för ny domän

När du startar en ny domän, ställ dessa frågor:

- [ ] Är detta en **kärndomän**? Se kriterier i "När använda repository-pattern" ovan.
- [ ] Om JA: skapa `IXRepository`, `MockXRepository`, `PrismaXRepository` (kopiera Review eller Booking)
- [ ] Om JA: skapa `XService.ts` med konstruktor som tar repo
- [ ] Om JA: skapa `mapXErrorToStatus.ts`
- [ ] Om JA: skapa `createXService.ts` factory om 3+ dependencies
- [ ] Om NEJ (CRUD-tunn): skriv direkt route med Prisma — inget extra lager
- [ ] **RLS-policy** för nya tabeller (kärndomäner = obligatorisk RLS-migration)
- [ ] **RLS-bevistest** i `src/__tests__/rls/` (kärndomäner)
- [ ] Service-tester med MockRepo
- [ ] Integration-tester på route-nivå
- [ ] Lägg till domänen i `.claude/rules/code-map.md`

---

## Checklista för att lyfta en domän till repo-pattern

När du upptäcker att en service-only-domän har vuxit:

**Triggers:**
- 5+ routes anropar samma Prisma-queries direkt i samma domän
- Schema-ändring tvingar manuell uppdatering av `select`-block i 3+ routes
- Test-mockning av Prisma duplicerats över flera test-filer
- Service-funktioner blir tunga på data-access vs business logic

**Steg:**

1. **Skapa interface** `src/infrastructure/persistence/<name>/IXRepository.ts` baserat på faktiska Prisma-anrop som idag är spridda
2. **Skapa Mock** `MockXRepository.ts` — implementera in-memory varianter
3. **Skapa Prisma-implementation** `PrismaXRepository.ts` — flytta Prisma-anrop från routes/services hit
4. **Uppdatera service** att ta repo som constructor-arg
5. **Uppdatera factory** (eller skapa) för DI
6. **Refactor routes** att gå via service istället för direct Prisma
7. **Lägg till domänen i `code-map.md` "kärndomäner"-listan**
8. **Lägg till RLS-bevistest** om RLS aktiv på tabellen
9. **Mät:** kör `npm run test:run` — test-tid borde inte öka markant; service-unit-tester ersätter integration-överlappet

**Är det värt det?** Inte alltid. Före refactor: kör `service-without-repo-audit.md`-checklistan för domänen. Om den fortfarande passar "OK utan repo" → vänta.

---

## Anti-patterns att undvika

### 1. 1:1-wrapper repository

Repository som bara har en metod per Prisma-anrop, utan business value:

```typescript
// ❌ Anti-pattern
class BookingRepository {
  async findById(id: string) { return prisma.booking.findUnique({ where: { id } }) }
  async create(data: any) { return prisma.booking.create({ data }) }
  // ... 1:1 med Prisma
}
```

**Värdet är noll.** Använd Prisma direkt eller bygg ett kontrakt med affärsmening.

### 2. Repository som läcker Prisma-typer

```typescript
// ❌ Anti-pattern
async findByIdForProvider(id: string): Promise<Prisma.BookingGetPayload<{ include: ... }>> {
  // ...
}
```

Typen är låst till Prisma — då finns ingen abstraktion. Använd domain-types istället:

```typescript
// ✅ Bra
async findByIdForProvider(id: string, providerId: string): Promise<Booking | null> {
  // ...
}
```

### 3. Service som direkt importerar Prisma

```typescript
// ❌ Anti-pattern
import { prisma } from "@/lib/prisma"
class BookingService {
  async create(...) {
    return prisma.booking.create(...)  // Direkt Prisma i service
  }
}
```

Då är repon en illusion. Service ska bara prata med repo.

### 4. Routes som kringgår service

```typescript
// ❌ Anti-pattern - i kärndomän
export async function POST(...) {
  // Hoppar service, går direkt till Prisma
  const booking = await prisma.booking.create(...)
}
```

I kärndomäner: alltid via service. Direct Prisma är bara OK för stöddomäner enligt sektion "När direkt Prisma i route är OK".

### 5. Repository "för säkerhets skull"

Att lägga till repo för en CRUD-domän som inte växer. Det blir döda kodvägar och underhålls-overhead. Om Service+Repo aldrig hade två konsumenter eller komplex logik — ta bort.

---

## Sammanfattning

| Domän-typ | Lager-flöde | Bestämmas via |
|-----------|------------|---------------|
| Kärndomän (komplex business) | Route → Service → Repo → Prisma | "När använda repository-pattern" |
| Stöddomän (CRUD-tunn) | Route → Prisma | "När direkt Prisma i route är OK" |
| Pure data (FeatureFlag, etc.) | Route → Prisma direkt | "När repository är overkill" |
| Cross-aggregate orchestration | Service som anropar andra services | Booking + Notification + Payment |

Vid tvekan: **börja enkelt med direct Prisma**. Lyft till repo-pattern när triggers fyrar (se checklista ovan). Det är billigare än att börja med över-arkitektur.
