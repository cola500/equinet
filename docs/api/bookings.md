# Bokningar

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

## GET /api/bookings

Hämta bokningar för inloggad användare.

**Auth:** Required (customer eller provider)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "customerId": "uuid",
    "providerId": "uuid",
    "serviceId": "uuid",
    "bookingDate": "2026-01-25T00:00:00.000Z",
    "startTime": "10:00",
    "endTime": "11:00",
    "status": "pending" | "confirmed" | "cancelled" | "completed",
    "horseName": "Blansen",
    "horseInfo": "Lugn häst",
    "customerNotes": "Ring vid ankomst",
    "providerNotes": "Behandlingen gick bra",
    "routeOrderId": "uuid | null",
    "service": { ... },
    "provider": { ... },
    "bookingSeries": { "id": "uuid", "intervalWeeks": 4 } | null
  }
]
```

> `providerNotes` inkluderas bara i provider-vy. Kunder ser inte detta fält.
> `routeOrderId` sätts om bokningen skapades via en ruttannonsering. Visas som "Via rutt"-badge i kundvyn.
> `bookingSeries` inkluderas om bokningen tillhör en återkommande serie.

---

## POST /api/bookings

Skapa ny bokning.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "providerId": "uuid",
  "serviceId": "uuid",
  "bookingDate": "2026-01-25T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "11:00",
  "horseName": "Blansen",
  "horseInfo": "Lugn häst, kräver lugn hantering",
  "customerNotes": "Ring vid ankomst",
  "routeOrderId": "uuid"
}
```

**Validering:**
- `bookingDate` måste vara idag eller framtida datum
- `startTime`/`endTime` i format HH:MM (00:00-23:59)
- Sluttid efter starttid, minst 15 min, max 8 timmar
- Inom öppettider (08:00-18:00)

**Response:** `201 Created`

**Felkoder:**
- `400` -- Valideringsfel, ogiltig tjänst, tjänst/provider inaktiv, självbokning
- `409` -- Tidskollision eller otillräcklig restid

**409 INSUFFICIENT_TRAVEL_TIME:**
```json
{
  "error": "Otillräcklig restid till föregående bokning...",
  "details": "Krävs 70 minuter mellan bokningar, endast 30 minuter tillgängligt.",
  "requiredMinutes": 70,
  "actualMinutes": 30
}
```

> Restid beräknas automatiskt baserat på geografisk placering. Se [SERVICE-BOOKING-FLOW.md](../SERVICE-BOOKING-FLOW.md#restid-mellan-bokningar).

---

## POST /api/bookings/manual

Skapa manuell bokning (provider bokar åt en kund).

**Auth:** Required (provider-only)

**Request Body:**
```json
{
  "serviceId": "uuid",
  "bookingDate": "2026-02-15T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "11:00",
  "customerId": "uuid",
  "customerName": "Anna Svensson",
  "customerPhone": "0701234567",
  "customerEmail": "anna@example.com",
  "horseId": "uuid",
  "horseName": "Blansen",
  "horseInfo": "Lugn häst",
  "customerNotes": "Ring vid ankomst"
}
```

**Kund-identifiering:** Ange `customerId` (befintlig kund) ELLER `customerName` (skapar ghost user). Minst ett krävs.

**Ghost User:** Skapar minimal User-record (`isManualCustomer=true`) med sentinel-email (`manual-{uuid}@ghost.equinet.se`). Kan inte logga in.

**Skillnader från vanlig bokning:**
- Status sätts till `confirmed` (inte `pending`)
- Self-booking check skippas
- Travel time validation skippas
- `isManualBooking=true` och `createdByProviderId` sätts automatiskt

**Response:** `201 Created`

**Felkoder:**
- `400` -- Valideringsfel, saknar customerId/customerName, ogiltig tjänst
- `403` -- Inte provider
- `409` -- Tidskollision
- `429` -- Rate limit

---

## PUT /api/bookings/[id]

Uppdatera bokningsstatus.

**Auth:** Required (customer eller provider, måste äga bokningen)

**Request Body:**
```json
{
  "status": "pending" | "confirmed" | "cancelled" | "completed"
}
```

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel
- `404` -- Bokning finns inte eller saknar behörighet (atomär auth)

---

## DELETE /api/bookings/[id]

Ta bort bokning.

**Auth:** Required (customer eller provider, måste äga bokningen)

**Response:** `200 OK` `{ "message": "Booking deleted" }`

**Felkoder:**
- `404` -- Bokning finns inte eller saknar behörighet (atomär auth)

---

## POST /api/booking-series

Skapa återkommande bokningsserie. Genererar alla N bokningar direkt. Datum som krockar hoppas över.

**Auth:** Required (customer eller provider)
**Feature flag:** `recurring_bookings` måste vara aktiverad

**Request Body:**
```json
{
  "providerId": "uuid",
  "serviceId": "uuid",
  "firstBookingDate": "2026-03-01",
  "startTime": "10:00",
  "intervalWeeks": 4,
  "totalOccurrences": 6,
  "horseId": "uuid",
  "horseName": "Blansen",
  "horseInfo": "Lugn häst",
  "customerNotes": "Ring vid ankomst"
}
```

**Validering:**
- `intervalWeeks`: 1-52
- `totalOccurrences`: 2-52 (begränsas av provider.maxSeriesOccurrences)
- `firstBookingDate`: YYYY-MM-DD format
- `startTime`: HH:MM format

**Response:** `201 Created`
```json
{
  "series": {
    "id": "uuid",
    "intervalWeeks": 4,
    "totalOccurrences": 6,
    "createdCount": 5,
    "status": "active"
  },
  "createdBookings": [...],
  "skippedDates": [
    { "date": "2026-05-24", "reason": "Tidskollision" }
  ]
}
```

**Felkoder:**
- `400` -- Valideringsfel, feature flag av, recurring disabled
- `401` -- Ej inloggad

---

## GET /api/booking-series/[id]

Hämta bokningsserie med alla tillhörande bokningar.

**Auth:** Required (ägare -- customer eller provider)

**Response:** `200 OK`

**Felkoder:**
- `401` -- Ej inloggad
- `404` -- Serie finns inte eller saknar behörighet

---

## POST /api/booking-series/[id]/cancel

Avbryt bokningsserie. Avbokar alla framtida bokningar (pending/confirmed). Genomförda bevaras.

**Auth:** Required (ägare -- customer eller provider)

**Request Body (valfritt):**
```json
{
  "cancellationMessage": "Behöver inte fler besök"
}
```

**Response:** `200 OK`
```json
{
  "cancelledBookings": 3,
  "series": { "status": "cancelled" }
}
```

**Felkoder:**
- `401` -- Ej inloggad
- `404` -- Serie finns inte eller saknar behörighet
