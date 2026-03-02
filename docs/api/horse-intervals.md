---
title: "Hastintervall (Horse Service Intervals)"
description: "API-dokumentation for hast-tjanstintervall med tre prioritetsnivaer: kund, leverantor, tjanstestandard"
category: api
tags: [api, horse, intervals, due-for-service, feature-flag]
status: active
last_updated: 2026-03-02
depends_on:
  - API.md
sections:
  - Intervallprioritering (3 nivaer)
  - Kundintervall
  - Leverantorsintervall
  - GET /api/provider/due-for-service
---

# Hastintervall (Horse Service Intervals)

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Hastintervall bestammer hur ofta en hast behover en viss tjanst (t.ex. hovvard var 6:e vecka). Intervall kan sattas av bade kund och leverantor, med en tydlig prioritetsordning.

---

## Intervallprioritering (3 nivaer)

| Prioritet | Kalla | Vem satter | Tabell |
|-----------|-------|-----------|--------|
| 1 (hogst) | Kundintervall | Hastagarens eget onskemål | `CustomerHorseServiceInterval` |
| 2 | Leverantorsintervall | Leverantorens professionella rekommendation | `HorseServiceInterval` |
| 3 (lagst) | Tjanstestandard | Tjänstens default-varde | `Service.recommendedIntervalWeeks` |

---

## Kundintervall

**Feature flag:** `due_for_service` maste vara aktiverad.

### GET /api/customer/horses/[horseId]/intervals

Hamta intervall och tillgangliga tjanster for en hast.

**Auth:** Required (customer, maste aga hasten)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "intervals": [
    {
      "id": "uuid",
      "horseId": "uuid",
      "serviceId": "uuid",
      "intervalWeeks": 6,
      "service": { "id": "uuid", "name": "Hovvard" },
      "createdAt": "2026-02-28T10:00:00.000Z",
      "updatedAt": "2026-02-28T10:00:00.000Z"
    }
  ],
  "availableServices": [
    { "id": "uuid", "name": "Hovvard", "recommendedIntervalWeeks": 8 },
    { "id": "uuid", "name": "Tandvard", "recommendedIntervalWeeks": 26 }
  ]
}
```

**Felkoder:**
- `403` -- Inte kund eller ager inte hasten
- `404` -- Feature flag avaktiverad

### PUT /api/customer/horses/[horseId]/intervals

Skapa eller uppdatera kundintervall (upsert pa `horseId + serviceId`).

**Auth:** Required (customer, maste aga hasten)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "serviceId": "uuid",
  "intervalWeeks": 6
}
```

**Validering:**
- `serviceId`: Giltig UUID
- `intervalWeeks`: Heltal 1--104 (1 vecka till 2 ar)

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel
- `403` -- Inte kund eller ager inte hasten
- `404` -- Feature flag avaktiverad

### DELETE /api/customer/horses/[horseId]/intervals

Ta bort kundintervall (atergar till leverantor-/tjanstestandard).

**Auth:** Required (customer, maste aga hasten)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "serviceId": "uuid"
}
```

**Response:** `200 OK`

---

## Leverantorsintervall

### GET /api/provider/horses/[horseId]/interval

Hamta leverantorens intervall for en hast.

**Auth:** Required (provider, maste ha minst 1 bokning for hasten)
**Rate limiter:** `api` (100/min produktion)

**Response:** `200 OK`
```json
{
  "intervals": [
    {
      "id": "uuid",
      "horseId": "uuid",
      "providerId": "uuid",
      "serviceId": "uuid",
      "revisitIntervalWeeks": 6,
      "notes": "Hovproblem, behover tatare besok",
      "createdAt": "2026-02-28T10:00:00.000Z"
    }
  ]
}
```

### PUT /api/provider/horses/[horseId]/interval

Skapa eller uppdatera leverantorsintervall (upsert pa `horseId + providerId + serviceId`).

**Auth:** Required (provider, maste ha minst 1 bokning for hasten)
**Rate limiter:** `api` (100/min produktion)

**Request Body:**
```json
{
  "serviceId": "uuid",
  "revisitIntervalWeeks": 6,
  "notes": "Hovproblem, behover tatare besok"
}
```

**Validering:**
- `serviceId`: Giltig UUID
- `revisitIntervalWeeks`: Heltal 1--52 (1 vecka till 1 ar)
- `notes`: Valfritt, max 500 tecken

**Response:** `200 OK`

**Felkoder:**
- `400` -- Valideringsfel
- `403` -- Inte provider eller saknar bokningsrelation med hasten

---

## GET /api/provider/due-for-service

Dashboard-endpoint for leverantorer: visar vilka hastar som ar overdue eller snart behover tjanst.

**Auth:** Required (provider)
**Rate limiter:** `api` (100/min produktion)
**Feature flag:** `due_for_service`

**Query-parametrar:**

| Parameter | Typ | Standard | Beskrivning |
|-----------|-----|----------|-------------|
| `filter` | string | `all` | `all`, `overdue` eller `upcoming` |

**Response:** `200 OK`
```json
[
  {
    "horseId": "uuid",
    "horseName": "Blansen",
    "serviceId": "uuid",
    "serviceName": "Hovvard",
    "lastBookingDate": "2026-01-15T00:00:00.000Z",
    "intervalWeeks": 6,
    "intervalSource": "customer",
    "dueDate": "2026-02-26T00:00:00.000Z",
    "daysOverdue": 2,
    "status": "overdue",
    "customer": {
      "id": "uuid",
      "firstName": "Anna",
      "lastName": "Svensson"
    }
  }
]
```

**Statusvarden:**
- `overdue` -- Passerat forvantad tid (daysOverdue > 0)
- `upcoming` -- Inom 14 dagar
- `ok` -- Mer an 14 dagar kvar

> Resultat sorteras efter bradskning (mest overdue forst).

---

*Senast uppdaterad: 2026-02-28*
