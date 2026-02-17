# Bokningar

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

## GET /api/bookings

Hamta bokningar for inloggad anvandare.

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
    "horseInfo": "Lugn hast",
    "customerNotes": "Ring vid ankomst",
    "providerNotes": "Behandlingen gick bra",
    "service": { ... },
    "provider": { ... }
  }
]
```

> `providerNotes` inkluderas bara i provider-vy. Kunder ser inte detta falt.

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
  "horseInfo": "Lugn hast, kraver lugn hantering",
  "customerNotes": "Ring vid ankomst",
  "routeOrderId": "uuid"
}
```

**Validering:**
- `bookingDate` maste vara idag eller framtida datum
- `startTime`/`endTime` i format HH:MM (00:00-23:59)
- Sluttid efter starttid, minst 15 min, max 8 timmar
- Inom oppettider (08:00-18:00)

**Response:** `201 Created`

**Felkoder:**
- `400` -- Valideringsfel, ogiltig tjanst, tjanst/provider inaktiv, sjalvbokning
- `409` -- Tidskollision eller otillracklig restid

**409 INSUFFICIENT_TRAVEL_TIME:**
```json
{
  "error": "Otillracklig restid till foregaende bokning...",
  "details": "Kravs 70 minuter mellan bokningar, endast 30 minuter tillgangligt.",
  "requiredMinutes": 70,
  "actualMinutes": 30
}
```

> Restid beraknas automatiskt baserat pa geografisk placering. Se [SERVICE-BOOKING-FLOW.md](../SERVICE-BOOKING-FLOW.md#restid-mellan-bokningar).

---

## POST /api/bookings/manual

Skapa manuell bokning (provider bokar at en kund).

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
  "horseInfo": "Lugn hast",
  "customerNotes": "Ring vid ankomst"
}
```

**Kund-identifiering:** Ange `customerId` (befintlig kund) ELLER `customerName` (skapar ghost user). Minst ett kravs.

**Ghost User:** Skapar minimal User-record (`isManualCustomer=true`) med sentinel-email (`manual-{uuid}@ghost.equinet.se`). Kan inte logga in.

**Skillnader fran vanlig bokning:**
- Status satts till `confirmed` (inte `pending`)
- Self-booking check skippas
- Travel time validation skippas
- `isManualBooking=true` och `createdByProviderId` satts automatiskt

**Response:** `201 Created`

**Felkoder:**
- `400` -- Valideringsfel, saknar customerId/customerName, ogiltig tjanst
- `403` -- Inte provider
- `409` -- Tidskollision
- `429` -- Rate limit

---

## PUT /api/bookings/[id]

Uppdatera bokningsstatus.

**Auth:** Required (customer eller provider, maste aga bokningen)

**Request Body:**
```json
{
  "status": "pending" | "confirmed" | "cancelled" | "completed"
}
```

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel
- `404` -- Bokning finns inte eller saknar behorighet (atomar auth)

---

## DELETE /api/bookings/[id]

Ta bort bokning.

**Auth:** Required (customer eller provider, maste aga bokningen)

**Response:** `200 OK` `{ "message": "Booking deleted" }`

**Felkoder:**
- `404` -- Bokning finns inte eller saknar behorighet (atomar auth)
