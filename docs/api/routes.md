# Rutter & Ruttbestallningar

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Ruttbestallningar (kunder begor besok, leverantorer annonserar rutter) och rutthantering (leverantoren planerar och genomfor rutter).

---

## Ruttbestallningar

### GET /api/route-orders

Hamta ruttbestallningar.

**Auth:** Required

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `announcementType` | string | `customer_initiated` eller `provider_announced` |

- Provider + `provider_announced`: Egna annonseringar
- Customer + `customer_initiated`: Egna bestallningar

**Response:** `200 OK`

---

### POST /api/route-orders

Skapa ruttbestallning (kund) eller annonsering (provider).

**Auth:** Required

#### Customer-initiated:
```json
{
  "announcementType": "customer_initiated",
  "serviceType": "skoning",
  "address": "Stallgatan 5, Goteborg",
  "latitude": 57.7089, "longitude": 11.9746,
  "numberOfHorses": 2,
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "priority": "normal" | "urgent",
  "specialInstructions": "Parkering vid ladugarden",
  "contactPhone": "0701234567"
}
```

**Validering (kund):** Datumspann max 30 dagar. `urgent` maste vara inom 48 timmar.

#### Provider-announced:
```json
{
  "announcementType": "provider_announced",
  "serviceType": "skoning",
  "dateFrom": "2026-01-25T00:00:00.000Z",
  "dateTo": "2026-01-30T00:00:00.000Z",
  "stops": [
    { "locationName": "Hastgarden", "address": "Stallgatan 5", "latitude": 57.7089, "longitude": 11.9746 }
  ],
  "specialInstructions": "Max 5 hastar per stopp"
}
```

**Validering (provider):** Datumspann max 14 dagar. 1-3 stopp.

**Response:** `201 Created`

---

### GET /api/route-orders/[id]

Hamta specifik ruttbestallning.

**Auth:** Ej kravd

**Response:** `200 OK`
```json
{
  "id": "uuid", "serviceType": "skoning", "address": "...",
  "provider": { ... }, "routeStops": [...], "bookings": [...]
}
```

---

### GET /api/route-orders/available

Hamta tillgangliga bestallningar (for providers).

**Auth:** Required (provider)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `serviceType` | string | Filtrera pa tjanstetyp |
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

Hamta kundens egna bestallningar.

**Auth:** Required (customer)

**Response:** `200 OK`

---

### GET /api/route-orders/announcements

Sok annonseringar (for kunder).

**Auth:** Ej kravd (publikt)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `latitude` | number | Latitud for geo-filtrering |
| `longitude` | number | Longitud for geo-filtrering |
| `radiusKm` | number | Sokradie i km |
| `serviceType` | string | Filtrera pa tjanstetyp |
| `dateFrom` | string | Fran datum |
| `dateTo` | string | Till datum |

**Response:** `200 OK`

---

## Rutter

### POST /api/routes

Skapa ny rutt fran bestallningar.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "routeName": "Mandag Kungsbacka",
  "routeDate": "2026-01-27T00:00:00.000Z",
  "startTime": "08:00",
  "orderIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid", "routeName": "Mandag Kungsbacka",
  "routeDate": "2026-01-27T00:00:00.000Z", "startTime": "08:00",
  "status": "planned", "totalDistanceKm": 45.2, "totalDurationMinutes": 240,
  "stops": [...]
}
```

---

### GET /api/routes/[id]

Hamta specifik rutt.

**Auth:** Required (provider, maste aga rutten)

**Felkoder:** `403` -- Ej din rutt

---

### GET /api/routes/my-routes

Hamta providers alla rutter.

**Auth:** Required (provider)

**Response:** `200 OK`

---

### PATCH /api/routes/[id]/stops/[stopId]

Uppdatera ruttens stopp-status.

**Auth:** Required (provider, maste aga rutten)

**Request Body:**
```json
{
  "status": "pending" | "in_progress" | "completed" | "problem",
  "problemNote": "Hasten var sjuk"
}
```

**Response:** `200 OK`
