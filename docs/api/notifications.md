---
title: "Notiser (Notifications)"
description: "API-dokumentation for notiser: hamtning, markering som last, notistyper och dedup-logik"
category: api
tags: [api, notifications, dedup, email, in-app]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
related:
  - follows.md
  - municipality-watches.md
sections:
  - GET /api/notifications
  - POST /api/notifications
  - PUT /api/notifications/[id]
  - GET /api/notifications/unread-count
  - Notistyper
  - Ruttannonseringsnotiser
---

# Notiser (Notifications)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

---

## GET /api/notifications

Hamta notiser for inloggad anvandare.

**Auth:** Required
**Rate limiter:** `api` (100/min produktion)

**Query-parametrar:**

| Parameter | Typ | Standard | Beskrivning |
|-----------|-----|----------|-------------|
| `limit` | number | 20 | Antal notiser (1-50) |

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "BOOKING_CONFIRMED",
      "title": "Bokning bekraftad",
      "message": "Din bokning den 1 mars ar bekraftad.",
      "isRead": false,
      "metadata": { "bookingId": "uuid" },
      "createdAt": "2026-02-28T10:00:00.000Z"
    }
  ],
  "unreadCount": 5
}
```

**Felkoder:**
- `401` -- Ej inloggad
- `429` -- Rate limit
- `500` -- `"Kunde inte hamta notifikationer"`

---

## POST /api/notifications

Markera alla notiser som lasta.

**Auth:** Required
**Rate limiter:** `api` (100/min produktion)

**Request Body:** Inget (tom POST)

**Response:** `200 OK`
```json
{
  "markedAsRead": 5
}
```

**Felkoder:**
- `401` -- Ej inloggad
- `429` -- Rate limit

---

## PUT /api/notifications/[id]

Markera en enskild notis som last.

**Auth:** Required (maste aga notisen)
**Rate limiter:** `api` (100/min produktion)

**Request Body:** Inget

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "isRead": true
}
```

**Felkoder:**
- `401` -- Ej inloggad
- `404` -- Notis finns inte eller tillhor annan anvandare
- `429` -- Rate limit

---

## GET /api/notifications/unread-count

Hamta antal olasta notiser (for badge-visning).

**Auth:** Required
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "count": 5
}
```

---

## Notistyper

| Typ | Beskrivning | Mottagare |
|-----|-------------|-----------|
| `BOOKING_CONFIRMED` | Bokning bekraftad | Kund |
| `BOOKING_CANCELLED` | Bokning avbokad | Kund/Leverantor |
| `BOOKING_COMPLETED` | Bokning genomförd | Kund |
| `BOOKING_REMINDER` | Paminnelse om kommande bokning | Kund/Leverantor |
| `NEW_REVIEW` | Ny recension | Leverantör |
| `ROUTE_ANNOUNCEMENT_NEW` | Ny ruttannonsering fran foljd leverantör | Kund (foljare) |
| `ROUTE_ANNOUNCEMENT_DUE_HORSE` | Ruttannonsering + overdue hast | Kund (foljare) |
| `MUNICIPALITY_WATCH_MATCH` | Ruttannonsering matchar kommunbevakning | Kund (bevakare) |

---

## Ruttannonseringsnotiser

Nar en leverantör skapar en ruttannonsering notifieras tva malgrupper:

1. **Foljare** i kommunen -- far `ROUTE_ANNOUNCEMENT_NEW` eller `ROUTE_ANNOUNCEMENT_DUE_HORSE`
2. **Kommunbevakare** med matchande tjanstetyp -- far `MUNICIPALITY_WATCH_MATCH`

### Dedup-logik (NotificationDelivery)

En kund kan bade folja en leverantör OCH ha en kommunbevakning. For att undvika dubbelnotiser:

- Unique constraint: `[routeOrderId, customerId, channel]`
- Foljarnotis har **prioritet** over bevakningsnotis
- `exists()`-check fore varje `create()`

### Leveranskanaler

- **In-app**: Sparas i `Notification`-tabellen
- **E-post**: Skickas via Resend (eller loggad i dev)

> Se [follows.md](follows.md) och [municipality-watches.md](municipality-watches.md) for relaterade endpoints.

---

*Senast uppdaterad: 2026-02-28*
