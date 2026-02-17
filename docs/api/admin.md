# Admin

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Alla admin-endpoints kräver `isAdmin=true`. Skyddas av både middleware (redirect/403) och per-route `requireAdmin()`.

---

## GET /api/admin/stats

Dashboard-KPIs.

**Response:** `200 OK`
```json
{
  "users": { "total": 100, "customers": 70, "providers": 30, "newThisMonth": 12 },
  "bookings": { "total": 500, "pending": 10, "confirmed": 20, "completed": 400, "cancelled": 70, "completedThisMonth": 50 },
  "providers": { "total": 30, "active": 25, "verified": 20, "pendingVerifications": 3 },
  "revenue": { "totalCompleted": 150000, "thisMonth": 25000 }
}
```

---

## GET /api/admin/users

Paginerad användarlista med sök och filter.

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `search` | string | Sök i namn/e-post (case-insensitive) |
| `type` | string | `customer` eller `provider` |
| `page` | number | Sida (default 1) |
| `limit` | number | Antal per sida (default 20, max 100) |

**Response:** `200 OK`
```json
{
  "users": [{ "id": "uuid", "email": "...", "firstName": "...", "lastName": "...", "userType": "customer", "isAdmin": false, "createdAt": "...", "provider": null }],
  "total": 100, "page": 1, "totalPages": 5
}
```

---

## PATCH /api/admin/users

Uppdatera en användares admin- eller blockeringsstatus.

**Request Body:**
```json
{ "userId": "uuid", "action": "toggleBlocked" | "toggleAdmin" }
```

**Säkerhetscheckar:** Kan inte blockera sig själv eller ta bort sin egen admin-behörighet.

**Response:** `200 OK`

**Felkoder:** `400` -- Kan inte utföra åtgärden på sig själv

---

## GET /api/admin/bookings

Paginerad bokningslista med status- och datumfilter.

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `status` | string | `pending`, `confirmed`, `completed`, `cancelled` |
| `from` | string | Från-datum (YYYY-MM-DD) |
| `to` | string | Till-datum (YYYY-MM-DD) |
| `page` | number | Sida (default 1) |
| `limit` | number | Antal per sida (default 20, max 100) |

**Response:** `200 OK`
```json
{
  "bookings": [{ "id": "uuid", "bookingDate": "...", "startTime": "10:00", "endTime": "11:00", "status": "confirmed", "isManualBooking": false, "customerName": "Anna Svensson", "providerBusinessName": "Hästkliniken", "serviceName": "Hovvård" }],
  "total": 500, "page": 1, "totalPages": 25
}
```

---

## PATCH /api/admin/bookings

Avboka en bokning som admin.

**Request Body:**
```json
{ "bookingId": "uuid", "action": "cancel", "reason": "Anledning till avbokning" }
```

Sätter status till `cancelled` med `cancellationMessage` prefixat med `[Admin]`. Skapar notifikationer till både kund och leverantör.

**Felkoder:** `400` -- Bokning redan avbokad

---

## GET /api/admin/providers

Paginerad leverantörslista med statistik.

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `verified` | string | `true` eller `false` |
| `active` | string | `true` eller `false` |
| `page` | number | Sida (default 1) |
| `limit` | number | Antal per sida (default 20, max 100) |

**Response:** `200 OK`
```json
{
  "providers": [{ "id": "uuid", "businessName": "...", "city": "...", "isVerified": true, "isActive": true, "bookingCount": 15, "serviceCount": 3, "averageRating": 4.5, "hasFortnox": true }],
  "total": 30, "page": 1, "totalPages": 2
}
```

---

## GET /api/admin/integrations

Fortnox-kopplingar och betalningsöversikt.

**Response:** `200 OK`
```json
{
  "fortnox": { "connections": [{ "providerId": "uuid", "businessName": "...", "connectedAt": "...", "tokenExpiresAt": "..." }], "totalConnected": 1 },
  "payments": { "total": 100, "succeeded": 80, "pending": 10, "failed": 10, "totalRevenue": 50000 }
}
```

---

## GET /api/admin/system

Systemhälsa: databas + cron-status.

**Response:** `200 OK`
```json
{
  "database": { "healthy": true, "responseTimeMs": 5 },
  "cron": { "lastReminderRun": "2026-02-10T08:00:00Z", "remindersCount": 42 }
}
```

---

## GET /api/admin/reviews

Lista alla recensioner (sammanslagt Review + CustomerReview).

**Query Parameters:**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| `type` | string | `review` eller `customer-review` |
| `search` | string | Sök i kommentarer |

**Response:** `200 OK`
```json
{
  "reviews": [{ "id": "uuid", "type": "review", "rating": 5, "comment": "...", "customerName": "...", "providerName": "...", "createdAt": "..." }]
}
```

---

## DELETE /api/admin/reviews

Ta bort en recension (hard delete).

**Request Body:**
```json
{ "reviewId": "uuid", "type": "review" | "customer-review" }
```

---

## POST /api/admin/notifications

Skicka bulk-notifikationer.

**Request Body:**
```json
{ "target": "all" | "customers" | "providers", "title": "Rubrik", "message": "Meddelandetext" }
```

**Response:** `200 OK` `{ "sent": 42 }`

---

## Verifieringshantering

### GET /api/admin/verification-requests

Lista alla väntande verifieringsansökningar med provider-info, utfärdare, år och bilder.

**Response:** `200 OK` -- Array med verifieringar inkl. provider.businessName, issuer, year, images.

### PUT /api/admin/verification-requests/[id]

Godkänn eller avvisa verifieringsansökan.

**Request Body:**
```json
{ "action": "approve | reject", "reviewNote": "Valfri kommentar (max 500 tecken)" }
```

**Godkänn-flöde (atomär transaction):**
1. Uppdatera ProviderVerification.status -> "approved"
2. Sätt Provider.isVerified -> true, verifiedAt -> now()
3. Skapa notifikation till providern

**Felkoder:**
- `400` -- Ansökan redan behandlad

---

## GET /api/admin/settings

Hämta runtime-inställningar.

**Response:** `200 OK` `{ "settings": { "DISABLE_EMAILS": "true" } }`

---

## PATCH /api/admin/settings

Uppdatera en runtime-inställning.

**Request Body:**
```json
{ "key": "DISABLE_EMAILS", "value": "true" }
```

**Tillåtna nycklar:** Whitelist-baserat. Okända nycklar avvisas.

---

## Cron-endpoints

### GET /api/cron/booking-reminders

Skickar e-postpåminnelser 24h före bekräftade bokningar.

**Auth:** `Authorization: Bearer <CRON_SECRET>` (Vercel)
**Schema:** Dagligen 06:00 UTC

**Logik:**
1. Hittar confirmed bokningar inom 22-30h fönster
2. Filtrerar bort ghost users och kunder med `emailRemindersEnabled=false`
3. Deduplicerar via Notification-tabellen (`REMINDER_BOOKING_24H`)
4. Skapar in-app notification + skickar e-post

**Response:** `200 OK` `{ "success": true, "remindersSent": 5, "processedAt": "..." }`

---

### GET /api/email/unsubscribe

Avregistrerar från bokningspåminnelser via e-postlänk.

**Auth:** HMAC-SHA256 token i query params (ingen inloggning krävs)
**Query:** `userId`, `token`

**Response:** `200 OK` (HTML-sida med bekräftelse) eller `400` vid ogiltig token.
