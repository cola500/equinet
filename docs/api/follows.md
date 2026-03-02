---
title: "Foljare (Follows)"
description: "API-dokumentation for att folja leverantorer och fa ruttannonseringsnotiser"
category: api
tags: [api, follows, notifications, feature-flag]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
related:
  - notifications.md
  - municipality-watches.md
sections:
  - POST /api/follows
  - GET /api/follows
  - GET /api/follows/[providerId]
  - DELETE /api/follows/[providerId]
  - Koppling till ruttannonseringar
---

# Foljare (Follows)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

**Feature flag:** `follow_provider` maste vara aktiverad.

Kunder kan folja leverantorer for att fa notiser vid nya ruttannonseringar.

---

## POST /api/follows

Folj en leverantor.

**Auth:** Required (customer)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "providerId": "a0000000-0000-4000-a000-000000000001"
}
```

**Validering:**
- `providerId`: Giltig UUID

**Response:** `201 Created`
```json
{
  "customerId": "uuid",
  "providerId": "uuid",
  "createdAt": "2026-02-28T10:00:00.000Z"
}
```

**Felkoder:**
- `400` -- Valideringsfel eller `"Leverantoren ar inte aktiv"`
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad eller `"Leverantor hittades inte"`
- `429` -- Rate limit

> Operationen ar idempotent -- att folja en redan foljd leverantor returnerar framgang.

---

## GET /api/follows

Lista alla foljda leverantorer for inloggad kund.

**Auth:** Required (customer)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
[
  {
    "customerId": "uuid",
    "providerId": "uuid",
    "createdAt": "2026-02-28T10:00:00.000Z",
    "provider": {
      "id": "uuid",
      "businessName": "Hovslagare AB",
      "description": "Erfaren hovslagare i Skane",
      "profileImageUrl": "https://..."
    }
  }
]
```

**Felkoder:**
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit

---

## GET /api/follows/[providerId]

Kontrollera foljstatus och antal foljare for en leverantor.

**Auth:** Required (alla roller)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "isFollowing": true,
  "followerCount": 42
}
```

> `isFollowing` ar alltid `false` for icke-kunder (providers, admins).

**Felkoder:**
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit

---

## DELETE /api/follows/[providerId]

Sluta folja en leverantor.

**Auth:** Required (customer)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "success": true
}
```

> Operationen ar idempotent -- att avfolja en ej foljd leverantor returnerar framgang.

**Felkoder:**
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit

---

## Koppling till ruttannonseringar

Nar en leverantor skapar en ruttannonsering notifieras alla foljare i relevant kommun via:
- **In-app-notis** (typ `ROUTE_ANNOUNCEMENT_NEW`)
- **E-postnotis** med information om leverantoren och rutten

Om kunden har hastar som ar overdue for den annonserade tjansten inkluderas denna information i notisen.

> Se [notifications.md](notifications.md) for detaljer om NotificationDelivery och dedup-logik.

---

*Senast uppdaterad: 2026-02-28*
