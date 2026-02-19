# Rutter & Ruttbeställningar

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Ruttbeställningar (kunder begär besök, leverantörer annonserar rutter) och rutthantering (leverantören planerar och genomför rutter).

---

## Ruttbeställningar

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

#### Customer-initiated:
```json
{
  "announcementType": "customer_initiated",
  "serviceType": "skoning",
  "address": "Stallgatan 5, Göteborg",
  "latitude": 57.7089, "longitude": 11.9746,
  "numberOfHorses": 2,
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "priority": "normal" | "urgent",
  "specialInstructions": "Parkering vid ladugården",
  "contactPhone": "0701234567"
}
```

**Validering (kund):** Datumspann max 30 dagar. `urgent` måste vara inom 48 timmar.

#### Provider-announced:
```json
{
  "announcementType": "provider_announced",
  "serviceType": "skoning",
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "stops": [
    { "locationName": "Hästgården", "address": "Stallgatan 5", "latitude": 57.7089, "longitude": 11.9746 }
  ],
  "specialInstructions": "Max 5 hästar per stopp"
}
```

**Validering (provider):** Datumspann max 14 dagar. 1-3 stopp.

**Response:** `201 Created`

---

### GET /api/route-orders/[id]

Hämta specifik ruttbeställning.

**Auth:** Ej krävd

**Response:** `200 OK`
```json
{
  "id": "uuid", "serviceType": "skoning", "address": "...",
  "provider": { ... }, "routeStops": [...], "bookings": [...]
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
    "id": "uuid", "serviceType": "skoning", "address": "...", "distanceKm": 15.3,
    "customer": { "firstName": "Anna", "lastName": "Andersson", "phone": "0701234567" }
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

**Auth:** Ej krävd (publikt)

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
```json
[
  {
    "id": "uuid",
    "serviceType": "skoning",
    "dateFrom": "2026-01-25T00:00:00.000Z",
    "dateTo": "2026-01-30T00:00:00.000Z",
    "provider": { "businessName": "...", "firstName": "..." },
    "routeStops": [
      { "locationName": "Hästgården", "address": "Stallgatan 5" }
    ],
    "services": [
      { "id": "uuid", "name": "Skoning", "price": 1500, "durationMinutes": 60 }
    ]
  }
]
```

> `services` inkluderar pris och tidsåtgång, visas som chips i kundvyn.
> Kunder kan filtrera på `serviceType` och datum (`dateFrom`/`dateTo`). Dagar utanför annonsperioden gråas ut i kalendern.

---

## Rutter

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
  "id": "uuid", "routeName": "Måndag Kungsbacka",
  "routeDate": "2026-01-27T00:00:00.000Z", "startTime": "08:00",
  "status": "planned", "totalDistanceKm": 45.2, "totalDurationMinutes": 240,
  "stops": [...]
}
```

---

### GET /api/routes/[id]

Hämta specifik rutt.

**Auth:** Required (provider, måste äga rutten)

**Felkoder:** `403` -- Ej din rutt

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
  "problemNote": "Hästen var sjuk"
}
```

**Response:** `200 OK`
