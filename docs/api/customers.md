# Kunder

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Endpoints for providers att hantera sin kunddata. Alla krav provider-session.

---

## GET /api/customers/search

Sok bland kunder som har bokat med denna provider.

**Auth:** Required (provider-only)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `q` | string | Sokterm (min 2 tecken), **Required** |

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

**Begransningar:** Max 10 resultat. Soker i firstName, lastName, email. Exkluderar ghost users. Bara kunder med minst en bokning med providern.

**Felkoder:**
- `400` -- Sokterm for kort (min 2 tecken)
- `403` -- Inte provider
- `429` -- Rate limit (30/min)

---

## GET /api/customers/[id]/horses

Hamta en kunds aktiva hastar.

**Auth:** Required (provider-only, maste ha bokningsrelation med kunden)

**Response:** `200 OK`
```json
[
  { "id": "uuid", "name": "Blansen", "breed": "Svenskt varmblod", "birthYear": 2018, "gender": "gelding" }
]
```

**Felkoder:**
- `403` -- Inte provider, eller saknar bokningsrelation (IDOR-skydd)
- `429` -- Rate limit (20/min)

---

## GET /api/provider/customers

Hamta leverantorens kundregister (harledd fran bokningar).

**Auth:** Required (provider)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `status` | string | `active` (senaste 6 man) eller `inactive`. Default: alla |
| `search` | string | Fritextsokning i namn |

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
    "horses": [{ "id": "uuid", "name": "Blansen" }]
  }
]
```

> Bara kunder med completed bokningar for denna provider visas (plus manuellt tillagda).

---

## POST /api/provider/customers

Registrera en kund manuellt.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "name": "Anna Svensson",
  "phone": "0701234567",
  "email": "anna@example.com"
}
```

| Falt | Typ | Validering |
|------|-----|------------|
| `name` | string | Obligatoriskt, 1-100 tecken |
| `phone` | string | Valfritt, max 20 tecken |
| `email` | string | Valfritt, giltig e-postadress |

**Response:** `201 Created`

---

## DELETE /api/provider/customers/[customerId]

Ta bort en manuellt registrerad kund.

**Auth:** Required (provider, maste vara kunden som provider skapat)

**Response:** `200 OK`

**Felkoder:**
- `403` -- Inte provider, eller kunden skapades inte manuellt
- `404` -- Kund hittades inte

---

## Kundanteckningar

### GET /api/provider/customers/[customerId]/notes

Hamta leverantorens privata anteckningar om en kund.

**Auth:** Required (provider-only, maste ha completed booking med kunden)

**Response:** `200 OK`
```json
{
  "notes": [
    {
      "id": "uuid",
      "providerId": "uuid",
      "customerId": "uuid",
      "content": "Behover extra tid vid besok",
      "createdAt": "2026-02-10T14:30:00.000Z",
      "updatedAt": "2026-02-10T14:30:00.000Z"
    }
  ]
}
```

### POST /api/provider/customers/[customerId]/notes

Skapa ny anteckning.

**Auth:** Required (provider-only, maste ha completed booking)

**Request Body:**
```json
{ "content": "Kunden behover extra tid vid besok" }
```

| Falt | Typ | Validering |
|------|-----|------------|
| `content` | string | Min 1, max 2000 tecken. Saniteras (XSS + multiline). `.strict()` |

**Response:** `201 Created`

### PUT /api/provider/customers/[customerId]/notes/[noteId]

Redigera en befintlig anteckning.

**Auth:** Required (provider-only, atomar agarskapscheck)

**Request Body:** Samma som POST.

**Response:** `200 OK` (inkl. `updatedAt`)

**Felkoder:**
- `404` -- Anteckningen hittades inte (eller tillhor annan provider)

### DELETE /api/provider/customers/[customerId]/notes/[noteId]

**Auth:** Required (provider-only, atomar agarskapscheck)

**Response:** `204 No Content`

**Felkoder:**
- `404` -- Anteckningen hittades inte (eller tillhor annan provider)
