# Röst & AI

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Röstloggning (diktering av utfört arbete), vokabulärinlärning och AI-drivna kundinsikter.

---

## Röstloggning

### POST /api/voice-log

Tolkar en rösttranskribering och matchar mot dagens bokningar.

**Auth:** Required (provider)

**Request Body:**
```json
{
  "transcript": "Klar med Stella hos Anna. Verkade alla fyra.",
  "date": "2026-02-13"
}
```

| Fält | Typ | Validering |
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

Sparar tolkad röstloggning. Uppdaterar providerNotes, markerar completed, skapar horse note, sparar vokabulär.

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

`originalWorkPerformed` och `originalHorseObservation` är valfria. Om de skickas och skiljer sig från redigerade värden sparas ordnivå-diff som vokabulär (max 50 termer, FIFO). Vokabulären injiceras i LLM-prompten vid nästa tolkning.

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

Genererar AI-drivna kundinsikter baserat på bokningshistorik, anteckningar, recensioner och hästar.

**Auth:** Required (provider, måste ha kundrelation)

**Request Body:** Ingen (all data hämtas server-side)

**Response:** `200 OK`
```json
{
  "insight": {
    "frequency": "Regelbunden (var 6:e vecka)",
    "topServices": ["Hovvård", "Hovbeslag"],
    "patterns": ["Bokar alltid måndag fm"],
    "riskFlags": ["2 avbokningar senaste 3 mån"],
    "vipScore": "medium",
    "summary": "Regelbunden kund med två hästar.",
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
- `400` -- Kunden har inga genomförda bokningar
- `403` -- Ej provider / ingen kundrelation
- `429` -- Rate limited (20/min)
- `503` -- AI API-nyckel saknas
