# C1: Recurring Bookings (Återkommande bokningar)

## Kontext

Hästtjänster är per definition återkommande (hovslagare var 6:e vecka, ridlektioner varje vecka). Alla konkurrenter (Acuity, Booksy, iForgeAhead, EquineM) har detta som core feature. Recurring bookings ökar retention (+25-95% vinst vid 5% bättre retention), rebooking-rate (+38%), och minskar no-shows (34-50% med auto-påminnelser).

**Approach: Generera alla direkt.** När serien skapas genereras alla N bokningar direkt. Enklare, leverantören ser kalenderpåverkan omedelbart. Bokningar som krockar hoppas över.

**Skapare: Både kund och leverantör.** Kunden skapar via bokningsflöde, leverantören via manuell bokning.

**Feature flag: `recurring_bookings` (default: false).** Slås på via admin när det testats.

---

## Fas 1: Schema + Migration + Feature Flag

### 1a. Prisma-schema

**Ny modell: `BookingSeries`**
```prisma
model BookingSeries {
  id               String    @id @default(uuid())
  customerId       String
  customer         User      @relation(fields: [customerId], references: [id])
  providerId       String
  provider         Provider  @relation(fields: [providerId], references: [id])
  serviceId        String
  service          Service   @relation(fields: [serviceId], references: [id])
  horseId          String?
  horse            Horse?    @relation(fields: [horseId], references: [id])
  intervalWeeks    Int
  totalOccurrences Int
  createdCount     Int
  startTime        String        // "HH:MM"
  status           String    @default("active")  // active | cancelled | completed
  cancelledAt      DateTime?
  createdAt        DateTime  @default(now())
  bookings         Booking[]
  @@index([customerId])
  @@index([providerId])
  @@index([status])
}
```

**Booking -- nytt fält:**
```prisma
bookingSeriesId  String?
bookingSeries    BookingSeries? @relation(fields: [bookingSeriesId], references: [id])
@@index([bookingSeriesId])
```

**Provider -- nya fält:**
```prisma
recurringEnabled      Boolean @default(true)
maxSeriesOccurrences  Int     @default(12)
```

**Relationer**: Lägg till `bookingSeries BookingSeries[]` på User, Provider, Service, Horse.

### 1b. Feature flag

Lägg till i `src/lib/feature-flags.ts`:
```typescript
recurring_bookings: {
  key: "recurring_bookings",
  label: "Återkommande bokningar",
  description: "Möjlighet att skapa återkommande bokningsserier",
  defaultEnabled: false,
}
```

### 1c. Filer
- `prisma/schema.prisma` (ändra)
- `prisma/migrations/<ts>_add_booking_series/migration.sql` (ny)
- `src/lib/feature-flags.ts` (ändra)
- Feature flag tester (uppdatera antal: 8 -> 9)

### 1d. Verifiering
- `npx prisma migrate dev`
- `npm run test:run -- feature-flags`

---

## Fas 2: Domain -- BookingSeriesService (TDD)

**Ny fil:** `src/domain/booking/BookingSeriesService.ts`

BookingSeries är en **stöddomän** (som AvailabilityException) -- ingen separat repository. Prisma-anrop direkt, all bokningslogik via befintlig `BookingService`.

### DTO:er
```typescript
interface CreateSeriesDTO {
  customerId: string
  providerId: string
  serviceId: string
  firstBookingDate: Date
  startTime: string
  intervalWeeks: number      // 1-52
  totalOccurrences: number   // 2-max
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  isManualBooking?: boolean  // true = leverantör skapar
  createdByProviderId?: string
}

interface CreateSeriesResult {
  series: { id, intervalWeeks, totalOccurrences, createdCount, status }
  createdBookings: BookingWithRelations[]
  skippedDates: { date: string; reason: string }[]
}

type SeriesError =
  | { type: 'RECURRING_FEATURE_OFF' }
  | { type: 'RECURRING_DISABLED' }
  | { type: 'INVALID_INTERVAL'; message: string }
  | { type: 'INVALID_OCCURRENCES'; message: string; max: number }
  | { type: 'NO_BOOKINGS_CREATED'; message: string }
```

### createSeries() logik
1. Check feature flag `recurring_bookings`
2. Get provider, check `recurringEnabled`
3. Validate interval (1-52)
4. Validate occurrences (2 - `maxSeriesOccurrences`)
5. Create BookingSeries record (status: "active")
6. Loop N gånger, räkna datum: `firstBookingDate + i * intervalWeeks * 7 dagar`
7. För varje: anropa `bookingService.createBooking()` (eller `createManualBooking()`) med `bookingSeriesId`
8. OVERLAP / PROVIDER_CLOSED -> lägg i skippedDates, fortsätt
9. Annat fel -> logga, fortsätt
10. Om 0 skapade -> ta bort serien, returnera NO_BOOKINGS_CREATED
11. Uppdatera `createdCount`
12. Returnera resultat

**Viktigt:** `CreateBookingData` i IBookingRepository utöka med `bookingSeriesId?: string`.

### cancelSeries() logik
1. Hämta serien, verifiera ägarskap (customerId ELLER providerId)
2. Hämta alla bokningar i serien där status = pending/confirmed OCH bookingDate >= idag
3. Avboka varje via `bookingService.updateStatus()` (bevarar state machine)
4. Uppdatera series.status = "cancelled", sätt cancelledAt
5. Returnera antal avbokade

### Tester (~20-25 st)
- Feature flag av -> RECURRING_FEATURE_OFF
- Provider recurring disabled -> RECURRING_DISABLED
- Ogiltigt intervall (0, 53) -> INVALID_INTERVAL
- För många occurrences -> INVALID_OCCURRENCES
- Happy path: 4 occurrences, 0 skipped
- Delvis skapande: 4 begärda, 1 hoppad (overlap)
- Alla hoppade -> NO_BOOKINGS_CREATED
- Cancel serie: avbokar framtida, bevarar completed
- Cancel serie: ej ägare -> fel
- Manual booking-serie (leverantör skapar)

### Filer
- `src/domain/booking/BookingSeriesService.ts` (ny)
- `src/domain/booking/BookingSeriesService.test.ts` (ny)
- `src/infrastructure/persistence/booking/IBookingRepository.ts` (ändra -- CreateBookingData + Booking interface)
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` (ändra -- createWithOverlapCheck)
- `src/infrastructure/persistence/booking/MockBookingRepository.ts` (ändra)

---

## Fas 3: API Endpoints (TDD)

### 3a. POST /api/booking-series -- Skapa serie

Pattern: auth -> rate limit (booking) -> JSON try-catch -> Zod .strict() -> feature flag -> service -> 201

```typescript
const createSeriesSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  firstBookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  intervalWeeks: z.number().int().min(1).max(52),
  totalOccurrences: z.number().int().min(2).max(52),
  horseId: z.string().uuid().optional(),
  horseName: z.string().max(100).optional(),
  horseInfo: z.string().max(500).optional(),
  customerNotes: z.string().max(1000).optional(),
}).strict()
```

**Auth-logik:** Session krävs. Om user.providerId finns OCH matchar body.providerId -> leverantör skapar (isManualBooking=true). Annars -> kund skapar (customerId från session).

### 3b. GET /api/booking-series/[id] -- Hämta serie

Auth + ownership check. Returnerar serien med alla bokningar.

### 3c. POST /api/booking-series/[id]/cancel -- Avbryt serie

Auth + ownership + rate limit. Optional body: `{ cancellationMessage?: string }`.

### Tester (~30 st)
- Auth-kontroller (ej inloggad, fel ägarskap)
- Rate limit
- Zod-validering (ogiltiga fält, unknown fält)
- Feature flag av
- Happy path kund + leverantör
- Skipped dates i response
- Cancel: avbokar framtida, bevarar genomförda

### Filer
- `src/app/api/booking-series/route.ts` (ny)
- `src/app/api/booking-series/route.test.ts` (ny)
- `src/app/api/booking-series/[id]/route.ts` (ny)
- `src/app/api/booking-series/[id]/route.test.ts` (ny)
- `src/app/api/booking-series/[id]/cancel/route.ts` (ny)
- `src/app/api/booking-series/[id]/cancel/route.test.ts` (ny)

---

## Fas 4: Provider-inställningar (TDD)

Följer reschedule-inställningarnas mönster (inline switch -> PUT -> mutate SWR).

### API: Provider profile utökad
- `src/app/api/provider/profile/route.ts`: Lägg till `recurringEnabled`, `maxSeriesOccurrences` i Zod-schema + alla select-block
- Validering: `maxSeriesOccurrences: z.number().int().min(2).max(52).optional()`

### UI: Ny Card i provider/profile/page.tsx

```
Återkommande bokningar
[Switch] Tillåt återkommande bokningar
  Visa om enabled:
  [Select] Max antal tillfällen: 4/6/8/12/24/52
```

### Tester (3-5 nya)
- Utöka befintliga provider profile tester

### Filer
- `src/app/api/provider/profile/route.ts` (ändra)
- `src/app/api/provider/profile/route.test.ts` (ändra)
- `src/app/provider/profile/page.tsx` (ändra)

---

## Fas 5: Kund-UI -- "Gör återkommande" i bokningsflöde

### 5a. Bokningsdialogen

I `DesktopBookingDialog.tsx` + `MobileBookingFlow.tsx`, lägg till under tjänsteval (visas bara om feature flag är på):

```
[Switch] Gör detta återkommande
  Visa om enabled:
  [Select] Intervall: Varje vecka / Varannan vecka / Var 4:e / 6:e / 8:e vecka
  [Select] Antal tillfällen: 4 / 6 / 8 / 12
```

Om `service.recommendedIntervalWeeks` finns -> förval det som intervall.

### 5b. Submit-logik

I `useBookingFlow.ts` (eller motsvarande hook): om isRecurring -> POST `/api/booking-series` istället för POST `/api/bookings`.

### 5c. Resultatdialog

Ny komponent `SeriesResultDialog.tsx`:
- "X av Y bokningar skapades"
- Lista över hoppade datum med anledning (om några)
- Knapp "Se dina bokningar"

### Filer
- `src/components/booking/DesktopBookingDialog.tsx` (ändra)
- `src/components/booking/MobileBookingFlow.tsx` (ändra)
- `src/hooks/useBookingFlow.ts` eller motsvarande (ändra)
- `src/components/booking/SeriesResultDialog.tsx` (ny)

---

## Fas 6: Leverantör-UI -- Manuell serie via ManualBookingDialog

Samma mönster som kundflöde men i `ManualBookingDialog.tsx`:

```
[Switch] Gör detta återkommande
  [Select] Intervall
  [Select] Antal tillfällen
```

Vid submit: POST `/api/booking-series` med leverantör-auth (isManualBooking=true).

### Filer
- `src/components/booking/ManualBookingDialog.tsx` (ändra)

---

## Fas 7: Bokningslistor + Kalender -- Serie-indikatorer

### 7a. Select-block audit

Lägg till `bookingSeriesId: true` + `bookingSeries: { select: { id, intervalWeeks, totalOccurrences, createdCount, status } }` i:
- `PrismaBookingRepository` -- alla findWith*Details-metoder, createWithOverlapCheck, rescheduleWithOverlapCheck
- Provider-relaterade select-block

**Gotcha:** Kontrollera ALLA select-block i hela kodbasen (orsak till buggar i session 33).

### 7b. BookingWithRelations utökad

```typescript
bookingSeriesId?: string | null
bookingSeries?: {
  id: string; intervalWeeks: number; totalOccurrences: number;
  createdCount: number; status: string
} | null
```

### 7c. Kund-bokningslista

I `src/app/customer/bookings/page.tsx`:
- Badge "Återkommande" (lila) på bokningar som tillhör en serie
- "Avbryt serie"-knapp (visas om serie.status = "active")

### 7d. Leverantör-kalender

I `src/components/calendar/BookingBlock.tsx`:
- Repeat-ikon (lucide-react `Repeat`) på serie-bokningar

### Filer
- `src/infrastructure/persistence/booking/IBookingRepository.ts` (ändra -- BookingWithRelations)
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` (ändra -- alla select-block)
- `src/app/customer/bookings/page.tsx` (ändra)
- `src/components/calendar/BookingBlock.tsx` (ändra)

---

## Fas 8: E-postnotifikationer

### 8a. Ny mall: `bookingSeriesCreatedEmail()`

I `src/lib/email/templates.ts`. Innehåll:
- "Du har skapat en återkommande bokning för [tjänst] hos [leverantör]"
- Lista: alla datum + tider
- Om hoppade datum: "Följande datum kunde inte bokas: ..."
- Länk till "Se dina bokningar"

### 8b. Ny funktion: `sendBookingSeriesNotification()`

I `src/lib/email/notifications.ts`. Skickar till:
- Kund: bekräftelse med alla datum
- Leverantör: info om ny serie

### 8c. Serie-avbokning

Återanvänd befintlig `bookingStatusChangeEmail` för varje enskild avbokning (triggers automatiskt via BookingService.updateStatus event dispatch).

### Filer
- `src/lib/email/templates.ts` (ändra)
- `src/lib/email/templates.test.ts` (ändra)
- `src/lib/email/notifications.ts` (ändra)

---

## Fas 9: Verifiering + Cleanup

1. `npm run test:run` -- alla tester gröna
2. `npm run typecheck` -- inga TypeScript-fel
3. `npm run check:swedish` -- svenska tecken OK
4. Manuellt test via UI: skapa serie som kund, verifiera kalender, avbryt serie
5. Manuellt test: leverantör skapar serie via manuell bokning
6. Kontrollera att feature flag toggle fungerar (admin)

---

## Sammanfattning

| Fas | Nya filer | Ändrade filer | Nya tester (ca) |
|-----|-----------|---------------|-----------------|
| 1. Schema + Flag | 1 migration | 2 (schema, flags) | 3-5 |
| 2. Domain Service | 2 (service + test) | 3 (repo interface + impls) | 20-25 |
| 3. API Endpoints | 6 (3 routes + 3 tests) | 0 | 25-30 |
| 4. Provider Settings | 0 | 3 (route, test, page) | 3-5 |
| 5. Kund-UI | 1 (SeriesResultDialog) | 3 (dialogs + hook) | 0 |
| 6. Leverantör-UI | 0 | 1 (ManualBookingDialog) | 0 |
| 7. Indikatorer | 0 | 4 (repo, prisma, page, block) | 0 |
| 8. E-post | 0 | 3 (templates, tests, notifications) | 3-5 |
| 9. Verifiering | 0 | 0 | 0 |
| **Totalt** | **~10** | **~19** | **~55-70** |

## Risker
- **Performance**: 12+ bokningar i en request med serializable transactions. Acceptabelt för MVP, optimera om det tar >5s.
- **Select-block missar**: Fas 7 är dedikerad åt detta. Sök `select:` i hela kodbasen.
- **Feature flag tester**: Alla tester med hårdkodade flagg-antal måste uppdateras (9 ist för 8).
