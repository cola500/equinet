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
    "service": { ... },
    "provider": { ... }
  }
]
```

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
- `409` - Tidskollision med annan bokning
- `429` - Rate limit (10 bokningar/timme)

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

Hämta specifik provider med tjänster och tillgänglighet.

**Auth:** Optional (publikt endpoint)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "businessName": "Hovslagare AB",
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

Rate limiting använder Redis (Upstash) för serverless-kompatibilitet.

---

*Senast uppdaterad: 2026-01-28*
