# Rost & AI

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Rostloggning (diktering av utfort arbete), vokabularinlarning och AI-drivna kundinsikter.

---

## Rostloggning

### POST /api/voice-log

Tolkar en rosttranskribering och matchar mot dagens bokningar.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "transcript": "Klar med Stella hos Anna. Verkade alla fyra.",
  "date": "2026-02-13"
}
```

| Falt | Typ | Validering |
|------|-----|------------|
| `transcript` | string | Obligatoriskt |
| `date` | string | Valfritt, default idag. ISO-datumformat. |

**Response:** `200 OK`
```json
{
  "interpretation": {
    "bookingId": "uuid",
    "customerName": "Anna Johansson",
    "horseName": "Stella",
    "markAsCompleted": true,
    "workPerformed": "Verkade alla fyra hovarna",
    "horseObservation": null,
    "horseNoteCategory": null,
    "nextVisitWeeks": 8,
    "confidence": 0.95
  },
  "bookings": [...]
}
```

---

### POST /api/voice-log/confirm

Sparar tolkad rostloggning. Uppdaterar providerNotes, markerar completed, skapar horse note, sparar vokabular.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "bookingId": "uuid",
  "markAsCompleted": true,
  "workPerformed": "Verkade alla fyra",
  "horseObservation": "Framhovarna uttorkade",
  "horseNoteCategory": "farrier",
  "nextVisitWeeks": 8,
  "originalWorkPerformed": "Verkade alla fyra hovarna",
  "originalHorseObservation": null
}
```

`originalWorkPerformed` och `originalHorseObservation` ar valfria. Om de skickas och skiljer sig fran redigerade varden sparas ordniva-diff som vokabular (max 50 termer, FIFO). Vokabularen injiceras i LLM-prompten vid nasta tolkning.

**Response:** `200 OK`
```json
{
  "success": true,
  "actions": ["providerNotes", "completed", "horseNote", "vocabulary"],
  "nextVisitWeeks": 8
}
```

---

## Kundinsikter

### POST /api/provider/customers/[customerId]/insights

Genererar AI-drivna kundinsikter baserat pa bokningshistorik, anteckningar, recensioner och hastar.

**Auth:** Required (provider, maste ha kundrelation)

**Request Body:** Ingen (all data hamtas server-side)

**Response:** `200 OK`
```json
{
  "insight": {
    "frequency": "Regelbunden (var 6:e vecka)",
    "topServices": ["Hovvard", "Hovbeslag"],
    "patterns": ["Bokar alltid mandag fm"],
    "riskFlags": ["2 avbokningar senaste 3 man"],
    "vipScore": "medium",
    "summary": "Regelbunden kund med tva hastar.",
    "confidence": 0.85
  },
  "metrics": {
    "totalBookings": 12, "completedBookings": 10, "cancelledBookings": 2,
    "totalSpent": 18000, "avgBookingIntervalDays": 42,
    "lastBookingDate": "2026-01-15", "firstBookingDate": "2025-03-01"
  }
}
```

**Felkoder:**
- `400` -- Kunden har inga genomforda bokningar
- `403` -- Ej provider / ingen kundrelation
- `429` -- Rate limited (20/min)
- `503` -- AI API-nyckel saknas
