# Auth & Profil

> Se [API.md](../API.md) for gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

## POST /api/auth/register

Registrera ny användare.

**Auth:** Ej krävd

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "minst8tecken",
  "firstName": "Johan",
  "lastName": "Lindengard",
  "phone": "0701234567",
  "userType": "customer" | "provider",
  "businessName": "Hovslagare AB",
  "description": "Beskrivning",
  "city": "Goteborg"
}
```

| Falt | Typ | Validering |
|------|-----|------------|
| `email` | string | Giltig e-postadress, unik |
| `password` | string | Min 8 tecken |
| `firstName` | string | Obligatoriskt |
| `lastName` | string | Obligatoriskt |
| `phone` | string | Obligatoriskt |
| `userType` | string | `customer` eller `provider` |
| `businessName` | string | Kravs for provider |
| `description` | string | Valfritt, for provider |
| `city` | string | Valfritt, for provider |

**Response:** `201 Created`
```json
{
  "message": "Anvandare skapad",
  "user": { "id": "uuid", "email": "...", "firstName": "...", "lastName": "...", "userType": "customer" }
}
```

**Felkoder:**
- `400` -- Valideringsfel eller anvandare finns redan
- `429` -- Rate limit (5 registreringar/timme per IP)

---

## GET/POST /api/auth/[...nextauth]

NextAuth.js endpoints for inloggning, utloggning och session. Se [NextAuth.js dokumentation](https://next-auth.js.org/getting-started/rest-api).

---

## GET /api/profile

Hamta inloggad anvandares profil.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Johan",
  "lastName": "Lindengard",
  "phone": "0701234567",
  "userType": "customer" | "provider"
}
```

---

## PUT /api/profile

Uppdatera inloggad anvandares profil.

**Auth:** Required

**Request Body:**
```json
{
  "firstName": "Johan",
  "lastName": "Lindengard",
  "phone": "0701234567"
}
```

**Response:** `200 OK`
