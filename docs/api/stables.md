---
title: "Stables API"
description: "Stable profiles, spots management, and public search"
category: api
tags: [stables, api, spots, marketplace]
status: active
last_updated: 2026-03-09
depends_on:
  - docs/api/README.md
sections:
  - Publik sökning
  - Publik stallprofil
  - Stallprofil (inloggad)
  - Stallplatser (inloggad)
---

# Stall

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Stallprofiler, stallplatser och publik sökning. Gated bakom feature flag `stable_profiles`.

**URL-konvention:**
- `/api/stables/*` = publik (sökning, pluralis)
- `/api/stable/*` = auth-skyddad (ägarens stall, singularis)

---

## Publik sökning

### GET /api/stables

Sök aktiva stall med filter.

**Auth:** Ej krävd (publikt)

**Query-parametrar:**

| Param | Typ | Beskrivning |
|-------|-----|-------------|
| `search` | string | Fritextsökning (namn, beskrivning) |
| `municipality` | string | Filtrera på kommun (case-insensitive) |
| `city` | string | Filtrera på stad (case-insensitive) |
| `hasAvailableSpots` | "true" | Visa bara stall med lediga platser |

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Testgården",
      "description": "Fint stall med box och spilta",
      "city": "Göteborg",
      "municipality": "Göteborg",
      "latitude": 57.7,
      "longitude": 12.0,
      "contactEmail": "test@test.se",
      "contactPhone": "070-1234567",
      "profileImageUrl": null,
      "_count": { "spots": 5, "availableSpots": 2 }
    }
  ]
}
```

**Filtrerade fält:** userId, address, postalCode, createdAt, updatedAt exponeras inte.

---

### GET /api/stables/:stableId

Publik stallprofil med lediga platser.

**Auth:** Ej krävd (publikt)

**Response 200:**

```json
{
  "id": "uuid",
  "name": "Testgården",
  "description": "Fint stall",
  "city": "Göteborg",
  "municipality": "Göteborg",
  "latitude": 57.7,
  "longitude": 12.0,
  "contactEmail": "test@test.se",
  "contactPhone": "070-1234567",
  "profileImageUrl": null,
  "_count": { "spots": 5, "availableSpots": 2 },
  "availableSpots": [
    {
      "id": "uuid",
      "label": "Box 1",
      "pricePerMonth": 5000,
      "availableFrom": null,
      "notes": "Stor box"
    }
  ]
}
```

- Bara lediga platser (`status: "available"`) returneras
- `404` om stallet inte finns eller inte är aktivt

---

## Stallprofil (inloggad)

### POST /api/stable/profile

Skapa stallprofil.

**Auth:** Krävd (session)

**Body:** `createStableSchema` (Zod `.strict()`)

```json
{
  "name": "Mitt Stall",
  "description": "Beskrivning",
  "municipality": "Göteborg",
  "city": "Mölndal",
  "contactEmail": "stall@example.com"
}
```

**Response:** `201` med `{ stableId, name, ... }`, `409` om användaren redan har ett stall.

### GET /api/stable/profile

Hämta inloggad användares stallprofil.

**Auth:** Krävd

**Response:** `200` med stalldata, `404` om inget stall finns.

### PUT /api/stable/profile

Uppdatera stallprofil.

**Auth:** Krävd

**Body:** `updateStableSchema` (Zod `.strict()`, partial)

**Response:** `200` med uppdaterad stalldata, `404` om inget stall finns.

---

## Stallplatser (inloggad)

### GET /api/stable/spots

Lista alla stallplatser för ägarens stall.

**Auth:** Krävd

**Response:** `200` med `{ spots: [...], _count: { total, available } }`

### POST /api/stable/spots

Skapa ny stallplats.

**Auth:** Krävd

**Body:** `createStableSpotSchema` (Zod `.strict()`)

```json
{
  "label": "Box 3",
  "status": "available",
  "pricePerMonth": 5000,
  "availableFrom": "2026-04-01",
  "notes": "Stor box med utsikt"
}
```

**Response:** `201` med skapad plats.

### PUT /api/stable/spots/:spotId

Uppdatera stallplats (status, pris, etc).

**Auth:** Krävd (ownership via stableId)

### DELETE /api/stable/spots/:spotId

Ta bort stallplats.

**Auth:** Krävd (ownership via stableId)

**Response:** `200` med `{ deleted: true }`, `404` om platsen inte finns.
