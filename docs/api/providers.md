# Leverantorer

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Leverantorsprofil, tjanster, tillganglighet, aterbesoksintervall, besoksplanering, verifieringar och integrationer.

---

## Sokning & Detaljer

### GET /api/providers

Sok aktiva providers med geo-filtrering.

**Auth:** Ej kravd (publikt)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `city` | string | Filtrera pa stad |
| `search` | string | Sok i namn/beskrivning |
| `latitude` | number | Latitud for geo-filtrering |
| `longitude` | number | Longitud for geo-filtrering |
| `radiusKm` | number | Sokradie i km |

> Om nagon av latitude/longitude/radiusKm anges maste alla tre anges.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "businessName": "Hovslagare AB",
    "description": "Professionell hovslagare", "city": "Goteborg",
    "latitude": 57.7089, "longitude": 11.9746, "serviceAreaKm": 50,
    "isVerified": true, "services": [...],
    "user": { "firstName": "Johan", "lastName": "Lindengard" }
  }
]
```

### GET /api/providers/[id]

Hamta specifik provider med tjanster, tillganglighet och verifieringsstatus.

**Auth:** Ej kravd (publikt)

**Response:** `200 OK`
```json
{
  "id": "uuid", "businessName": "Hovslagare AB",
  "isVerified": true, "verifiedAt": "2026-01-30T12:00:00Z",
  "verifications": [{ "id": "uuid", "type": "education", "title": "Wangens gesallprov" }],
  "services": [...], "availability": [...],
  "user": { "firstName": "Johan", "lastName": "Lindengard", "phone": "0701234567" }
}
```

### PUT /api/providers/[id]

Uppdatera provider-profil (med automatisk geocoding).

**Auth:** Required (maste aga provider-profilen)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB", "description": "Beskrivning",
  "address": "Storgatan 1", "city": "Goteborg", "postalCode": "41234",
  "serviceAreaKm": 50, "profileImageUrl": "https://..."
}
```

**Felkoder:**
- `400` -- Valideringsfel eller kunde inte geocoda adress
- `404` -- Provider finns inte eller saknar behorighet (atomar auth)

---

## Provider-profil (inloggad)

### GET /api/provider/profile

Hamta inloggad providers profil.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
{
  "id": "uuid", "businessName": "Hovslagare AB", "description": "...",
  "user": { "firstName": "Johan", "lastName": "Lindengard", "email": "...", "phone": "..." }
}
```

### PUT /api/provider/profile

Uppdatera inloggad providers profil.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "businessName": "Hovslagare AB", "description": "Beskrivning",
  "address": "Storgatan 1", "city": "Goteborg", "postalCode": "41234",
  "serviceArea": "Vastra Gotaland", "acceptingNewCustomers": false
}
```

| Falt | Typ | Beskrivning |
|------|-----|-------------|
| `acceptingNewCustomers` | boolean (optional) | Stang/oppna for nya kunder. Default `true`. Nar `false` kan bara kunder med minst 1 slutford bokning boka nya tider. |

---

## Tillganglighet

### GET /api/providers/[id]/availability

Hamta tillganglighet for ett specifikt datum.

**Auth:** Ej kravd

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

Hamta veckans oppettider.

**Auth:** Ej kravd

**Response:** `200 OK`
```json
[{ "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false }]
```

### PUT /api/providers/[id]/availability-schedule

Uppdatera oppettider.

**Auth:** Required (maste aga provider-profilen)

**Request Body:**
```json
{
  "schedule": [{ "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false }]
}
```

> `dayOfWeek`: 0 = Mandag, 6 = Sondag

---

## Tjanster (Services)

### GET /api/services

Hamta providers tjanster.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[{ "id": "uuid", "name": "Skoning", "description": "Komplett skoning", "price": 1200, "durationMinutes": 60, "isActive": true }]
```

### POST /api/services

Skapa ny tjanst.

**Auth:** Required (provider)

**Request Body:**
```json
{ "name": "Skoning", "description": "Komplett skoning alla fyra", "price": 1200, "durationMinutes": 60 }
```

**Response:** `201 Created`

**Felkoder:** `429` -- Rate limit (10 tjanster/timme)

### PUT /api/services/[id]

Uppdatera tjanst.

**Auth:** Required (provider, maste aga tjansten)

**Request Body:**
```json
{ "name": "Skoning", "description": "Komplett skoning", "price": 1300, "durationMinutes": 60, "isActive": true }
```

**Response:** `200 OK`

### DELETE /api/services/[id]

**Auth:** Required (provider, maste aga tjansten)

**Response:** `200 OK` `{ "message": "Service deleted" }`

---

## Aterbesoksintervall

### GET /api/provider/horses/[horseId]/interval

Hamta aterbesoksintervall for en hast (provider-specifikt override).

**Auth:** Required (provider med bokning for hasten)

**Response:** `200 OK`
```json
{ "horseId": "uuid", "providerId": "uuid", "intervalWeeks": 8 }
```

### PUT /api/provider/horses/[horseId]/interval

Satt eller uppdatera aterbesoksintervall (upsert).

**Auth:** Required (provider med bokning for hasten)

**Request Body:**
```json
{ "intervalWeeks": 8 }
```

**Validering:** `intervalWeeks` heltal, 1-52.

**Response:** `200 OK`

### DELETE /api/provider/horses/[horseId]/interval

Ta bort aterbesoksintervall (aterstall till tjanstens default).

**Auth:** Required (provider med bokning for hasten)

**Response:** `200 OK` `{ "message": "Interval removed" }`

---

## Besoksplanering

### GET /api/provider/due-for-service

Hamta hastar som behover aterbesok, sorterade efter angelagenhet.

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

**Statusberakning (runtime):**
- `overdue`: dueDate har passerat
- `upcoming`: dueDate inom 2 veckor
- `ok`: dueDate mer an 2 veckor bort

---

## Leverantorsanteckningar pa bokningar

### PUT /api/provider/bookings/[id]/notes

Uppdatera leverantorsanteckningar pa en bokning.

**Auth:** Required (provider, maste aga bokningen)

**Request Body:**
```json
{ "providerNotes": "Behandlingen gick bra, behover uppfoljning om 8 veckor" }
```

**Validering:**
- `providerNotes`: string (max 2000 tecken) eller null (rensar anteckning)
- Bokningen maste ha status `confirmed` eller `completed`
- `.strict()`

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel, felaktig status (pending/cancelled)
- `404` -- Bokning finns inte eller saknar behorighet (IDOR-skydd)

> `providerNotes` visas BARA for leverantoren. Kunder och publika vyer ser INTE detta.

---

## Verifieringsansokningar

### GET /api/verification-requests

Lista providers egna verifieringsansokningar med bilder.

**Auth:** Required (provider)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "type": "education", "title": "Wangens gesallprov",
    "description": "Godkand hovslagare", "issuer": "Wangen", "year": 2020,
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
  "title": "Wangens gesallprov",
  "description": "Valfri beskrivning (max 1000 tecken)",
  "issuer": "Wangen (valfritt, max 200 tecken)",
  "year": 2020
}
```

**Begransning:** Max 5 vantande ansokningar per provider.

**Response:** `201 Created`

### PUT /api/verification-requests/[id]

Redigera pending/rejected ansokan. Rejected atergpr automatiskt till pending.

**Auth:** Required (provider, agare)

**Request Body:** Alla falt valfria.

**Felkoder:**
- `400` -- Godkanda verifieringar kan inte redigeras

### DELETE /api/verification-requests/[id]

Ta bort pending/rejected ansokan. Tar aven bort bilder.

**Auth:** Required (provider, agare)

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
**Verifierings-check:** Kan inte ta bort bilder fran godkanda verifieringar.

**Response:** `200 OK` `{ "success": true }`

---

## Fortnox-integration

### GET /api/integrations/fortnox/connect

Starta Fortnox OAuth-flode. **Auth:** Required (leverantor). Redirect.

### GET /api/integrations/fortnox/callback

OAuth callback. Byter code mot tokens, sparar krypterat. Redirect.

### POST /api/integrations/fortnox/disconnect

Koppla bort Fortnox. **Auth:** Required (leverantor). `{ "success": true }`

### POST /api/integrations/fortnox/sync

Synka osynkade fakturor. **Auth:** Required (leverantor). `{ "synced": 0, "failed": 0, "total": 0 }`
