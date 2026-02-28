# API Reference

Equinet REST API. Alla endpoints kräver NextAuth session via HTTP-only cookies om inte annat anges.

---

## Gemensamma mönster

### Autentisering

- Session via HTTP-only cookies (NextAuth v5)
- `401 Unauthorized` -- ingen giltig session
- `403 Forbidden` -- saknar behörighet

### Atomär authorization (IDOR-skydd)

Authorization sker i samma databasfråga som operationen:
- Returnerar `404` (inte `403`) vid unauthorized access
- Förhindrar ID-enumeration och information leakage

```typescript
// WHERE clause inkluderar både ID och owner
await prisma.booking.update({
  where: { id, providerId },  // Atomär auth check
  data: { status }
})
```

### Säkerhetsprinciper

- `providerId`/`customerId` från session, ALDRIG från request body
- Zod `.strict()` på alla request bodies
- `select` (aldrig `include`) i Prisma-queries
- Content saniteras med `stripXss()` + `sanitizeMultilineString()`

### Felkoder

| Kod | Betydelse |
|-----|-----------|
| `400` | Bad Request -- valideringsfel eller ogiltig request |
| `401` | Unauthorized -- ingen giltig session |
| `403` | Forbidden -- saknar behörighet |
| `404` | Not Found -- resursen finns inte |
| `409` | Conflict -- resurskonflikt (t.ex. dubbelbokning) |
| `429` | Too Many Requests -- rate limit överskriden |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

### Rate limiting

Rate limiting via Redis (Upstash) för serverless-kompatibilitet.

| Endpoint | Limit | Fönster |
|----------|-------|---------|
| POST `/api/auth/register` | 5 | /timme per IP |
| POST `/api/auth/forgot-password` | 3 | /timme per IP |
| POST `/api/auth/reset-password` | 3 | /timme per IP |
| POST `/api/bookings` | 10 | /timme per användare |
| POST `/api/bookings/manual` | 10 | /timme per provider |
| POST `/api/services` | 10 | /timme per provider |
| POST `/api/group-bookings` | 10 | /timme per användare |
| POST `/api/group-bookings/join` | 10 | /timme per användare |
| GET `/api/customers/search` | 30 | /minut per provider |
| GET `/api/customers/[id]/horses` | 20 | /minut per provider |
| POST `/api/voice-log` | 100 | /minut per IP |
| POST `/api/voice-log/confirm` | 100 | /minut per IP |
| POST `/api/provider/customers/[id]/insights` | 20 | /minut per provider |

---

## Endpoint-index

### Auth & Profil -- [detaljer](api/auth.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/auth/register` | - | Registrera ny användare |
| GET/POST | `/api/auth/[...nextauth]` | - | NextAuth inloggning/utloggning/session |
| POST | `/api/auth/forgot-password` | - | Begär lösenordsåterställning |
| POST | `/api/auth/reset-password` | - | Återställ lösenord med token |
| GET | `/api/profile` | Session | Hämta användarprofil |
| PUT | `/api/profile` | Session | Uppdatera användarprofil |

### Bokningar -- [detaljer](api/bookings.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/bookings` | Session | Hämta bokningar |
| POST | `/api/bookings` | Customer | Skapa bokning |
| POST | `/api/bookings/manual` | Provider | Manuell bokning åt kund |
| PUT | `/api/bookings/[id]` | Session (ägare) | Uppdatera status |
| DELETE | `/api/bookings/[id]` | Session (ägare) | Ta bort bokning |
| POST | `/api/booking-series` | Session | Skapa återkommande bokningsserie |
| GET | `/api/booking-series/[id]` | Session (ägare) | Hämta serie med bokningar |
| POST | `/api/booking-series/[id]/cancel` | Session (ägare) | Avbryt serie (avbokar framtida) |

### Kunder -- [detaljer](api/customers.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/customers/search` | Provider | Sök kunder |
| GET | `/api/customers/[id]/horses` | Provider | Kunds hästar |
| GET | `/api/provider/customers` | Provider | Kundregister |
| POST | `/api/provider/customers` | Provider | Registrera kund manuellt |
| DELETE | `/api/provider/customers/[cid]` | Provider | Ta bort manuell kund |
| GET | `/api/provider/customers/[cid]/notes` | Provider | Hämta kundanteckningar |
| POST | `/api/provider/customers/[cid]/notes` | Provider | Skapa kundanteckning |
| PUT | `/api/provider/customers/[cid]/notes/[nid]` | Provider | Redigera anteckning |
| DELETE | `/api/provider/customers/[cid]/notes/[nid]` | Provider | Ta bort anteckning |

### Hästar -- [detaljer](api/horses.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/horses` | Session | Lista hästar |
| POST | `/api/horses` | Session | Skapa häst |
| GET | `/api/horses/[id]` | Ägare | Hämta häst med historik |
| PUT | `/api/horses/[id]` | Ägare | Uppdatera häst |
| DELETE | `/api/horses/[id]` | Ägare | Soft delete häst |
| GET | `/api/horses/[id]/notes` | Ägare | Lista hästanteckningar |
| POST | `/api/horses/[id]/notes` | Ägare | Skapa hästanteckning |
| PUT | `/api/horses/[id]/notes/[nid]` | Ägare | Uppdatera anteckning |
| DELETE | `/api/horses/[id]/notes/[nid]` | Ägare | Ta bort anteckning |
| GET | `/api/horses/[id]/timeline` | Ägare/Provider | Kombinerad tidslinje |
| POST | `/api/horses/[id]/profile` | Ägare | Skapa delbar profillänk |
| GET | `/api/profile/[token]` | - | Hämta delbar hästprofil |
| GET | `/api/horses/[id]/export` | Ägare | Exportera hästdata |
| GET | `/api/export/my-data` | Session | GDPR-export all data |

### Leverantörer -- [detaljer](api/providers.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/providers` | - | Sök leverantörer (publikt) |
| GET | `/api/providers/[id]` | - | Leverantörsdetaljer (publikt) |
| PUT | `/api/providers/[id]` | Ägare | Uppdatera profil |
| GET | `/api/provider/profile` | Provider | Egen profil |
| PUT | `/api/provider/profile` | Provider | Uppdatera egen profil |
| GET | `/api/providers/[id]/availability` | - | Tillgänglighet (datum) |
| GET | `/api/providers/[id]/availability-schedule` | - | Veckans öppettider |
| PUT | `/api/providers/[id]/availability-schedule` | Ägare | Uppdatera öppettider |
| GET | `/api/services` | Provider | Lista tjänster |
| POST | `/api/services` | Provider | Skapa tjänst |
| PUT | `/api/services/[id]` | Provider (ägare) | Uppdatera tjänst |
| DELETE | `/api/services/[id]` | Provider (ägare) | Ta bort tjänst |
| GET | `/api/provider/horses/[hid]/interval` | Provider | Hämta återbesöksintervall |
| PUT | `/api/provider/horses/[hid]/interval` | Provider | Sätt intervall |
| DELETE | `/api/provider/horses/[hid]/interval` | Provider | Ta bort intervall |
| GET | `/api/provider/due-for-service` | Provider | Hästar som behöver återbesök |
| PUT | `/api/provider/bookings/[id]/notes` | Provider (ägare) | Leverantörsanteckningar |
| GET | `/api/verification-requests` | Provider | Lista verifieringar |
| POST | `/api/verification-requests` | Provider | Skapa verifiering |
| PUT | `/api/verification-requests/[id]` | Provider (ägare) | Redigera verifiering |
| DELETE | `/api/verification-requests/[id]` | Provider (ägare) | Ta bort verifiering |
| POST | `/api/upload` | Session | Ladda upp bild |
| DELETE | `/api/upload/[id]` | Uppladdare | Ta bort bild |
| GET | `/api/integrations/fortnox/connect` | Provider | Starta Fortnox OAuth |
| GET | `/api/integrations/fortnox/callback` | - | OAuth callback |
| POST | `/api/integrations/fortnox/disconnect` | Provider | Koppla bort Fortnox |
| POST | `/api/integrations/fortnox/sync` | Provider | Synka fakturor |

### Admin -- [detaljer](api/admin.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/admin/stats` | Admin | Dashboard-KPIs |
| GET | `/api/admin/users` | Admin | Användarlista |
| PATCH | `/api/admin/users` | Admin | Blockera/admin-toggle |
| GET | `/api/admin/bookings` | Admin | Bokningslista |
| PATCH | `/api/admin/bookings` | Admin | Avboka bokning |
| GET | `/api/admin/providers` | Admin | Leverantörslista |
| GET | `/api/admin/integrations` | Admin | Integrationer |
| GET | `/api/admin/system` | Admin | Systemhälsa |
| GET | `/api/admin/reviews` | Admin | Recensioner |
| DELETE | `/api/admin/reviews` | Admin | Ta bort recension |
| POST | `/api/admin/notifications` | Admin | Bulk-notifikationer |
| GET | `/api/admin/verification-requests` | Admin | Lista verifieringar |
| PUT | `/api/admin/verification-requests/[id]` | Admin | Godkänn/avvisa |
| GET | `/api/admin/settings` | Admin | Hämta inställningar |
| PATCH | `/api/admin/settings` | Admin | Uppdatera inställning |
| GET | `/api/cron/booking-reminders` | CRON_SECRET | Bokningspåminnelser |
| GET | `/api/email/unsubscribe` | HMAC-token | Avregistrera påminnelser |

### Gruppbokningar -- [detaljer](api/group-bookings.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/group-bookings` | Customer | Skapa grupprequest |
| GET | `/api/group-bookings` | Customer | Lista grupprequests |
| GET | `/api/group-bookings/[id]` | Session | Detaljer |
| PUT | `/api/group-bookings/[id]` | Skapare | Uppdatera/avbryt |
| POST | `/api/group-bookings/join` | Customer | Gå med via invite code |
| GET | `/api/group-bookings/available` | Provider | Öppna grupprequests |
| POST | `/api/group-bookings/[id]/match` | Provider | Matcha + skapa bokningar |
| DELETE | `/api/group-bookings/[id]/participants/[pid]` | Skapare/Deltagare | Ta bort deltagare |

### Rutter -- [detaljer](api/routes.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/route-orders` | Session | Lista ruttbeställningar |
| POST | `/api/route-orders` | Session | Skapa beställning/annonsering |
| GET | `/api/route-orders/[id]` | - | Detaljer |
| GET | `/api/route-orders/available` | Provider | Tillgängliga beställningar |
| GET | `/api/route-orders/my-orders` | Customer | Egna beställningar |
| GET | `/api/route-orders/announcements` | - | Sök annonseringar (publikt) |
| POST | `/api/routes` | Provider | Skapa rutt |
| GET | `/api/routes/[id]` | Provider (ägare) | Hämta rutt |
| GET | `/api/routes/my-routes` | Provider | Lista rutter |
| PATCH | `/api/routes/[id]/stops/[sid]` | Provider (ägare) | Uppdatera stopp-status |

### Följ leverantör (feature flag: `follow_provider`)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/follows` | Customer | Följ leverantör |
| GET | `/api/follows` | Customer | Lista följda leverantörer |
| DELETE | `/api/follows/[providerId]` | Customer | Avfölj leverantör |
| GET | `/api/follows/[providerId]` | Session | Följstatus + antal följare |
| POST | `/api/push-subscriptions` | Session | Spara push-prenumeration (stub) |
| DELETE | `/api/push-subscriptions` | Session | Ta bort push-prenumeration |

### Röst & AI -- [detaljer](api/voice-and-ai.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/voice-log` | Provider | Tolka rösttranskribering |
| POST | `/api/voice-log/confirm` | Provider | Bekräfta + spara tolkning |
| POST | `/api/provider/customers/[cid]/insights` | Provider | AI-drivna kundinsikter |

### Utilities

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/health` | - | Health check |
| GET | `/api/geocode` | - | Geocoda adress till koordinater |
| POST | `/api/optimize-route` | - | Optimera ruttordning |
| POST | `/api/routing` | - | Körvägsberäkning (OSRM) |

---

*Senast uppdaterad: 2026-02-17*
