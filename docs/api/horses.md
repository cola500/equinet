# Hästar

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Hästregister, hälsoanteckningar, tidslinje, delbar profil och dataexport. Alla endpoints kräver autentisering och ägarskap (IDOR-skyddade).

---

## Hästregister (CRUD)

### GET /api/horses

Hämta inloggad kunds aktiva hästar.

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

Skapa ny häst. Namn obligatoriskt, övrigt valfritt.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "name": "Blansen",
  "breed": "Svenskt varmblod",
  "birthYear": 2018,
  "color": "Brun",
  "gender": "mare | gelding | stallion",
  "specialNeeds": "Känslig på vänster fram"
}
```

**Response:** `201 Created`

### GET /api/horses/[id]

Hämta häst med bokningshistorik (senaste 20 bokningar).

**Auth:** Required (ägare)

**Response:** `200 OK` -- häst-objekt + `bookings[]` med provider/service-info.

### PUT /api/horses/[id]

Uppdatera häst (partial updates). Alla fält utom `name` kan sättas till `null`.

**Auth:** Required (ägare)

**Response:** `200 OK`

### DELETE /api/horses/[id]

Soft delete (`isActive=false`). Hästen försvinner från listor men befintliga bokningar behåller kopplingen.

**Auth:** Required (ägare)

**Response:** `200 OK` `{ "message": "Hästen har tagits bort" }`

---

## Hästanteckningar (Hälsohistorik)

### GET /api/horses/[id]/notes

Lista anteckningar.

**Auth:** Required (ägare)

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
    "content": "Årlig vaccination genomförd",
    "noteDate": "2026-01-15T00:00:00.000Z",
    "createdAt": "2026-01-30T10:00:00Z",
    "author": { "firstName": "Anna", "lastName": "Svensson" }
  }
]
```

### POST /api/horses/[id]/notes

**Auth:** Required (ägare)

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

Partial updates, alla fält valfria.

**Auth:** Required (ägare)

**Response:** `200 OK`

### DELETE /api/horses/[id]/notes/[noteId]

Hard delete.

**Auth:** Required (ägare)

**Response:** `200 OK` `{ "message": "Anteckningen har tagits bort" }`

---

## Tidslinje

### GET /api/horses/[id]/timeline

Kombinerad tidslinje: bokningar (completed) + anteckningar, sorterade kronologiskt.

**Auth:** Required (ägare ELLER provider med bokning för hästen)

**Åtkomstnivå:**
- **Ägare:** Ser alla kategorier
- **Provider:** Ser bara `veterinary`, `farrier`, `medication` (integritetsskydd)

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `category` | string | Filtrera på kategori (döljer bokningar vid filtrering) |

**Response:** `200 OK`
```json
[
  {
    "type": "booking", "id": "uuid", "date": "2026-01-20T00:00:00.000Z",
    "title": "Massage", "providerName": "Sara Hästmassage",
    "status": "completed", "notes": "Stel i ryggen",
    "providerNotes": "Behandlade rygg och nacke"
  },
  {
    "type": "note", "id": "uuid", "date": "2026-01-15T00:00:00.000Z",
    "title": "Vaccination", "category": "veterinary",
    "content": "Årlig vaccination genomförd", "authorName": "Anna Svensson"
  }
]
```

---

## Delbar hästprofil

### POST /api/horses/[id]/profile

Skapa delbar hästprofil-länk (30 dagars expiry).

**Auth:** Required (ägare)

**Response:** `201 Created` `{ "token": "...", "url": "...", "expiresAt": "..." }`

### GET /api/profile/[token]

Hämta hästdata via publik token.

**Auth:** Ej krävd

**Response:** `200 OK` `{ "horse": {...}, "timeline": [...], "expiresAt": "..." }`

> Bara veterinär-, hovslagare- och medicinanteckningar visas (integritetsskydd).

---

## Dataexport (GDPR)

### GET /api/export/my-data

Exportera all användardata (GDPR Art 20 portabilitet).

**Auth:** Required
**Query:** `?format=csv` (valfritt, default JSON)
**Response (JSON):** `{ exportedAt, user, horses, bookings, horseNotes, reviews, provider? }`
**Response (CSV):** Content-Disposition: attachment med bokningar + anteckningar.

### GET /api/horses/[id]/export

Exportera hästdata med fullständig tidslinje.

**Auth:** Required (ägare)
**Query:** `?format=csv`
**Response (JSON):** `{ horse, bookings, notes, timeline }`
