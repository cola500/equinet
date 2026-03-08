---
title: "Auth & Profile API"
description: "Authentication endpoints for registration, login, password reset and user profile management"
category: api
tags: [auth, registration, login, password-reset, profile]
status: active
last_updated: 2026-03-02
depends_on:
  - docs/api/README.md
sections:
  - POST /api/auth/register
  - GET/POST /api/auth/[...nextauth]
  - POST /api/auth/forgot-password
  - POST /api/auth/reset-password
  - GET /api/profile
  - PUT /api/profile
  - POST /api/auth/mobile-token
  - DELETE /api/auth/mobile-token
  - POST /api/auth/mobile-token/refresh
  - GET /api/widget/next-booking
---

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

## POST /api/auth/forgot-password

Begär lösenordsåterställning. Skickar e-post med återställningslänk (giltig 1h).

**Auth:** Ej krävd

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

| Fält | Typ | Validering |
|------|-----|------------|
| `email` | string | Giltig e-postadress |

**Response:** `200 OK` (alltid samma response oavsett om e-post finns -- enumeration prevention)
```json
{
  "message": "Om e-postadressen finns i vårt system har vi skickat en länk för att återställa ditt lösenord."
}
```

**Felkoder:**
- `400` -- Valideringsfel eller ogiltig JSON
- `429` -- Rate limit (3 försök/timme per IP)

---

## POST /api/auth/reset-password

Återställ lösenord med token från e-postlänk.

**Auth:** Ej krävd (token-baserad)

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NyttLösenord123!"
}
```

| Fält | Typ | Validering |
|------|-----|------------|
| `token` | string | Obligatoriskt |
| `password` | string | Min 8 tecken, stor+liten bokstav, siffra, specialtecken, max 72 tecken |

**Response:** `200 OK`
```json
{
  "message": "Lösenordet har återställts. Du kan nu logga in med ditt nya lösenord."
}
```

**Felkoder:**
- `400` -- Valideringsfel, utgången/använd token, eller ogiltig JSON
- `429` -- Rate limit (3 försök/timme per IP)

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

---

## POST /api/auth/mobile-token

Generera en ny mobil-token (JWT) for iOS-appen. Kallas fran WKWebView efter inloggning.

**Auth:** Session cookie (NextAuth)

**Rate limit:** 5 forsok/timme per anvandare+IP

**Request Body:**
```json
{
  "deviceName": "iPhone 15"  // valfritt, max 100 tecken
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJ...",
  "expiresAt": "2026-06-06T00:00:00.000Z"
}
```

**Felkoder:**
- `400` -- Valideringsfel (ogiltiga falt)
- `401` -- Ej inloggad (ingen session)
- `409` -- Max antal aktiva tokens uppnatt (5 per anvandare)
- `429` -- Rate limit

---

## DELETE /api/auth/mobile-token

Revokera aktuell mobil-token.

**Auth:** Bearer token (mobil-token)

**Response:** `200 OK`
```json
{ "success": true }
```

**Felkoder:**
- `401` -- Ogiltigt token

---

## POST /api/auth/mobile-token/refresh

Fornya en mobil-token. Gamla tokenet revokeras atomiskt (token-rotation).

**Auth:** Bearer token (mobil-token)

**Rate limit:** 5 forsok/timme per IP

**Response:** `200 OK`
```json
{
  "token": "eyJ...",
  "expiresAt": "2026-09-06T00:00:00.000Z"
}
```

**Felkoder:**
- `401` -- Ogiltigt/utgånget token
- `429` -- Rate limit

---

## GET /api/widget/next-booking

Hamta nasta kommande bokning for iOS-widget.

**Auth:** Bearer token (mobil-token)

**Response:** `200 OK`
```json
{
  "booking": {
    "id": "uuid",
    "bookingDate": "2026-03-10",
    "startTime": "10:00",
    "endTime": "11:00",
    "status": "confirmed",
    "horseName": "Blansen",
    "customer": { "firstName": "Anna", "lastName": "Andersson" },
    "service": { "name": "Hovslagare" }
  },
  "updatedAt": "2026-03-08T10:00:00.000Z"
}
```

`booking` ar `null` om inga kommande bokningar finns.

**Felkoder:**
- `401` -- Ogiltigt token
- `500` -- Internt serverfel
