# Leverantörer

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Leverantörsprofil, tjänster, tillgänglighet, återbesöksintervall, besöksplanering, verifieringar och integrationer.

---

## Sökning & Detaljer

### GET /api/providers

Sök aktiva providers med geo-filtrering.

**Auth:** Ej krävd (publikt)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `city` | string | Filtrera på stad |
| `search` | string | Sök i namn/beskrivning |
| `latitude` | number | Latitud för geo-filtrering |
| `longitude` | number | Longitud för geo-filtrering |
| `radiusKm` | number | Sökradie i km |

> Om någon av latitude/longitude/radiusKm anges måste alla tre anges.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "businessName": "Hovslagare AB",
    "description": "Professionell hovslagare", "city": "Göteborg",
    "latitude": 57.7089, "longitude": 11.9746, "serviceAreaKm": 50,
    "isVerified": true, "services": [...],
    "user": { "firstName": "Johan", "lastName": "Lindengård" }
  }
]
```

### GET /api/providers/[id]

Hämta specifik provider med tjänster, tillgänglighet och verifieringsstatus.

**Auth:** Ej krävd (publikt)

**Response:** `200 OK`
```json
{
  "id": "uuid", "businessName": "Hovslagare AB",
  "isVerified": true, "verifiedAt": "2026-01-30T12:00:00Z",
  "verifications": [{ "id": "uuid", "type": "education", "title": "Wångens gesällprov" }],
  "services": [...], "availability": [...],
  "user": { "firstName": "Johan", "lastName": "Lindengård", "phone": "0701234567" }
}
```

### PUT /api/providers/[id]

Uppdatera provider-profil (med automatisk geocoding).

**Auth:** Required (måste äga provider-profilen)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB", "description": "Beskrivning",
  "address": "Storgatan 1", "city": "Göteborg", "postalCode": "41234",
  "serviceAreaKm": 50, "profileImageUrl": "https://..."
}
```

**Felkoder:**
- `400` -- Valideringsfel eller kunde inte geocoda adress
- `404` -- Provider finns inte eller saknar behörighet (atomär auth)

---

## Provider-profil (inloggad)

### GET /api/provider/profile

Hämta inloggad providers profil.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
{
  "id": "uuid", "businessName": "Hovslagare AB", "description": "...",
  "user": { "firstName": "Johan", "lastName": "Lindengård", "email": "...", "phone": "..." }
}
```

### PUT /api/provider/profile

Uppdatera inloggad providers profil.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB", "description": "Beskrivning",
  "address": "Storgatan 1", "city": "Göteborg", "postalCode": "41234",
  "serviceArea": "Västra Götaland", "acceptingNewCustomers": false
}
```

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `acceptingNewCustomers` | boolean (optional) | Stäng/öppna för nya kunder. Default `true`. När `false` kan bara kunder med minst 1 slutförd bokning boka nya tider. |

---

## Tillgänglighet

### GET /api/providers/[id]/availability

Hämta tillgänglighet för ett specifikt datum.

**Auth:** Ej krävd

**Query:** `date` (YYYY-MM-DD, obligatoriskt)

**Response:** `200 OK`
```json
{
  "date": "2026-01-25", "dayOfWeek": 4, "isClosed": false,
  "openingTime": "08:00", "closingTime": "17:00",
  "bookedSlots": [{ "startTime": "10:00", "endTime": "11:00", "serviceName": "Skoning" }]
}
```

### GET /api/providers/[id]/availability-schedule

Hämta veckans öppettider.

**Auth:** Ej krävd

**Response:** `200 OK`
```json
[{ "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false }]
```

### PUT /api/providers/[id]/availability-schedule

Uppdatera öppettider.

**Auth:** Required (måste äga provider-profilen)

**Request Body:**
```json
{
  "schedule": [{ "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false }]
}
```

> `dayOfWeek`: 0 = Måndag, 6 = Söndag

---

## Tjänster (Services)

### GET /api/services

Hämta providers tjänster.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[{ "id": "uuid", "name": "Skoning", "description": "Komplett skoning", "price": 1200, "durationMinutes": 60, "isActive": true }]
```

### POST /api/services

Skapa ny tjänst.

**Auth:** Required (provider)

**Request Body:**
```json
{ "name": "Skoning", "description": "Komplett skoning alla fyra", "price": 1200, "durationMinutes": 60 }
```

**Response:** `201 Created`

**Felkoder:** `429` -- Rate limit (10 tjänster/timme)

### PUT /api/services/[id]

Uppdatera tjänst.

**Auth:** Required (provider, måste äga tjänsten)

**Request Body:**
```json
{ "name": "Skoning", "description": "Komplett skoning", "price": 1300, "durationMinutes": 60, "isActive": true }
```

**Response:** `200 OK`

### DELETE /api/services/[id]

**Auth:** Required (provider, måste äga tjänsten)

**Response:** `200 OK` `{ "message": "Service deleted" }`

---

## Återbesöksintervall

### GET /api/provider/horses/[horseId]/interval

Hämta återbesöksintervall för en häst (provider-specifikt override).

**Auth:** Required (provider med bokning för hästen)

**Response:** `200 OK`
```json
{ "horseId": "uuid", "providerId": "uuid", "intervalWeeks": 8 }
```

### PUT /api/provider/horses/[horseId]/interval

Sätt eller uppdatera återbesöksintervall (upsert).

**Auth:** Required (provider med bokning för hästen)

**Request Body:**
```json
{ "intervalWeeks": 8 }
```

**Validering:** `intervalWeeks` heltal, 1-52.

**Response:** `200 OK`

### DELETE /api/provider/horses/[horseId]/interval

Ta bort återbesöksintervall (återställ till tjänstens default).

**Auth:** Required (provider med bokning för hästen)

**Response:** `200 OK` `{ "message": "Interval removed" }`

---

## Besöksplanering

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
    "horseId": "uuid", "horseName": "Blansen", "ownerName": "Anna Svensson",
    "lastServiceDate": "2026-01-01T00:00:00.000Z", "serviceName": "Hovverkare",
    "intervalWeeks": 8, "dueDate": "2026-02-26T00:00:00.000Z",
    "status": "overdue" | "upcoming" | "ok", "isOverride": true
  }
]
```

**Statusberäkning (runtime):**
- `overdue`: dueDate har passerat
- `upcoming`: dueDate inom 2 veckor
- `ok`: dueDate mer än 2 veckor bort

---

## Leverantörsanteckningar på bokningar

### PUT /api/provider/bookings/[id]/notes

Uppdatera leverantörsanteckningar på en bokning.

**Auth:** Required (provider, måste äga bokningen)

**Request Body:**
```json
{ "providerNotes": "Behandlingen gick bra, behöver uppföljning om 8 veckor" }
```

**Validering:**
- `providerNotes`: string (max 2000 tecken) eller null (rensar anteckning)
- Bokningen måste ha status `confirmed` eller `completed`
- `.strict()`

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel, felaktig status (pending/cancelled)
- `404` -- Bokning finns inte eller saknar behörighet (IDOR-skydd)

> `providerNotes` visas BARA för leverantören. Kunder och publika vyer ser INTE detta.

---

## Verifieringsansökningar

### GET /api/verification-requests

Lista providers egna verifieringsansökningar med bilder.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "type": "education", "title": "Wångens gesällprov",
    "description": "Godkänd hovslagare", "issuer": "Wången", "year": 2020,
    "status": "pending | approved | rejected", "reviewNote": null,
    "createdAt": "2026-01-30T10:00:00Z",
    "images": [{ "id": "cuid", "url": "https://...", "mimeType": "image/jpeg" }]
  }
]
```

### POST /api/verification-requests

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

### PUT /api/verification-requests/[id]

Redigera pending/rejected ansökan. Rejected återgår automatiskt till pending.

**Auth:** Required (provider, ägare)

**Request Body:** Alla fält valfria.

**Felkoder:**
- `400` -- Godkända verifieringar kan inte redigeras

### DELETE /api/verification-requests/[id]

Ta bort pending/rejected ansökan. Tar även bort bilder.

**Auth:** Required (provider, ägare)

**Response:** `204 No Content`

---

## Bilduppladdning

### POST /api/upload

Ladda upp en bild (FormData: file + bucket + entityId).

**Auth:** Required
**Buckets:** avatars, horses, services, verifications
**Validering:** JPEG/PNG/WebP, max 5MB. IDOR-skydd.
**Verifications-bucket:** Max 5 bilder per verifiering. Bara pending/rejected.

**Response:** `201 Created` `{ "id": "...", "url": "...", "path": "..." }`

### DELETE /api/upload/[id]

**Auth:** Required (uppladdaren)
**Verifierings-check:** Kan inte ta bort bilder från godkända verifieringar.

**Response:** `200 OK` `{ "success": true }`

---

## Fortnox-integration

### GET /api/integrations/fortnox/connect

Starta Fortnox OAuth-flöde. **Auth:** Required (leverantör). Redirect.

### GET /api/integrations/fortnox/callback

OAuth callback. Byter code mot tokens, sparar krypterat. Redirect.

### POST /api/integrations/fortnox/disconnect

Koppla bort Fortnox. **Auth:** Required (leverantör). `{ "success": true }`

### POST /api/integrations/fortnox/sync

Synka osynkade fakturor. **Auth:** Required (leverantör). `{ "synced": 0, "failed": 0, "total": 0 }`
