# Kvarvarande refaktorering för DDD-Light compliance

> Senast uppdaterad: 2026-01-28

## Bakgrund

Vi har refaktorerat API routes för kärndomänerna (Booking, Service, Provider) att använda repository pattern med auth-aware metoder. Detta dokument beskriver kvarvarande arbete.

### Genomfört

| Route | Status |
|-------|--------|
| `/api/bookings/[id]` | ✅ Använder `PrismaBookingRepository` |
| `/api/services/[id]` | ✅ Använder `ServiceRepository` |
| `/api/providers/[id]` | ✅ Använder `ProviderRepository` |

---

## 1. BookingService - Extrahera affärslogik (Prioritet 1)

### Nuvarande situation

Affärslogik ligger direkt i `/api/bookings/route.ts` (POST-metoden, rad 51-337).

### Vad som bör flyttas

```
src/domain/booking/BookingService.ts
```

**Logik att extrahera:**

1. **validateBookingTimes()** (rad 51-79)
   - Min 15 minuter, max 8 timmar
   - Business hours 08:00-18:00
   - Sluttid efter starttid

2. **Overlap-detection** (rad 264-337)
   - Transaction med Serializable isolation level
   - Kontrollerar dubbelbokningar för provider + datum + tid

3. **Service/Provider-validering** (rad 201-244)
   - Verifiera att service är aktiv
   - Verifiera att provider är aktiv
   - Förhindra self-booking

### Förslag på interface

```typescript
// src/domain/booking/BookingService.ts

interface IBookingService {
  createBooking(
    dto: CreateBookingDTO,
    customerId: string
  ): Promise<Result<Booking, BookingError>>
}

type BookingError =
  | { type: 'INVALID_TIMES'; message: string }
  | { type: 'OVERLAP'; message: string }
  | { type: 'INACTIVE_SERVICE' }
  | { type: 'INACTIVE_PROVIDER' }
  | { type: 'SELF_BOOKING' }
  | { type: 'INVALID_ROUTE_ORDER'; message: string }

interface CreateBookingDTO {
  providerId: string
  serviceId: string
  bookingDate: string
  startTime: string
  endTime?: string  // Beräknas från service duration om saknas
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  routeOrderId?: string
}
```

### Förslag på implementation

```typescript
class BookingService implements IBookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private serviceRepo: IServiceRepository,
    private providerRepo: IProviderRepository
  ) {}

  async createBooking(
    dto: CreateBookingDTO,
    customerId: string
  ): Promise<Result<Booking, BookingError>> {
    // 1. Hämta och validera service
    const service = await this.serviceRepo.findById(dto.serviceId)
    if (!service?.isActive) {
      return Result.fail({ type: 'INACTIVE_SERVICE' })
    }

    // 2. Hämta och validera provider
    const provider = await this.providerRepo.findById(dto.providerId)
    if (!provider?.isActive) {
      return Result.fail({ type: 'INACTIVE_PROVIDER' })
    }

    // 3. Förhindra self-booking
    if (provider.userId === customerId) {
      return Result.fail({ type: 'SELF_BOOKING' })
    }

    // 4. Beräkna och validera tider
    const endTime = dto.endTime || calculateEndTime(dto.startTime, service.durationMinutes)
    const timeValidation = TimeSlot.validate(dto.startTime, endTime)
    if (!timeValidation.isValid) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeValidation.error })
    }

    // 5. Kolla överlapp (i transaction)
    const booking = await this.bookingRepo.createWithOverlapCheck({
      customerId,
      providerId: dto.providerId,
      serviceId: dto.serviceId,
      bookingDate: new Date(dto.bookingDate),
      startTime: dto.startTime,
      endTime,
      ...dto
    })

    if (!booking) {
      return Result.fail({ type: 'OVERLAP', message: 'Tiden är redan bokad' })
    }

    return Result.ok(booking)
  }
}
```

### Route efter refaktorering

```typescript
// /api/bookings/route.ts - POST blir mycket enklare

export async function POST(request: NextRequest) {
  const session = await auth()

  const body = await request.json()
  const validated = bookingInputSchema.parse(body)

  const bookingService = new BookingService(
    new PrismaBookingRepository(),
    new ServiceRepository(),
    new ProviderRepository()
  )

  const result = await bookingService.createBooking(validated, session.user.id)

  if (!result.isSuccess) {
    return NextResponse.json(
      { error: mapBookingErrorToMessage(result.error) },
      { status: mapBookingErrorToStatus(result.error) }
    )
  }

  return NextResponse.json(result.value, { status: 201 })
}
```

---

## 2. TimeSlot Value Object (Prioritet 2)

### Syfte

Kapsla in validering av tidsintervall som återanvänds på flera ställen.

### Fil att skapa

```
src/domain/shared/TimeSlot.ts
```

### Interface

```typescript
interface TimeSlotValidation {
  isValid: boolean
  error?: string
}

class TimeSlot {
  private constructor(
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly durationMinutes: number
  ) {}

  static validate(startTime: string, endTime: string): TimeSlotValidation {
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const duration = endMinutes - startMinutes

    if (endMinutes <= startMinutes) {
      return { isValid: false, error: 'Sluttid måste vara efter starttid' }
    }
    if (duration < 15) {
      return { isValid: false, error: 'Bokning måste vara minst 15 minuter' }
    }
    if (duration > 480) {
      return { isValid: false, error: 'Bokning kan inte överstiga 8 timmar' }
    }
    if (startH < 8 || endH > 18) {
      return { isValid: false, error: 'Bokning måste vara inom öppettider (08:00-18:00)' }
    }

    return { isValid: true }
  }

  static create(startTime: string, endTime: string): TimeSlot | null {
    const validation = this.validate(startTime, endTime)
    if (!validation.isValid) return null

    const duration = /* beräkna */
    return new TimeSlot(startTime, endTime, duration)
  }
}
```

---

## 3. Result Type (Prioritet 2)

### Syfte

Hantera success/failure utan exceptions för bättre kontrollflöde.

### Fil att skapa/uppdatera

```
src/domain/shared/Result.ts
```

### Interface

```typescript
type Result<T, E> =
  | { isSuccess: true; value: T }
  | { isSuccess: false; error: E }

const Result = {
  ok<T>(value: T): Result<T, never> {
    return { isSuccess: true, value }
  },

  fail<E>(error: E): Result<never, E> {
    return { isSuccess: false, error }
  }
}
```

---

## 4. Övriga routes att överväga

### Stöddomäner (OK att använda Prisma direkt)

- `/api/providers/[id]/availability-exceptions/` ✅
- `/api/providers/[id]/availability-schedule/` ✅

### Framtida refaktorering

| Route | Kommentar |
|-------|-----------|
| `/api/route-orders/` | Komplex logik - överväg RouteOrderService |
| `/api/bookings/[id]/payment/` | Överväg PaymentService |

---

## Checklista för implementation

### BookingService

- [ ] Skapa `src/domain/booking/BookingService.ts`
- [ ] Skapa `src/domain/booking/BookingService.test.ts`
- [ ] Lägg till `createWithOverlapCheck` i `IBookingRepository`
- [ ] Implementera i `PrismaBookingRepository`
- [ ] Uppdatera `/api/bookings/route.ts` POST att använda BookingService
- [ ] Uppdatera tester

### TimeSlot

- [ ] Skapa `src/domain/shared/TimeSlot.ts`
- [ ] Skapa `src/domain/shared/TimeSlot.test.ts`
- [ ] Använd i BookingService

### Result

- [ ] Skapa/uppdatera `src/domain/shared/Result.ts`
- [ ] Använd i BookingService

---

## Uppskattad insats

| Uppgift | Tid |
|---------|-----|
| BookingService + tester | 2-3 timmar |
| TimeSlot value object | 30 min |
| Result type | 15 min |
| Uppdatera route + tester | 1 timme |
| **Totalt** | **4-5 timmar** |

---

## Relaterade filer

- `src/app/api/bookings/route.ts` - Nuvarande POST-implementation
- `src/infrastructure/persistence/booking/` - Repository
- `docs/CLAUDE.md` - DDD-Light riktlinjer
