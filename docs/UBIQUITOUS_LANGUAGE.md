# Ubiquitous Language - Equinet

> **Syfte**: Ett gemensamt språk mellan utvecklare, domänexperter och affärsfolk. Samma termer används i kod, dokumentation och konversation.

**Skapad**: 2025-11-19
**Version**: 1.0
**Projekt**: Equinet - Plattform för hästtjänster

---

## 🐴 Booking Domain (Bokningar)

### Booking (Bokning)
En reservation av en tjänst från en Provider för en specifik tid.

**Synonymer**: Reservation, Appointment
**Egenskaper**:
- Har en unik identitet (BookingId)
- Tillhör en Customer och en Provider
- Är kopplad till en Service
- Har en specifik Date och TimeSlot
- Går igenom en StatusLifecycle

**Exempel**:
```typescript
const booking = {
  id: 'booking-123',
  customer: 'Karin Andersson',
  provider: 'Hovslagare AB',
  service: 'Hovslagning',
  date: '2025-02-15',
  timeSlot: '10:00-11:00',
  status: 'confirmed',
  horse: 'Thunder'
}
```

**Ubiquitous Language i kod**:
```typescript
// ✅ GOOD - Uses domain language
booking.confirm()
booking.cancel()
booking.hasConflictWith(otherBooking)

// ❌ BAD - Technical language
booking.setStatus('confirmed')
booking.checkOverlap(otherBooking)
```

---

### Booking Status (Bokningsstatus)
Livscykeln för en Booking.

**Tillstånd**:
1. **Pending** (Väntande) - Ny bokning, väntar på bekräftelse
2. **Confirmed** (Bekräftad) - Provider har accepterat
3. **Completed** (Genomförd) - Tjänsten är utförd
4. **Cancelled** (Avbokad) - Bokningen är avbruten

**Status Transitions (Tillåtna övergångar)**:
```
pending → confirmed → completed
pending → cancelled
confirmed → cancelled
```

**Business Rules**:
- En Completed booking kan INTE avbokas
- En Cancelled booking kan INTE bekräftas igen
- Endast Provider kan confirma en Pending booking
- Customer och Provider kan cancela (olika regler)

**Exempel i kod**:
```typescript
// StatusLifecycle value object
class BookingStatus extends ValueObject<{ value: string }> {
  canTransitionTo(newStatus: BookingStatus): boolean {
    const transitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    }
    return transitions[this.value].includes(newStatus.value)
  }
}
```

---

### TimeSlot (Tidslucka)
En tidsperiod med start- och sluttid.

**Value Object** (immutable, definieras av sina värden)

**Egenskaper**:
- StartTime (format: "HH:MM")
- EndTime (format: "HH:MM")
- Duration (beräknad)

**Business Rules**:
- EndTime måste vara efter StartTime
- Typiska slots: 1h, 2h, 30min
- TimeSlots kan överlappa (overlap detection)

**Exempel**:
```typescript
const morningSlot = TimeSlot.create('09:00', '10:00')
const afternoonSlot = TimeSlot.create('14:00', '16:00')

morningSlot.overlaps(afternoonSlot) // false
morningSlot.duration() // 60 minutes
```

**Overlap Logic (Överlappning)**:
```
Slot A: |-------|
Slot B:     |-------|
           ^^^ Overlap

Formula: startA < endB && startB < endA
```

---

### BookingDate (Bokningsdatum)
Datum för när tjänsten ska utföras.

**Value Object**

**Business Rules**:
- Måste vara i framtiden (för nya bokningar)
- Kan vara i det förflutna (för historik)
- Används för att gruppera bookings per dag

**Exempel**:
```typescript
const bookingDate = BookingDate.create('2025-02-15')
bookingDate.isInFuture() // true
bookingDate.isSameDay(otherDate) // comparison
```

---

### Horse (Häst)
Den häst som tjänsten ska utföras på.

**Egenskaper**:
- Name (obligatoriskt)
- Breed (frivilligt)
- Age (frivilligt)
- SpecialNotes (frivilligt)

**Exempel**:
```typescript
const horse = {
  name: 'Thunder',
  breed: 'Svensk Varmblod',
  age: 8,
  specialNotes: 'Lite nervös för höga ljud'
}
```

---

## 👤 User Domain (Användare)

### Customer (Kund)
En användare som bokar tjänster för sina hästar.

**Egenskaper**:
- Name (FirstName + LastName)
- Email (unique)
- Phone
- Address (frivilligt)

**Kan**:
- Skapa Bookings
- Se sina Bookings
- Avboka Bookings (med regler)
- Skapa RouteOrders

**Exempel**:
```typescript
const customer = {
  id: 'customer-123',
  firstName: 'Karin',
  lastName: 'Andersson',
  email: 'karin@example.com',
  phone: '070-1234567'
}
```

---

### Provider (Tjänsteleverantör)
En användare som erbjuder tjänster (t.ex. hovslagare, veterinär).

**Egenskaper**:
- BusinessName (Företagsnamn)
- City (Stad)
- Description
- Services (lista av tjänster)
- WeeklySchedule (Arbetstider)

**Kan**:
- Erbjuda Services
- Bekräfta Bookings
- Avboka Bookings
- Skapa Routes för RouteOrders
- Sätta Availability (tillgänglighet)

**Exempel**:
```typescript
const provider = {
  id: 'provider-123',
  businessName: 'Hovslagare Svensson AB',
  city: 'Stockholm',
  services: ['Hovslagning', 'Akut hovslagning'],
  weeklySchedule: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' }
  }
}
```

---

## 🛠️ Service Domain (Tjänster)

### Service (Tjänst)
En typ av tjänst som en Provider erbjuder.

**Egenskaper**:
- Name (t.ex. "Hovslagning", "Veterinärkontroll")
- Description
- Price (BasPrice, kan variera)
- Duration (Typisk tid)
- Category (ServiceCategory)

**Service Categories**:
- Hovslagning (Farriery)
- Veterinär (Veterinary)
- Träning (Training)
- Foderhantering (Feed Management)

**Exempel**:
```typescript
const service = {
  id: 'service-001',
  name: 'Hovslagning',
  description: 'Beskärning och skodd av alla fyra hovar',
  price: 800,
  duration: 60, // minutes
  category: 'Hovslagning'
}
```

---

## 🗺️ Route Planning Domain (Ruttplanering)

### Route (Rutt)
En planerad sekvens av RouteStops där Provider utför tjänster.

**Aggregate Root** (samlar flera RouteStops)

**Egenskaper**:
- Name (t.ex. "Morgonrutt Stockholm")
- Date (Datum för rutten)
- Provider
- Stops (lista av RouteStops i ordning)
- TotalDistance
- EstimatedDuration
- Status (planned, in_progress, completed)

**Business Rules**:
- Alla stops måste tillhöra samma Provider
- Stops sorteras geografiskt för effektivitet
- TotalDistance beräknas automatiskt
- Status-övergångar: planned → in_progress → completed

**Exempel**:
```typescript
const route = {
  id: 'route-456',
  name: 'Morgonrutt Stockholm',
  date: '2025-02-15',
  provider: 'Hovslagare AB',
  stops: [
    { order: 1, routeOrder: order1, estimatedArrival: '09:00' },
    { order: 2, routeOrder: order2, estimatedArrival: '10:15' },
    { order: 3, routeOrder: order3, estimatedArrival: '12:00' }
  ],
  totalDistance: 45.5, // km
  status: 'planned'
}
```

---

### RouteOrder (Ruttbeställning)
En beställning av en tjänst som ska utföras på en rutt (inte fastbokad tid).

**Egenskaper**:
- Customer
- Service
- Location (Address + Coordinates)
- DateRange (flexibelt datum, t.ex. "vecka 7-8")
- Priority (normal, urgent)
- Status (pending, accepted, in_route, completed)

**Skillnad mot Booking**:
- **Booking**: Fast tid (t.ex. "10:00-11:00 den 15 feb")
- **RouteOrder**: Flexibel (t.ex. "mellan 10-15 feb, helst förmiddag")

**Priority Levels**:
- **Normal**: Kan vänta, flexibelt
- **Urgent**: Måste utföras inom 48h (t.ex. lös sko)

**Business Rules**:
- Urgent orders måste ha DateRange inom 48h
- DateRange max 30 dagar span
- Endast pending orders kan läggas till Routes

**Exempel**:
```typescript
const routeOrder = {
  id: 'order-789',
  customer: 'Karin Andersson',
  service: 'Hovslagning',
  location: {
    address: 'Hästgatan 12, Stockholm',
    lat: 59.3293,
    lng: 18.0686
  },
  dateRange: {
    start: '2025-02-10',
    end: '2025-02-17'
  },
  priority: 'normal',
  status: 'pending'
}
```

---

### RouteStop (Ruttstopp)
Ett stopp på en Route där en RouteOrder ska utföras.

**Egenskaper**:
- Order (i sekvensen, 1, 2, 3...)
- RouteOrder (den order som ska utföras)
- EstimatedArrival (beräknad ankomsttid)
- ActualArrival (faktisk tid)
- Status (pending, completed, skipped)

**Business Rules**:
- Stops utförs i ordning
- ActualArrival sätts när Provider anländer
- Distance mellan stops beräknas för routing

---

## 📅 Availability Domain (Tillgänglighet)

### WeeklySchedule (Veckoschema)
Providers öppettider per veckodag.

**Egenskaper per dag**:
- Open (öppningstid)
- Close (stängningstid)
- IsClosed (stängt hela dagen)

**Business Rules**:
- Bookings kan endast skapas inom öppettider
- Provider kan sätta ClosedDates (specifika lediga dagar)

**Exempel**:
```typescript
const schedule = {
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '15:00' },
  saturday: { isClosed: true },
  sunday: { isClosed: true }
}
```

---

### ClosedDate (Stängd dag)
En specifik dag då Provider inte är tillgänglig.

**Exempel**:
- Semesterdagar
- Helgdagar
- Sjukdagar

**Business Rules**:
- Nya bookings kan INTE skapas på ClosedDates
- Befintliga bookings måste flyttas eller avbokas

---

## 🚨 Business Rules (Affärsregler)

### NoOverlapRule
**Regel**: En Provider kan INTE ha två Bookings samtidigt.

**Implementation**:
```typescript
class NoOverlapRule {
  validate(booking: Booking, existingBookings: Booking[]): Result<void, Error> {
    const overlapping = existingBookings.filter(b =>
      b.timeSlot.overlaps(booking.timeSlot) &&
      b.date.isSameDay(booking.date) &&
      b.status in ['pending', 'confirmed']
    )

    if (overlapping.length > 0) {
      return Result.fail(new BookingOverlapError(overlapping[0].id))
    }

    return Result.ok(undefined)
  }
}
```

---

### FutureDateRule
**Regel**: Nya Bookings måste vara i framtiden.

**Implementation**:
```typescript
class FutureDateRule {
  validate(booking: Booking): Result<void, Error> {
    if (!booking.date.isInFuture()) {
      return Result.fail(new ValidationError('Booking date must be in the future'))
    }
    return Result.ok(undefined)
  }
}
```

---

### UrgentOrderRule
**Regel**: Urgent RouteOrders måste ha DateRange inom 48h.

**Implementation**:
```typescript
class UrgentOrderRule {
  validate(order: RouteOrder): Result<void, Error> {
    if (order.priority === 'urgent') {
      const hoursDiff = order.dateRange.start.diffInHours(new Date())
      if (hoursDiff > 48) {
        return Result.fail(new ValidationError('Urgent orders must be within 48h'))
      }
    }
    return Result.ok(undefined)
  }
}
```

---

### DateRangeSpanRule
**Regel**: RouteOrder DateRange kan max vara 30 dagar.

**Implementation**:
```typescript
class DateRangeSpanRule {
  validate(order: RouteOrder): Result<void, Error> {
    const daysDiff = order.dateRange.end.diffInDays(order.dateRange.start)
    if (daysDiff > 30) {
      return Result.fail(new ValidationError('Date range cannot exceed 30 days'))
    }
    return Result.ok(undefined)
  }
}
```

---

## 📖 Domain Events (Framtida)

> **Note**: Domain events är inte implementerade i MVP, men här är planen.

### BookingConfirmed
Triggas när en Booking bekräftas.

**Data**:
- BookingId
- CustomerId
- ProviderId
- Date
- TimeSlot

**Subscribers**:
- Send email to Customer
- Send SMS to Customer
- Update Provider calendar

---

### BookingCancelled
Triggas när en Booking avbokas.

**Data**:
- BookingId
- CancelledBy (customer/provider)
- Reason

**Subscribers**:
- Send notification
- Release time slot

---

### RouteCompleted
Triggas när en Route är genomförd.

**Data**:
- RouteId
- ProviderId
- CompletedStops
- TotalDistance

**Subscribers**:
- Generate invoice
- Update statistics

---

## 🗣️ Exempel på Ubiquitous Language i Konversation

### ✅ GOOD - Använder domänspråk

**Utvecklare**: "Customers ska kunna se sina Bookings sorterade efter BookingDate."
**Product Owner**: "Ja, och de ska kunna filtrera på Status - pending, confirmed, completed."
**Utvecklare**: "Då skapar jag en findByCustomerId query i BookingRepository."

---

**Utvecklare**: "Hur hanterar vi overlapping TimeSlots?"
**Product Owner**: "Det är en NoOverlapRule - samma Provider kan inte ha två Bookings samtidigt."
**Utvecklare**: "OK, då lägger jag till overlap detection i BookingConflictChecker."

---

### ❌ BAD - Blandar tekniska och domäntermer

**Utvecklare**: "Users ska kunna se sina records sorterade efter datum."
**Product Owner**: "Records? Menar du Bookings?"
**Utvecklare**: "Ja, bookings. Ska jag filtrera på status column?"
**Product Owner**: "Status column? Vi pratar om Booking Status - pending, confirmed..."

---

## 📚 Mapping: Ubiquitous Language → Code

| Domain Term | Code Representation | Type |
|-------------|---------------------|------|
| Booking | `Booking` class | Aggregate Root |
| Booking Status | `BookingStatus` enum + value object | Value Object |
| TimeSlot | `TimeSlot` class | Value Object |
| Customer | `Customer` entity | Entity |
| Provider | `Provider` entity | Entity |
| Service | `Service` entity | Entity |
| Route | `Route` class | Aggregate Root |
| RouteOrder | `RouteOrder` entity | Entity |
| RouteStop | `RouteStop` entity | Entity |
| NoOverlapRule | `NoOverlapRule` class | Business Rule |
| BookingConflictChecker | `BookingConflictChecker` service | Domain Service |

---

## 🎯 Usage Guidelines

### För Utvecklare
- **Använd samma termer i kod som i dokumentation**
- **Klasser och metoder ska läsas som meningar**: `booking.confirm()`, `timeSlot.overlaps(other)`
- **Undvik tekniska termer i domain layer**: Inte "record", "data", "model" - använd domäntermer
- **Fråga vid osäkerhet**: "Vad kallar vi detta i affären?"

### För Product Owners
- **Granska kod-termer**: Om något känns fel, säg till!
- **Var konsistent**: Använd alltid samma term för samma koncept
- **Dokumentera nya termer**: När nya koncept dyker upp, lägg till här

### För Alla
- **Ett språk**: Samma i kod, docs, Slack, möten
- **Levande dokument**: Uppdatera när domänen förändras
- **Fråga vid konfusion**: "Vad menar vi med X?"

---

**Skapad av**: Tech-Architect + Product Owner
**Uppdaterad**: 2025-11-19
**Version**: 1.0
**Nästa review**: Efter Sprint 2 (Booking Domain implementation)
