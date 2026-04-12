---
title: "Kommunbevakningar (Municipality Watches)"
description: "API-dokumentation for kommunbevakningar som notifierar kunder vid matchande ruttannonseringar"
category: api
tags: [api, municipality-watch, notifications, feature-flag]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
related:
  - notifications.md
  - follows.md
sections:
  - POST /api/municipality-watches
  - GET /api/municipality-watches
  - DELETE /api/municipality-watches/[id]
  - Koppling till ruttannonseringar
---

# Kommunbevakningar (Municipality Watches)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

**Feature flag:** `municipality_watch` maste vara aktiverad.

Kunder kan bevaka kommuner for specifika tjanstetyper. Nar en leverantör skapar en ruttannonsering i en bevakad kommun (med matchande tjanstetyp) skickas en notis.

---

## POST /api/municipality-watches

Skapa ny kommunbevakning.

**Auth:** Required (customer)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "municipality": "Lund",
  "serviceTypeName": "Hovvard"
}
```

**Validering:**
- `municipality`: Obligatorisk, icke-tom strang
- `serviceTypeName`: Obligatorisk, 1--100 tecken

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "userId": "uuid",
  "municipality": "Lund",
  "serviceTypeName": "Hovvard",
  "createdAt": "2026-02-28T10:00:00.000Z"
}
```

**Felkoder:**
- `400` -- Valideringsfel, `"Ogiltig kommun"`, `"Ogiltig tjanstetyp"` eller `"Max antal bevakningar uppnatt (10)"`
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit

> Max 10 bevakningar per kund.

---

## GET /api/municipality-watches

Lista kundens bevakningar.

**Auth:** Required (customer)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "municipality": "Lund",
    "serviceTypeName": "Hovvard",
    "createdAt": "2026-02-28T10:00:00.000Z"
  }
]
```

**Felkoder:**
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad
- `429` -- Rate limit

---

## DELETE /api/municipality-watches/[id]

Ta bort en kommunbevakning.

**Auth:** Required (customer, maste aga bevakningen)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Felkoder:**
- `403` -- Inte kund
- `404` -- Feature flag avaktiverad eller bevakningen finns inte
- `429` -- Rate limit

---

## Koppling till ruttannonseringar

Nar en leverantör skapar en ruttannonsering:
1. Systemet kontrollerar om det finns bevakare i den kommun annonseringen galler
2. Bevakare med matchande `serviceTypeName` far en `MUNICIPALITY_WATCH_MATCH`-notis
3. Om bevakaren aven foljer leverantören far de foljarnotisen (som har prioritet), inte bevakningsnotisen

> Se [notifications.md](notifications.md) for dedup-logik och [follows.md](follows.md) for foljar-prioritet.

---

*Senast uppdaterad: 2026-02-28*
