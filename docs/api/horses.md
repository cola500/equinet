# Hastar

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Hastregister, halsoanteckningar, tidslinje, delbar profil och dataexport. Alla endpoints krav autentisering och agarskap (IDOR-skyddade).

---

## Hastregister (CRUD)

### GET /api/horses

Hamta inloggad kunds aktiva hastar.

**Auth:** Required (customer)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "name": "Blansen", "breed": "Svenskt varmblod",
    "birthYear": 2018, "color": "Brun", "gender": "gelding",
    "specialNeeds": null, "isActive": true,
    "createdAt": "2026-01-30T10:00:00Z", "updatedAt": "2026-01-30T10:00:00Z"
  }
]
```

### POST /api/horses

Skapa ny hast. Namn obligatoriskt, ovrigt valfritt.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "name": "Blansen",
  "breed": "Svenskt varmblod",
  "birthYear": 2018,
  "color": "Brun",
  "gender": "mare | gelding | stallion",
  "specialNeeds": "Kanslig pa vanster fram"
}
```

**Response:** `201 Created`

### GET /api/horses/[id]

Hamta hast med bokningshistorik (senaste 20 bokningar).

**Auth:** Required (agare)

**Response:** `200 OK` -- hast-objekt + `bookings[]` med provider/service-info.

### PUT /api/horses/[id]

Uppdatera hast (partial updates). Alla falt utom `name` kan sattas till `null`.

**Auth:** Required (agare)

**Response:** `200 OK`

### DELETE /api/horses/[id]

Soft delete (`isActive=false`). Hasten forsvinner fran listor men befintliga bokningar behallar kopplingen.

**Auth:** Required (agare)

**Response:** `200 OK` `{ "message": "Hasten har tagits bort" }`

---

## Hastanteckningar (Halsohistorik)

### GET /api/horses/[id]/notes

Lista anteckningar.

**Auth:** Required (agare)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `category` | string | `veterinary`, `farrier`, `general`, `injury`, `medication` |

**Response:** `200 OK`
```json
[
  {
    "id": "uuid", "horseId": "uuid", "authorId": "uuid",
    "category": "veterinary", "title": "Vaccination - influensa",
    "content": "Arlig vaccination genomford",
    "noteDate": "2026-01-15T00:00:00.000Z",
    "createdAt": "2026-01-30T10:00:00Z",
    "author": { "firstName": "Anna", "lastName": "Svensson" }
  }
]
```

### POST /api/horses/[id]/notes

**Auth:** Required (agare)

**Request Body:**
```json
{
  "category": "veterinary | farrier | general | injury | medication",
  "title": "Vaccination - influensa",
  "content": "Valfri beskrivning (max 2000 tecken)",
  "noteDate": "2026-01-15T00:00:00.000Z"
}
```

**Validering:**
- `category`: obligatorisk, en av veterinary/farrier/general/injury/medication
- `title`: obligatorisk, 1-200 tecken
- `content`: valfri, max 2000 tecken
- `noteDate`: obligatorisk, giltigt ISO-datum, inte i framtiden

**Response:** `201 Created`

### PUT /api/horses/[id]/notes/[noteId]

Partial updates, alla falt valfria.

**Auth:** Required (agare)

**Response:** `200 OK`

### DELETE /api/horses/[id]/notes/[noteId]

Hard delete.

**Auth:** Required (agare)

**Response:** `200 OK` `{ "message": "Anteckningen har tagits bort" }`

---

## Tidslinje

### GET /api/horses/[id]/timeline

Kombinerad tidslinje: bokningar (completed) + anteckningar, sorterade kronologiskt.

**Auth:** Required (agare ELLER provider med bokning for hasten)

**Atkomstniva:**
- **Agare:** Ser alla kategorier
- **Provider:** Ser bara `veterinary`, `farrier`, `medication` (integritetsskydd)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `category` | string | Filtrera pa kategori (doljer bokningar vid filtrering) |

**Response:** `200 OK`
```json
[
  {
    "type": "booking", "id": "uuid", "date": "2026-01-20T00:00:00.000Z",
    "title": "Massage", "providerName": "Sara Hastmassage",
    "status": "completed", "notes": "Stel i ryggen",
    "providerNotes": "Behandlade rygg och nacke"
  },
  {
    "type": "note", "id": "uuid", "date": "2026-01-15T00:00:00.000Z",
    "title": "Vaccination", "category": "veterinary",
    "content": "Arlig vaccination genomford", "authorName": "Anna Svensson"
  }
]
```

---

## Delbar hastprofil

### POST /api/horses/[id]/profile

Skapa delbar hastprofil-lank (30 dagars expiry).

**Auth:** Required (agare)

**Response:** `201 Created` `{ "token": "...", "url": "...", "expiresAt": "..." }`

### GET /api/profile/[token]

Hamta hastdata via publik token.

**Auth:** Ej kravd

**Response:** `200 OK` `{ "horse": {...}, "timeline": [...], "expiresAt": "..." }`

> Bara veterinar-, hovslagare- och medicinanteckningar visas (integritetsskydd).

---

## Dataexport (GDPR)

### GET /api/export/my-data

Exportera all anvandardata (GDPR Art 20 portabilitet).

**Auth:** Required
**Query:** `?format=csv` (valfritt, default JSON)
**Response (JSON):** `{ exportedAt, user, horses, bookings, horseNotes, reviews, provider? }`
**Response (CSV):** Content-Disposition: attachment med bokningar + anteckningar.

### GET /api/horses/[id]/export

Exportera hastdata med fullstandig tidslinje.

**Auth:** Required (agare)
**Query:** `?format=csv`
**Response (JSON):** `{ horse, bookings, notes, timeline }`
