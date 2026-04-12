---
title: "Leverantorsanteckningar (Provider Notes)"
description: "API-dokumentation for leverantorers privata kundanteckningar med kundrelationskrav"
category: api
tags: [api, provider, notes, customer-relationship]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
sections:
  - GET /api/provider/customers/[customerId]/notes
  - POST /api/provider/customers/[customerId]/notes
  - Kundrelation
---

# Leverantorsanteckningar (Provider Notes)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Leverantörer kan skapa privata anteckningar om sina kunder. Anteckningarna ar **inte synliga for kunden**.

---

## GET /api/provider/customers/[customerId]/notes

Hamta alla anteckningar for en kund.

**Auth:** Required (provider, maste ha kundrelation)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "notes": [
    {
      "id": "uuid",
      "providerId": "uuid",
      "customerId": "uuid",
      "content": "Hasten ar nervos vid lastning. Ta det lugnt.",
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:00:00.000Z"
    }
  ]
}
```

> Anteckningar sorteras i omvand kronologisk ordning (nyast forst).

**Felkoder:**
- `403` -- Inte provider eller `"Ingen kundrelation hittades"`
- `429` -- Rate limit
- `500` -- `"Kunde inte hamta anteckningar"`

---

## POST /api/provider/customers/[customerId]/notes

Skapa en ny anteckning.

**Auth:** Required (provider, maste ha kundrelation)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "content": "Hasten ar nervos vid lastning. Ta det lugnt."
}
```

**Validering:**
- `content`: Obligatorisk, 1--2000 tecken
- Sanering: XSS-stripning + multiline-sanitering

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "providerId": "uuid",
  "customerId": "uuid",
  "content": "Hasten ar nervos vid lastning. Ta det lugnt.",
  "createdAt": "2026-02-28T10:00:00.000Z",
  "updatedAt": "2026-02-28T10:00:00.000Z"
}
```

**Felkoder:**
- `400` -- Valideringsfel eller `"Ogiltig JSON"`
- `403` -- Inte provider eller `"Ingen kundrelation hittades"`
- `429` -- Rate limit
- `500` -- `"Kunde inte skapa anteckning"`

---

## Kundrelation

Atkomst kraver att leverantören har en **kundrelation** med kunden. En relation skapas genom:

1. **Bokning** -- leverantören har minst en genomförd bokning med kunden
2. **Manuellt tillagd** -- leverantören har lagt till kunden via `POST /api/provider/customers`

Relationskontrollen använder `hasCustomerRelationship()` som kontrollerar bade boknings- och manuella relationer.

---

*Senast uppdaterad: 2026-02-28*
