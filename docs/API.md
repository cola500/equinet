---
title: "API -- Gemensamma monster"
description: "Gemensamma patterns for alla API-endpoints: autentisering, felkoder, rate limiting, sakerhet"
category: api
tags: [api, auth, rate-limiting, security, zod]
status: active
last_updated: 2026-03-02
related:
  - api/follows.md
  - api/horse-intervals.md
  - api/integrations.md
  - api/municipality-watches.md
  - api/notifications.md
  - api/provider-notes.md
  - api/subscriptions.md
sections:
  - Autentisering
  - Request-format
  - Response-format
  - Felkoder
  - Rate Limiting
  - Feature Flag-gating
  - Obligatorisk route-struktur
  - CORS & Sakerhet
---

# API -- Gemensamma monster

> Detta dokument beskriver gemensamma monster for alla API-endpoints i Equinet. Specifika endpoints dokumenteras i [docs/api/](api/).

---

## Autentisering

Equinet använder **NextAuth v5** med session cookies. De flesta endpoints kraver inloggning.

```
Cookie: authjs.session-token=<session-token>
```

**Rollbaserad atkomst** hanteras i middleware (`src/middleware.ts`):

| Route-prefix | Krav |
|---|---|
| `/api/admin/*` | Inloggad + `isAdmin=true` |
| `/api/provider/*`, `/api/routes/*` | Inloggad + `userType="provider"` |
| `/customer/*` | Inloggad + `userType="customer"` |
| `/api/providers`, `/api/services/[id]` | Oppen (inget auth-krav) |

> `providerId` och `customerId` hamtas ALLTID fran sessionen, aldrig fran request body. Detta forhindrar IDOR-attacker.

---

## Request-format

- **Content-Type:** `application/json`
- **Validering:** Alla request bodies valideras med [Zod](https://zod.dev/) och `.strict()` (avvisar okanda falt)
- **ID-format:** UUID v4

### Exempel-request

```http
POST /api/bookings HTTP/1.1
Content-Type: application/json
Cookie: authjs.session-token=...

{
  "providerId": "a0000000-0000-4000-a000-000000000001",
  "serviceId": "b0000000-0000-4000-b000-000000000001",
  "bookingDate": "2026-03-01T00:00:00.000Z",
  "startTime": "10:00"
}
```

---

## Response-format

### Lyckad response

```json
// Enskilt objekt
{ "id": "uuid", "field": "value" }

// Lista
[{ "id": "uuid" }, { "id": "uuid" }]

// Paginerad (admin-endpoints)
{ "items": [...], "total": 100, "page": 1, "totalPages": 5 }
```

### Felresponse

```json
{
  "error": "Valideringsfel",
  "details": [{ "path": ["field"], "message": "..." }]
}
```

`details` ar valfritt och inkluderas vid Zod-valideringsfel.

---

## Felkoder

Alla felmeddelanden ar pa **svenska**.

| HTTP-kod | Felmeddelande | Betydelse |
|----------|---------------|-----------|
| `400` | `"Ogiltig JSON"` | Requestens body kunde inte parsas som JSON |
| `400` | `"Valideringsfel"` | Zod-validering misslyckades (+ `details`) |
| `401` | `"Ej inloggad"` | Ingen giltig session |
| `403` | `"Atkomst nekad"` | Inloggad men saknar behorighet |
| `404` | `"Ej tillganglig"` | Resursen finns inte (eller feature flag avaktiverad) |
| `409` | Kontextspecifikt | Konflikt (t.ex. tidskollision, dubbletter) |
| `429` | `"For manga forfragningar"` | Rate limit overskriden |
| `500` | `"Internt serverfel"` | Ohanterat fel (loggas server-side) |

> Domansspecifika felmeddelanden (t.ex. `"Kunde inte geocoda adress"`) foljer monstret `"Kunde inte X"`.

---

## Rate Limiting

Rate limiting använder **Upstash Redis** i produktion och in-memory fallback i utveckling. Alla rate limits kontrolleras **fore** request-parsing.

| Limiter | Produktion | Utveckling | Anvandning |
|---------|-----------|------------|------------|
| `login` | 10 / 15 min | 15 / 15 min | Inloggningsforsk per e-post |
| `loginIp` | 30 / 15 min | 200 / 15 min | Inloggningsforsk per IP |
| `registration` | 3 / 1 h | 50 / 1 h | Registrering per IP |
| `api` | 100 / 1 min | 1000 / 1 min | Allman API-anrop |
| `booking` | 10 / 1 h | 100 / 1 h | Bokningsskapande |
| `profileUpdate` | 20 / 1 h | 100 / 1 h | Profiluppdatering |
| `serviceCreate` | 10 / 1 h | 100 / 1 h | Tjansteskapande |
| `geocode` | 30 / 1 min | 100 / 1 min | Geocoding (extern tjansttjänst) |
| `resendVerification` | 3 / 15 min | 50 / 15 min | E-post-aterutskick |
| `ai` | 20 / 1 min | 200 / 1 min | AI/LLM-anrop (kostnadsskydd) |
| `subscription` | 5 / 1 h | 50 / 1 h | Stripe-operationer |

---

## Feature Flag-gating

Vissa endpoints ar skyddade av feature flags. Nar en flagga ar avaktiverad returnerar endpointen:

```json
HTTP/1.1 404 Not Found
{ "error": "Ej tillganglig" }
```

Statuskod `404` (inte `403`) anvands medvetet for att **dolja att featuren existerar**.

Aktiva feature flags kan hamtas via:
```
GET /api/feature-flags
```

> Se [.claude/rules/feature-flags.md](../.claude/rules/feature-flags.md) for detaljer om prioritetsordning och implementation.

---

## Obligatorisk route-struktur

Alla API-routes foljer denna ordning:

```
1. Auth           -> 401 "Ej inloggad"
2. Rate limiting  -> 429 (FORE request-parsing)
3. Feature flag   -> 404 "Ej tillganglig"
4. JSON-parsing   -> 400 "Ogiltig JSON" (try-catch)
5. Zod-validering -> 400 "Valideringsfel"
6. Authorization  -> 403 "Atkomst nekad"
7. Affarslogik    -> Domanservice eller Prisma
8. Response       -> 200/201
```

---

## CORS & Sakerhet

- **CSRF**: NextAuth v5 + Origin-validering i middleware
- **XSS**: React default-escaping + input-sanitering (`stripXss`)
- **SQL Injection**: Prisma (parameteriserade queries)
- **Security Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP
- **Krypterad lagring**: OAuth-tokens (Fortnox) krypteras med AES-256-GCM

---

*Senast uppdaterad: 2026-02-28*
