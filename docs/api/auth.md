# Auth & Profil

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

## POST /api/auth/register

Registrera ny användare.

**Auth:** Ej krävd

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "minst8tecken",
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567",
  "userType": "customer" | "provider",
  "businessName": "Hovslagare AB",
  "description": "Beskrivning",
  "city": "Göteborg"
}
```

| Fält | Typ | Validering |
|------|-----|------------|
| `email` | string | Giltig e-postadress, unik |
| `password` | string | Min 8 tecken |
| `firstName` | string | Obligatoriskt |
| `lastName` | string | Obligatoriskt |
| `phone` | string | Obligatoriskt |
| `userType` | string | `customer` eller `provider` |
| `businessName` | string | Krävs för provider |
| `description` | string | Valfritt, för provider |
| `city` | string | Valfritt, för provider |

**Response:** `201 Created`
```json
{
  "message": "Användare skapad",
  "user": { "id": "uuid", "email": "...", "firstName": "...", "lastName": "...", "userType": "customer" }
}
```

**Felkoder:**
- `400` -- Valideringsfel eller användare finns redan
- `429` -- Rate limit (5 registreringar/timme per IP)

---

## GET/POST /api/auth/[...nextauth]

NextAuth.js endpoints för inloggning, utloggning och session. Se [NextAuth.js dokumentation](https://next-auth.js.org/getting-started/rest-api).

---

## GET /api/profile

Hämta inloggad användares profil.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567",
  "userType": "customer" | "provider"
}
```

---

## PUT /api/profile

Uppdatera inloggad användares profil.

**Auth:** Required

**Request Body:**
```json
{
  "firstName": "Johan",
  "lastName": "Lindengård",
  "phone": "0701234567"
}
```

**Response:** `200 OK`
