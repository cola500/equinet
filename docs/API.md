# API Reference

Equinet REST API dokumentation.

## Autentisering

Alla endpoints (utom `/api/health` och `/api/providers`) kräver NextAuth session.
Sessionen skickas automatiskt via HTTP-only cookies.

**Felkoder för autentisering:**
- `401 Unauthorized` - Ingen giltig session
- `403 Forbidden` - Saknar behörighet för åtgärden

### Säkerhet: Atomära Authorization Checks

Alla modifierande endpoints använder atomära authorization checks:

- Authorization sker i samma databasfråga som operationen
- Returnerar `404 Not Found` (inte `403 Forbidden`) vid unauthorized access
- Förhindrar IDOR (Insecure Direct Object Reference) vulnerabilities
- Förhindrar information leakage (angripare kan ej enumera IDs)

**Exempel:**
```typescript
// WHERE clause inkluderar både ID och owner
await prisma.booking.update({
  where: { id, providerId },  // Atomär auth check
  data: { status }
})
```

---

## Auth

### POST /api/auth/register

Registrera ny användare.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "minst8tecken",
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567",
  "userType": "customer" | "provider",
  "businessName": "Hovslagare AB",  // Krävs för provider
  "description": "Beskrivning",      // Optional för provider
  "city": "Göteborg"                 // Optional för provider
}
```

**Response:** `201 Created`
```json
{
  "message": "Användare skapad",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Johan",
    "lastName": "Lindengård",
    "userType": "customer"
  }
}
```

**Errors:**
- `400` - Valideringsfel eller användare finns redan
- `429` - Rate limit (5 registreringar/timme per IP)

---

### GET/POST /api/auth/[...nextauth]

NextAuth.js endpoints för inloggning, utloggning och session.

Se [NextAuth.js dokumentation](https://next-auth.js.org/getting-started/rest-api).

---

## Bookings

### GET /api/bookings

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
    "service": { ... },
    "provider": { ... }
  }
]
```

> **Obs:** `providerNotes` inkluderas bara i provider-vy. Kunder ser inte detta fält.

---

### POST /api/bookings

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
  "routeOrderId": "uuid"  // Optional, länka till annonsering
}
```

**Validering:**
- `bookingDate` måste vara idag eller framtida datum
- `startTime` och `endTime` i format HH:MM (00:00-23:59)
- Sluttid måste vara efter starttid
- Minst 15 minuter, max 8 timmar
- Inom öppettider (08:00-18:00)

**Response:** `201 Created`

**Errors:**
- `400` - Valideringsfel, ogiltig tjänst, tjänst/provider inaktiv, självbokning
- `409` - Tidskollision med annan bokning, eller otillräcklig restid mellan bokningar
- `429` - Rate limit (10 bokningar/timme)

**409 INSUFFICIENT_TRAVEL_TIME Response:**
```json
{
  "error": "Otillräcklig restid till föregående bokning...",
  "details": "Krävs 70 minuter mellan bokningar, endast 30 minuter tillgängligt.",
  "requiredMinutes": 70,
  "actualMinutes": 30
}
```

> Restid beräknas automatiskt baserat på geografisk placering (kundens adress). Se [SERVICE-BOOKING-FLOW.md](./SERVICE-BOOKING-FLOW.md#restid-mellan-bokningar) för detaljer.

---

### POST /api/bookings/manual

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

**Kund-identifiering:** Ange `customerId` (befintlig kund) ELLER `customerName` (skapar ghost user). Minst ett av dessa krävs.

**Ghost User:** Om ingen `customerId` anges skapas en minimal User-record (`isManualCustomer=true`) med sentinel-email (`manual-{uuid}@ghost.equinet.se`). Ghost users kan inte logga in.

**Skillnader från vanlig bokning:**
- Status sätts till `confirmed` (inte `pending`)
- Self-booking check skippas
- Travel time validation skippas
- `isManualBooking=true` och `createdByProviderId` sätts automatiskt

**Response:** `201 Created` -- bokning med relationer

**Errors:**
- `400` - Valideringsfel, saknar customerId/customerName, ogiltig tjänst
- `403` - Inte provider
- `409` - Tidskollision med annan bokning
- `429` - Rate limit

> **Säkerhet:** `providerId` tas från session (IDOR-skydd). Audit trail via `logger.security()`.

---

### PUT /api/bookings/[id]

Uppdatera bokningsstatus.

**Auth:** Required (customer eller provider, måste äga bokningen)

**Request Body:**
```json
{
  "status": "pending" | "confirmed" | "cancelled" | "completed"
}
```

**Response:** `200 OK`

**Errors:**
- `400` - Valideringsfel
- `404` - Bokning finns inte **eller saknar behörighet** (atomär auth)

> **Säkerhet:** Använder atomär authorization check - returnerar 404 även vid unauthorized access för att förhindra ID-enumeration.

---

### DELETE /api/bookings/[id]

Ta bort bokning.

**Auth:** Required (customer eller provider, måste äga bokningen)

**Response:** `200 OK`
```json
{ "message": "Booking deleted" }
```

**Errors:**
- `404` - Bokning finns inte **eller saknar behörighet** (atomär auth)

> **Säkerhet:** Använder atomär authorization check - returnerar 404 även vid unauthorized access för att förhindra ID-enumeration.

---

## Customers (Provider-only)

Endpoints för providers att söka kunder och hämta kunddata.

### GET /api/customers/search

Sök bland kunder som har bokat med denna provider.

**Auth:** Required (provider-only)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `q` | string | Sökterm (min 2 tecken), **Required** |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "firstName": "Anna",
    "lastName": "Svensson",
    "email": "anna@example.com",
    "phone": "0701234567"
  }
]
```

**Begränsningar:**
- Max 10 resultat
- Söker i firstName, lastName, email
- Exkluderar ghost users (`isManualCustomer=false`)
- Bara kunder som har minst en bokning med providern

**Errors:**
- `400` - Sökterm för kort (min 2 tecken)
- `403` - Inte provider
- `429` - Rate limit

---

### GET /api/customers/[id]/horses

Hämta en kunds aktiva hästar.

**Auth:** Required (provider-only, måste ha bokningsrelation med kunden)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Blansen",
    "breed": "Svenskt varmblod",
    "birthYear": 2018,
    "gender": "gelding"
  }
]
```

**Errors:**
- `403` - Inte provider, eller saknar bokningsrelation med kunden (IDOR-skydd)
- `429` - Rate limit

> **Säkerhet:** Verifierar att providern har minst en bokning med kunden innan hästar visas.

---

### GET /api/provider/customers/[customerId]/notes

Hämta leverantörens privata anteckningar om en kund (journal).

**Auth:** Required (provider-only, måste ha completed booking med kunden)

**Response:** `200 OK`
```json
{
  "notes": [
    {
      "id": "uuid",
      "providerId": "uuid",
      "customerId": "uuid",
      "content": "Behöver extra tid vid besök",
      "createdAt": "2026-02-10T14:30:00.000Z",
      "updatedAt": "2026-02-10T14:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `403` - Inte provider, eller saknar completed booking med kunden
- `429` - Rate limit

---

### POST /api/provider/customers/[customerId]/notes

Skapa en ny anteckning om en kund.

**Auth:** Required (provider-only, måste ha completed booking med kunden)

**Request Body:**
```json
{
  "content": "Kunden behöver extra tid vid besök"
}
```

| Fält | Typ | Validering |
|------|-----|------------|
| `content` | string | Min 1, max 2000 tecken. Saniteras (XSS + multiline). `.strict()` |

**Response:** `201 Created` med den skapade anteckningen.

**Errors:**
- `400` - Ogiltig JSON, valideringsfel, tomt innehåll efter sanitering
- `403` - Inte provider, eller saknar completed booking
- `429` - Rate limit

> **Säkerhet:** `providerId` tas från session (aldrig request body). `customerId` från URL-parameter. Content saniteras med `stripXss()` + `sanitizeMultilineString()`.

---

### PUT /api/provider/customers/[customerId]/notes/[noteId]

Redigera en befintlig anteckning.

**Auth:** Required (provider-only, atomär ägarskapscheck)

**Request Body:**
```json
{
  "content": "Uppdaterad text"
}
```

| Fält | Typ | Validering |
|------|-----|------------|
| `content` | string | Min 1, max 2000 tecken. Saniteras (XSS + multiline). `.strict()` |

**Response:** `200 OK` med den uppdaterade anteckningen (inkl. `updatedAt`).

**Errors:**
- `400` - Ogiltig JSON, valideringsfel, tomt innehåll efter sanitering
- `403` - Inte provider
- `404` - Anteckningen hittades inte (eller tillhör annan provider)
- `429` - Rate limit

> **Säkerhet:** Atomär WHERE `{ id, providerId }` förhindrar IDOR. Content saniteras med `stripXss()` + `sanitizeMultilineString()`.

---

### DELETE /api/provider/customers/[customerId]/notes/[noteId]

Ta bort en anteckning.

**Auth:** Required (provider-only, atomär ägarskapscheck)

**Response:** `204 No Content`

**Errors:**
- `403` - Inte provider
- `404` - Anteckningen hittades inte (eller tillhör annan provider)
- `429` - Rate limit

> **Säkerhet:** Atomär WHERE `{ id, providerId }` förhindrar IDOR.

---

## Horses

Hästregister -- kundens hästar (CRUD). Alla endpoints kräver autentisering.

### GET /api/horses

Hämta inloggad kunds aktiva hästar.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Blansen",
    "breed": "Svenskt varmblod",
    "birthYear": 2018,
    "color": "Brun",
    "gender": "gelding",
    "specialNeeds": null,
    "isActive": true,
    "createdAt": "2026-01-30T10:00:00Z",
    "updatedAt": "2026-01-30T10:00:00Z"
  }
]
```

### POST /api/horses

Skapa ny häst. Namn är obligatoriskt, övriga fält valfria.

**Request body:**
```json
{
  "name": "Blansen",
  "breed": "Svenskt varmblod",
  "birthYear": 2018,
  "color": "Brun",
  "gender": "mare | gelding | stallion",
  "specialNeeds": "Känslig på vänster fram"
}
```

**Response:** `201 Created` med skapad häst.

### GET /api/horses/[id]

Hämta häst med bokningshistorik (senaste 20 bokningar). IDOR-skyddad via ownerId i WHERE-clause.

**Response:** `200 OK` -- häst-objekt + `bookings[]` med provider/service-info.

### PUT /api/horses/[id]

Uppdatera häst (partial updates). Alla fält utom `name` kan sättas till `null`.

**Response:** `200 OK` med uppdaterad häst.

### DELETE /api/horses/[id]

Soft delete (sätter `isActive=false`). Hästen försvinner från listor men befintliga bokningar behåller kopplingen.

**Response:** `200 OK` med `{ "message": "Hästen har tagits bort" }`.

---

## Horse Notes (Hästhälsotidslinje)

Anteckningar i hästens hälsohistorik. Alla endpoints kräver autentisering och ägarskap av hästen (IDOR-skyddade).

### GET /api/horses/[id]/notes

Lista anteckningar för en häst.

**Auth:** Required (hästens ägare)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `category` | string | Filtrera på kategori: `veterinary`, `farrier`, `general`, `injury`, `medication` |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "horseId": "uuid",
    "authorId": "uuid",
    "category": "veterinary",
    "title": "Vaccination - influensa",
    "content": "Årlig vaccination genomförd",
    "noteDate": "2026-01-15T00:00:00.000Z",
    "createdAt": "2026-01-30T10:00:00Z",
    "author": {
      "firstName": "Anna",
      "lastName": "Svensson"
    }
  }
]
```

### POST /api/horses/[id]/notes

Skapa ny anteckning.

**Auth:** Required (hästens ägare)

**Request Body:**
```json
{
  "category": "veterinary | farrier | general | injury | medication",
  "title": "Vaccination - influensa",
  "content": "Valfri beskrivning (max 2000 tecken)",
  "noteDate": "2026-01-15T00:00:00.000Z"
}
```

**Validering:**
- `category`: obligatorisk, en av veterinary/farrier/general/injury/medication
- `title`: obligatorisk, 1-200 tecken
- `content`: valfri, max 2000 tecken
- `noteDate`: obligatorisk, giltigt ISO-datum, inte i framtiden

**Response:** `201 Created`

### PUT /api/horses/[id]/notes/[noteId]

Uppdatera anteckning (partial updates).

**Auth:** Required (hästens ägare)

**Request Body:** Samma fält som POST, alla valfria.

**Response:** `200 OK`

### DELETE /api/horses/[id]/notes/[noteId]

Radera anteckning (hard delete).

**Auth:** Required (hästens ägare)

**Response:** `200 OK` med `{ "message": "Anteckningen har tagits bort" }`.

---

## Horse Timeline

### GET /api/horses/[id]/timeline

Kombinerad tidslinje: bokningar (completed) + anteckningar, sorterade kronologiskt.

**Auth:** Required (hästens ägare ELLER provider med bokning för hästen)

**Åtkomstnivåer:**
- **Ägare:** Ser alla kategorier
- **Provider:** Ser bara `veterinary`, `farrier`, `medication` (integritetsskydd)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `category` | string | Filtrera på kategori (döljer bokningar vid filtrering) |

**Response:** `200 OK`
```json
[
  {
    "type": "booking",
    "id": "uuid",
    "date": "2026-01-20T00:00:00.000Z",
    "title": "Massage",
    "providerName": "Sara Hästmassage",
    "status": "completed",
    "notes": "Stel i ryggen",
    "providerNotes": "Behandlade rygg och nacke"
  },
  {
    "type": "note",
    "id": "uuid",
    "date": "2026-01-15T00:00:00.000Z",
    "title": "Vaccination - influensa",
    "category": "veterinary",
    "content": "Årlig vaccination genomförd",
    "authorName": "Anna Svensson"
  }
]
```

---

## Provider: Kundregister

### GET /api/provider/customers

Hämta leverantörens kundregister (härledd från bokningar).

**Auth:** Required (provider)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `status` | string | `active` (senaste 6 mån) eller `inactive` (äldre). Default: alla |
| `search` | string | Fritextsökning i namn |

**Response:** `200 OK`
```json
[
  {
    "customerId": "uuid",
    "customerName": "Anna Svensson",
    "customerEmail": "anna@example.com",
    "customerPhone": "0701234567",
    "bookingCount": 5,
    "lastBookingDate": "2026-01-20T00:00:00.000Z",
    "horses": [
      { "id": "uuid", "name": "Blansen" }
    ]
  }
]
```

**Errors:**
- `403` - Inte provider
- `429` - Rate limit

> **Integritetsskydd:** Bara kunder med completed bokningar för denna provider visas. Data aggregeras från Booking-tabellen utan ny tabell.

---

## Provider: Återbesöksintervall

### GET /api/provider/horses/[horseId]/interval

Hämta återbesöksintervall för en häst (provider-specifikt override).

**Auth:** Required (provider med bokning för hästen)

**Response:** `200 OK`
```json
{
  "horseId": "uuid",
  "providerId": "uuid",
  "intervalWeeks": 8
}
```

**Errors:**
- `403` - Inte provider
- `404` - Inget intervall satt, eller saknar bokningsrelation med hästen

---

### PUT /api/provider/horses/[horseId]/interval

Sätt eller uppdatera återbesöksintervall (upsert).

**Auth:** Required (provider med bokning för hästen)

**Request Body:**
```json
{
  "intervalWeeks": 8
}
```

**Validering:**
- `intervalWeeks`: heltal, 1-52

**Response:** `200 OK`
```json
{
  "horseId": "uuid",
  "providerId": "uuid",
  "intervalWeeks": 8
}
```

**Errors:**
- `400` - Valideringsfel (utanför 1-52)
- `403` - Inte provider eller saknar bokningsrelation
- `429` - Rate limit

---

### DELETE /api/provider/horses/[horseId]/interval

Ta bort återbesöksintervall (återställ till tjänstens default).

**Auth:** Required (provider med bokning för hästen)

**Response:** `200 OK`
```json
{ "message": "Interval removed" }
```

**Errors:**
- `403` - Inte provider
- `404` - Inget intervall att ta bort

---

## Provider: Besöksplanering

### GET /api/provider/due-for-service

Hämta hästar som behöver återbesök, sorterade efter angelägenhet.

**Auth:** Required (provider)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `status` | string | `overdue`, `upcoming`, `ok`. Default: alla |

**Response:** `200 OK`
```json
[
  {
    "horseId": "uuid",
    "horseName": "Blansen",
    "ownerName": "Anna Svensson",
    "lastServiceDate": "2026-01-01T00:00:00.000Z",
    "serviceName": "Hovverkare",
    "intervalWeeks": 8,
    "dueDate": "2026-02-26T00:00:00.000Z",
    "status": "overdue" | "upcoming" | "ok",
    "isOverride": true
  }
]
```

**Statusberäkning (runtime):**
- `overdue`: dueDate har passerat
- `upcoming`: dueDate inom 2 veckor
- `ok`: dueDate mer än 2 veckor bort

**Errors:**
- `403` - Inte provider
- `429` - Rate limit

---

## Provider: Leverantörsanteckningar

### PUT /api/provider/bookings/[id]/notes

Uppdatera leverantörsanteckningar på en bokning.

**Auth:** Required (provider, måste äga bokningen)

**Request Body:**
```json
{
  "providerNotes": "Behandlingen gick bra, behöver uppföljning om 8 veckor" | null
}
```

**Validering:**
- `providerNotes`: string (max 2000 tecken) eller null (rensar anteckning)
- Bokningen måste ha status `confirmed` eller `completed`
- `.strict()` -- inga extra fält tillåts

**Response:** `200 OK` -- uppdaterad bokning

**Errors:**
- `400` - Valideringsfel, felaktig status (pending/cancelled)
- `404` - Bokning finns inte **eller saknar behörighet** (IDOR-skydd)
- `429` - Rate limit

> **Integritetsskydd:** `providerNotes` visas BARA för leverantören i timeline och bokningsdetaljer. Ägaren och publika vyer (hästpass) ser INTE leverantörsanteckningar.

> **Säkerhet:** `updateProviderNotesWithAuth` använder atomärt WHERE (`id + providerId`) för IDOR-skydd.

---

## Verification Requests (Leverantörsverifiering)

### GET /api/verification-requests

Lista providers egna verifieringsansökningar med bilder.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "type": "education",
    "title": "Wångens gesällprov",
    "description": "Godkänd hovslagare",
    "issuer": "Wången",
    "year": 2020,
    "status": "pending | approved | rejected",
    "reviewNote": null,
    "reviewedAt": null,
    "createdAt": "2026-01-30T10:00:00Z",
    "images": [
      { "id": "cuid", "url": "https://...", "mimeType": "image/jpeg" }
    ]
  }
]
```

### POST /api/verification-requests

Skapa verifieringsansökan.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "type": "education | organization | certificate | experience | license",
  "title": "Wångens gesällprov",
  "description": "Valfri beskrivning (max 1000 tecken)",
  "issuer": "Wången (valfritt, max 200 tecken)",
  "year": 2020
}
```

**Begränsning:** Max 5 väntande ansökningar per provider.

**Response:** `201 Created`

**Errors:**
- `400` - Max pending-gräns nådd eller valideringsfel
- `404` - Användaren har ingen provider-profil

### PUT /api/verification-requests/[id]

Redigera en pending/rejected verifieringsansökan. Rejected poster återgår automatiskt till pending.

**Auth:** Required (provider, ägare)

**Request Body:** (alla fält valfria)
```json
{
  "title": "Uppdaterad titel",
  "description": "Ny beskrivning",
  "issuer": "Ny utfärdare",
  "year": 2023,
  "type": "certificate"
}
```

**Response:** `200 OK`

**Errors:**
- `400` - Godkända verifieringar kan inte redigeras, valideringsfel
- `404` - Hittades inte eller IDOR

### DELETE /api/verification-requests/[id]

Ta bort en pending/rejected verifieringsansökan. Tar även bort tillhörande bilder.

**Auth:** Required (provider, ägare)

**Response:** `204 No Content`

**Errors:**
- `400` - Godkända verifieringar kan inte tas bort
- `404` - Hittades inte eller IDOR

---

## Admin

### GET /api/admin/verification-requests

Lista alla väntande verifieringsansökningar med provider-info, utfärdare, år och bilder.

**Auth:** Required (admin -- `isAdmin=true` på User)

**Response:** `200 OK` -- Array med verifieringar inkl. provider.businessName, issuer, year, images.

### PUT /api/admin/verification-requests/[id]

Godkänn eller avvisa verifieringsansökan.

**Auth:** Required (admin)

**Request Body:**
```json
{
  "action": "approve | reject",
  "reviewNote": "Valfri kommentar (max 500 tecken)"
}
```

**Godkänn-flöde (atomär transaction):**
1. Uppdatera ProviderVerification.status → "approved"
2. Sätt Provider.isVerified → true, verifiedAt → now()
3. Skapa notifikation till providern

**Response:** `200 OK`

**Errors:**
- `400` - Ansökan redan behandlad eller valideringsfel
- `403` - Ej admin-behörighet
- `404` - Ansökan hittades inte

---

## Group Bookings (Gruppbokningar)

Stallgemenskaper kan samordna leverantörsbesök. En kund skapar en grupprequest, andra hakar på via invite code, och leverantören matchar och skapar sekventiella bokningar.

### POST /api/group-bookings

Skapa ny grupprequest. Skaparen läggs automatiskt till som första deltagare.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb",
  "address": "Stallvägen 1, 441 91 Alingsås",
  "dateFrom": "2026-02-15T00:00:00.000Z",
  "dateTo": "2026-02-28T00:00:00.000Z",
  "maxParticipants": 6,
  "notes": "Vi har 6 hästar totalt",
  "latitude": 57.93,
  "longitude": 12.53
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "inviteCode": "ABC12345",
  "status": "open",
  "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb",
  "participants": [{ "id": "uuid", "userId": "uuid", "numberOfHorses": 1 }],
  "_count": { "participants": 1 }
}
```

**Errors:**
- `400` - Valideringsfel
- `429` - Rate limit

---

### GET /api/group-bookings

Hämta alla grupprequests där användaren är skapare eller deltagare.

**Auth:** Required (customer)

**Response:** `200 OK` -- Array med grupprequests, sorterade nyast först. Inkluderar deltagare (exkl. cancelled) och deltagarantal.

---

### GET /api/group-bookings/[id]

Hämta detaljer för en grupprequest.

**Auth:** Required (skapare, deltagare, matchad provider, eller valfri provider om öppen)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "creatorId": "uuid",
  "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb",
  "address": "Stallvägen 1",
  "dateFrom": "2026-02-15T00:00:00.000Z",
  "dateTo": "2026-02-28T00:00:00.000Z",
  "maxParticipants": 6,
  "status": "open",
  "inviteCode": "ABC12345",
  "participants": [
    {
      "id": "uuid",
      "userId": "uuid",
      "numberOfHorses": 2,
      "horseName": "Blansen",
      "notes": "Känslig på vänster fram",
      "status": "joined",
      "user": { "firstName": "Anna" },
      "horse": { "name": "Blansen" }
    }
  ],
  "provider": null,
  "_count": { "participants": 3 }
}
```

---

### PUT /api/group-bookings/[id]

Uppdatera grupprequest (bara skaparen).

**Auth:** Required (skapare)

**Request Body:**
```json
{
  "notes": "Uppdaterad info",
  "maxParticipants": 8,
  "status": "cancelled"
}
```

**Tillåtna statusövergångar:** `open` -> `cancelled`, `matched` -> `cancelled`

**Response:** `200 OK`

**Errors:**
- `400` - Ogiltig statusövergång
- `403` - Inte skapare
- `404` - Grupprequest hittades inte

---

### POST /api/group-bookings/join

Gå med i en grupprequest via invite code.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "inviteCode": "ABC12345",
  "numberOfHorses": 2,
  "horseName": "Blansen",
  "notes": "Känslig på vänster fram"
}
```

**Validering:**
- Request måste vara "open"
- Inte full (deltagare < maxParticipants)
- Join deadline inte passerad
- Användaren inte redan ansluten

**Response:** `201 Created` -- Skapad participant.

**Errors:**
- `400` - Full, redan ansluten, eller ogiltigt
- `404` - Ogiltig invite code

---

### GET /api/group-bookings/available

Hämta öppna grupprequests (för leverantörer).

**Auth:** Required (provider)

**Response:** `200 OK` -- Array med öppna grupprequests med framtida datum. Inkluderar deltagare, deltagarantal.

---

### POST /api/group-bookings/[id]/match

Leverantören matchar en grupprequest och skapar individuella bokningar.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "serviceId": "uuid",
  "bookingDate": "2026-02-20T00:00:00.000Z",
  "startTime": "09:00"
}
```

**Vad som händer:**
1. Validerar att tjänsten tillhör providern och är aktiv
2. Skapar sekventiella bokningar (participant 1: 09:00-09:45, participant 2: 09:45-10:30, etc.)
3. Uppdaterar deltagares status till "booked" och sätter bookingId
4. Ändrar request-status till "matched", sätter providerId
5. Notifierar alla deltagare

**Response:** `200 OK`
```json
{
  "message": "5 bokningar skapade",
  "bookingsCreated": 5
}
```

**Errors:**
- `400` - Tjänst ej aktiv, tillhör inte providern
- `404` - Grupprequest hittades inte

---

### DELETE /api/group-bookings/[id]/participants/[pid]

Ta bort deltagare (skaparen kan ta bort andra, deltagare kan lämna).

**Auth:** Required (skaparen eller deltagaren själv)

**Beteende:**
- Soft delete: Markerar participant som "cancelled"
- Om skaparen tar bort någon: notifierar borttagen deltagare
- Om deltagare lämnar: notifierar skaparen
- Om inga aktiva deltagare kvar: avbryter hela requesten

**Response:** `200 OK`

---

## Providers

### GET /api/providers

Sök aktiva providers med geo-filtrering.

**Auth:** Optional (publikt endpoint)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `city` | string | Filtrera på stad |
| `search` | string | Sök i namn/beskrivning |
| `latitude` | number | Latitud för geo-filtrering |
| `longitude` | number | Longitud för geo-filtrering |
| `radiusKm` | number | Sökradie i km |

**Geo-filtrering:** Om någon av latitude/longitude/radiusKm anges måste alla tre anges.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "businessName": "Hovslagare AB",
    "description": "Professionell hovslagare",
    "city": "Göteborg",
    "latitude": 57.7089,
    "longitude": 11.9746,
    "serviceAreaKm": 50,
    "isVerified": true,
    "services": [...],
    "user": {
      "firstName": "Johan",
      "lastName": "Lindengård"
    }
  }
]
```

---

### GET /api/providers/[id]

Hämta specifik provider med tjänster, tillgänglighet och verifieringsstatus.

**Auth:** Optional (publikt endpoint)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "businessName": "Hovslagare AB",
  "isVerified": true,
  "verifiedAt": "2026-01-30T12:00:00Z",
  "verifications": [
    {
      "id": "uuid",
      "type": "education",
      "title": "Wångens gesällprov",
      "description": "Godkänd hovslagare"
    }
  ],
  "services": [...],
  "availability": [...],
  "user": {
    "firstName": "Johan",
    "lastName": "Lindengård",
    "phone": "0701234567"
  }
}
```

**Errors:**
- `404` - Provider finns inte

---

### PUT /api/providers/[id]

Uppdatera provider-profil (med automatisk geocoding).

**Auth:** Required (måste äga provider-profilen)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB",
  "description": "Beskrivning",
  "address": "Storgatan 1",
  "city": "Göteborg",
  "postalCode": "41234",
  "serviceAreaKm": 50,
  "profileImageUrl": "https://..."
}
```

**Response:** `200 OK`

**Errors:**
- `400` - Valideringsfel eller kunde inte geocoda adress
- `404` - Provider finns inte **eller saknar behörighet** (atomär auth)

> **Säkerhet:** Använder atomär authorization check - returnerar 404 även vid unauthorized access för att förhindra ID-enumeration.

---

### GET /api/providers/[id]/availability

Hämta tillgänglighet för ett specifikt datum.

**Auth:** Optional

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `date` | string | Datum (YYYY-MM-DD), **Required** |

**Response:** `200 OK`
```json
{
  "date": "2026-01-25",
  "dayOfWeek": 4,
  "isClosed": false,
  "openingTime": "08:00",
  "closingTime": "17:00",
  "bookedSlots": [
    {
      "startTime": "10:00",
      "endTime": "11:00",
      "serviceName": "Skoning"
    }
  ]
}
```

---

### GET /api/providers/[id]/availability-schedule

Hämta veckans öppettider.

**Auth:** Optional

**Response:** `200 OK`
```json
[
  {
    "dayOfWeek": 0,
    "startTime": "08:00",
    "endTime": "17:00",
    "isClosed": false
  }
]
```

---

### PUT /api/providers/[id]/availability-schedule

Uppdatera öppettider.

**Auth:** Required (måste äga provider-profilen)

**Request Body:**
```json
{
  "schedule": [
    {
      "dayOfWeek": 0,
      "startTime": "08:00",
      "endTime": "17:00",
      "isClosed": false
    }
  ]
}
```

**dayOfWeek:** 0 = Måndag, 6 = Söndag

**Response:** `200 OK`

---

## Provider Profile

### GET /api/provider/profile

Hämta inloggad providers profil.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "businessName": "Hovslagare AB",
  "description": "...",
  "user": {
    "firstName": "Johan",
    "lastName": "Lindengård",
    "email": "johan@example.com",
    "phone": "0701234567"
  }
}
```

---

### PUT /api/provider/profile

Uppdatera inloggad providers profil.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB",
  "description": "Beskrivning",
  "address": "Storgatan 1",
  "city": "Göteborg",
  "postalCode": "41234",
  "serviceArea": "Västra Götaland"
}
```

**Response:** `200 OK`

---

## Route Orders

### GET /api/route-orders

Hämta ruttbeställningar.

**Auth:** Required

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `announcementType` | string | `customer_initiated` eller `provider_announced` |

- Provider + `provider_announced`: Egna annonseringar
- Customer + `customer_initiated`: Egna beställningar

**Response:** `200 OK`

---

### POST /api/route-orders

Skapa ruttbeställning (kund) eller annonsering (provider).

**Auth:** Required

#### Customer-initiated (kundbeställning):
```json
{
  "announcementType": "customer_initiated",
  "serviceType": "skoning",
  "address": "Stallgatan 5, Göteborg",
  "latitude": 57.7089,
  "longitude": 11.9746,
  "numberOfHorses": 2,
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "priority": "normal" | "urgent",
  "specialInstructions": "Parkering vid ladugården",
  "contactPhone": "0701234567"
}
```

**Validering (kund):**
- Datumspann max 30 dagar
- `urgent` måste vara inom 48 timmar

#### Provider-announced (annonsering):
```json
{
  "announcementType": "provider_announced",
  "serviceType": "skoning",
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "stops": [
    {
      "locationName": "Hästgården",
      "address": "Stallgatan 5, Göteborg",
      "latitude": 57.7089,
      "longitude": 11.9746
    }
  ],
  "specialInstructions": "Max 5 hästar per stopp"
}
```

**Validering (provider):**
- Datumspann max 14 dagar
- 1-3 stopp

**Response:** `201 Created`

---

### GET /api/route-orders/[id]

Hämta specifik ruttbeställning.

**Auth:** Optional

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "serviceType": "skoning",
  "address": "...",
  "provider": { ... },
  "routeStops": [...],
  "bookings": [...]
}
```

---

### GET /api/route-orders/available

Hämta tillgängliga beställningar (för providers).

**Auth:** Required (provider)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `serviceType` | string | Filtrera på tjänstetyp |
| `priority` | string | `normal` eller `urgent` |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "serviceType": "skoning",
    "address": "...",
    "distanceKm": 15.3,
    "customer": {
      "firstName": "Anna",
      "lastName": "Andersson",
      "phone": "0701234567"
    }
  }
]
```

---

### GET /api/route-orders/my-orders

Hämta kundens egna beställningar.

**Auth:** Required (customer)

**Response:** `200 OK`

---

### GET /api/route-orders/announcements

Sök annonseringar (för kunder).

**Auth:** Optional (publikt endpoint)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `latitude` | number | Latitud för geo-filtrering |
| `longitude` | number | Longitud för geo-filtrering |
| `radiusKm` | number | Sökradie i km |
| `serviceType` | string | Filtrera på tjänstetyp |
| `dateFrom` | string | Från datum |
| `dateTo` | string | Till datum |

**Response:** `200 OK`

---

## Routes

### POST /api/routes

Skapa ny rutt från beställningar.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "routeName": "Måndag Kungsbacka",
  "routeDate": "2026-01-27T00:00:00.000Z",
  "startTime": "08:00",
  "orderIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "routeName": "Måndag Kungsbacka",
  "routeDate": "2026-01-27T00:00:00.000Z",
  "startTime": "08:00",
  "status": "planned",
  "totalDistanceKm": 45.2,
  "totalDurationMinutes": 240,
  "stops": [...]
}
```

**Errors:**
- `400` - Valideringsfel eller beställningar ej tillgängliga

---

### GET /api/routes/[id]

Hämta specifik rutt.

**Auth:** Required (provider, måste äga rutten)

**Response:** `200 OK`

**Errors:**
- `403` - Ej din rutt
- `404` - Rutt finns inte

---

### GET /api/routes/my-routes

Hämta providers alla rutter.

**Auth:** Required (provider)

**Response:** `200 OK`

---

### PATCH /api/routes/[id]/stops/[stopId]

Uppdatera ruttens stopp-status.

**Auth:** Required (provider, måste äga rutten)

**Request Body:**
```json
{
  "status": "pending" | "in_progress" | "completed" | "problem",
  "problemNote": "Hästen var sjuk"  // Optional
}
```

**Response:** `200 OK`

---

## Services

### GET /api/services

Hämta providers tjänster.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Skoning",
    "description": "Komplett skoning",
    "price": 1200,
    "durationMinutes": 60,
    "isActive": true
  }
]
```

---

### POST /api/services

Skapa ny tjänst.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "name": "Skoning",
  "description": "Komplett skoning alla fyra",
  "price": 1200,
  "durationMinutes": 60
}
```

**Response:** `201 Created`

**Errors:**
- `429` - Rate limit (10 tjänster/timme)

---

### PUT /api/services/[id]

Uppdatera tjänst.

**Auth:** Required (provider, måste äga tjänsten)

**Request Body:**
```json
{
  "name": "Skoning",
  "description": "Komplett skoning",
  "price": 1300,
  "durationMinutes": 60,
  "isActive": true
}
```

**Response:** `200 OK`

**Errors:**
- `404` - Tjänst finns inte **eller saknar behörighet** (atomär auth)

> **Säkerhet:** Använder atomär authorization check - returnerar 404 även vid unauthorized access för att förhindra ID-enumeration.

---

### DELETE /api/services/[id]

Ta bort tjänst.

**Auth:** Required (provider, måste äga tjänsten)

**Response:** `200 OK`
```json
{ "message": "Service deleted" }
```

**Errors:**
- `404` - Tjänst finns inte **eller saknar behörighet** (atomär auth)

> **Säkerhet:** Använder atomär authorization check - returnerar 404 även vid unauthorized access för att förhindra ID-enumeration.

---

## Profile

### GET /api/profile

Hämta inloggad användares profil.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567",
  "userType": "customer" | "provider"
}
```

---

### PUT /api/profile

Uppdatera inloggad användares profil.

**Auth:** Required

**Request Body:**
```json
{
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567"
}
```

**Response:** `200 OK`

---

## Utilities

### GET /api/health

Health check för monitoring.

**Auth:** Not required

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T10:00:00.000Z",
  "checks": {
    "database": "connected"
  }
}
```

**Errors:**
- `503` - Databasanslutning misslyckades

---

### GET /api/geocode

Geocoda adress till koordinater.

**Auth:** Not required

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `address` | string | Adress att geocoda, **Required** |
| `city` | string | Stad (optional) |
| `postalCode` | string | Postnummer (optional) |

**Response:** `200 OK`
```json
{
  "latitude": 57.7089,
  "longitude": 11.9746
}
```

**Errors:**
- `400` - Address parameter saknas
- `404` - Kunde inte geocoda adress

---

### POST /api/optimize-route

Optimera ruttordning (extern tjänst).

**Auth:** Not required

**Request Body:**
```json
{
  "stops": [
    { "latitude": 57.7089, "longitude": 11.9746 },
    { "latitude": 57.6500, "longitude": 12.0000 }
  ]
}
```

**Response:** `200 OK`
```json
{
  "optimizedOrder": [0, 1],
  "totalDistance": 15.5
}
```

---

### POST /api/routing

Hämta körvägsbeskrivning från OSRM.

**Auth:** Not required

**Request Body:**
```json
{
  "coordinates": [
    [57.7089, 11.9746],
    [57.6500, 12.0000]
  ]
}
```

**Response:** `200 OK`
```json
{
  "coordinates": [[57.7089, 11.9746], ...],
  "distance": 15500,
  "duration": 1200
}
```

---

## Dataexport (GDPR)

### GET /api/export/my-data

Exportera all användardata (GDPR Art 20 portabilitet).

**Auth:** Required
**Query:** `?format=csv` (valfritt, default JSON)
**Response (JSON):** `{ exportedAt, user, horses, bookings, horseNotes, reviews, provider? }`
**Response (CSV):** Content-Disposition: attachment med bokningar + anteckningar.

### GET /api/horses/:id/export

Exportera hästdata med fullständig tidslinje.

**Auth:** Required (ägare)
**Query:** `?format=csv`
**Response (JSON):** `{ horse, bookings, notes, timeline }`

---

## Hästprofil (delbar länk)

### POST /api/horses/:id/profile

Skapa en delbar hästprofil-länk (30 dagars expiry).

**Auth:** Required (ägare)
**Response:** `201` `{ token, url, expiresAt }`

### GET /api/profile/:token

Hämta hästdata via publik token (ingen auth).

**Auth:** Inte required
**Response:** `{ horse, timeline, expiresAt }`
**Integritetsskydd:** Bara veterinär-, hovslagare- och medicinanteckningar visas.

---

## Bilduppladdning

### POST /api/upload

Ladda upp en bild (FormData: file + bucket + entityId).

**Auth:** Required
**Buckets:** avatars, horses, services, verifications
**Validering:** JPEG/PNG/WebP, max 5MB. IDOR-skydd.
**Verifications-bucket:** Max 5 bilder per verifiering. Bara pending/rejected kan få bilder. Sätter `verificationId` automatiskt.
**Response:** `201` `{ id, url, path }`

### DELETE /api/upload/:id

**Auth:** Required (uppladdaren)
**Verifierings-check:** Kan inte ta bort bilder från godkända verifieringar.
**Response:** `200` `{ success: true }`

---

## Fortnox-integration

### GET /api/integrations/fortnox/connect

Starta Fortnox OAuth-flöde. **Auth:** Required (leverantör). Redirect.

### GET /api/integrations/fortnox/callback

OAuth callback. Byter code mot tokens, sparar krypterat. Redirect.

### POST /api/integrations/fortnox/disconnect

Koppla bort Fortnox. **Auth:** Required (leverantör). `{ success: true }`

### POST /api/integrations/fortnox/sync

Synka osynkade fakturor. **Auth:** Required (leverantör). `{ synced, failed, total }`

---

## Gemensamma felkoder

| Kod | Betydelse |
|-----|-----------|
| `400` | Bad Request - Valideringsfel eller ogiltig request |
| `401` | Unauthorized - Ingen giltig session |
| `403` | Forbidden - Saknar behörighet |
| `404` | Not Found - Resursen finns inte |
| `409` | Conflict - Resurskonflikt (t.ex. dubbelbokning) |
| `429` | Too Many Requests - Rate limit överskriden |
| `500` | Internal Server Error - Serverfel |
| `503` | Service Unavailable - Tjänsten ej tillgänglig |
| `504` | Gateway Timeout - Timeout |

---

## Rate Limiting

| Endpoint | Limit | Fönster |
|----------|-------|---------|
| `/api/auth/register` | 5 requests | Per timme per IP |
| `/api/bookings` (POST) | 10 requests | Per timme per användare |
| `/api/services` (POST) | 10 requests | Per timme per provider |
| `/api/group-bookings` (POST) | 10 requests | Per timme per användare |
| `/api/group-bookings/join` (POST) | 10 requests | Per timme per användare |
| `/api/bookings/manual` (POST) | 10 requests | Per timme per provider |
| `/api/customers/search` (GET) | 30 requests | Per minut per provider |
| `/api/customers/[id]/horses` (GET) | 20 requests | Per minut per provider |

Rate limiting använder Redis (Upstash) för serverless-kompatibilitet.

---

*Senast uppdaterad: 2026-02-06 (Kundregister, återbesöksplanering, leverantörsanteckningar)*
