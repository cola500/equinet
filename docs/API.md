# API Reference

Equinet REST API. Alla endpoints kraver NextAuth session via HTTP-only cookies om inte annat anges.

---

## Gemensamma monster

### Autentisering

- Session via HTTP-only cookies (NextAuth v5)
- `401 Unauthorized` -- ingen giltig session
- `403 Forbidden` -- saknar behorighet

### Atomar authorization (IDOR-skydd)

Authorization sker i samma databasfraga som operationen:
- Returnerar `404` (inte `403`) vid unauthorized access
- Forhindrar ID-enumeration och information leakage

```typescript
// WHERE clause inkluderar bade ID och owner
await prisma.booking.update({
  where: { id, providerId },  // Atomar auth check
  data: { status }
})
```

### Sakerhetsprinciper

- `providerId`/`customerId` fran session, ALDRIG fran request body
- Zod `.strict()` pa alla request bodies
- `select` (aldrig `include`) i Prisma-queries
- Content saniteras med `stripXss()` + `sanitizeMultilineString()`

### Felkoder

| Kod | Betydelse |
|-----|-----------|
| `400` | Bad Request -- valideringsfel eller ogiltig request |
| `401` | Unauthorized -- ingen giltig session |
| `403` | Forbidden -- saknar behorighet |
| `404` | Not Found -- resursen finns inte |
| `409` | Conflict -- resurskonflikt (t.ex. dubbelbokning) |
| `429` | Too Many Requests -- rate limit overskriden |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

### Rate limiting

Rate limiting via Redis (Upstash) for serverless-kompatibilitet.

| Endpoint | Limit | Fonster |
|----------|-------|---------|
| POST `/api/auth/register` | 5 | /timme per IP |
| POST `/api/bookings` | 10 | /timme per anvandare |
| POST `/api/bookings/manual` | 10 | /timme per provider |
| POST `/api/services` | 10 | /timme per provider |
| POST `/api/group-bookings` | 10 | /timme per anvandare |
| POST `/api/group-bookings/join` | 10 | /timme per anvandare |
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
| POST | `/api/auth/register` | - | Registrera ny anvandare |
| GET/POST | `/api/auth/[...nextauth]` | - | NextAuth inloggning/utloggning/session |
| GET | `/api/profile` | Session | Hamta anvandarprofil |
| PUT | `/api/profile` | Session | Uppdatera anvandarprofil |

### Bokningar -- [detaljer](api/bookings.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/bookings` | Session | Hamta bokningar |
| POST | `/api/bookings` | Customer | Skapa bokning |
| POST | `/api/bookings/manual` | Provider | Manuell bokning at kund |
| PUT | `/api/bookings/[id]` | Session (agare) | Uppdatera status |
| DELETE | `/api/bookings/[id]` | Session (agare) | Ta bort bokning |

### Kunder -- [detaljer](api/customers.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/customers/search` | Provider | Sok kunder |
| GET | `/api/customers/[id]/horses` | Provider | Kunds hastar |
| GET | `/api/provider/customers` | Provider | Kundregister |
| POST | `/api/provider/customers` | Provider | Registrera kund manuellt |
| DELETE | `/api/provider/customers/[cid]` | Provider | Ta bort manuell kund |
| GET | `/api/provider/customers/[cid]/notes` | Provider | Hamta kundanteckningar |
| POST | `/api/provider/customers/[cid]/notes` | Provider | Skapa kundanteckning |
| PUT | `/api/provider/customers/[cid]/notes/[nid]` | Provider | Redigera anteckning |
| DELETE | `/api/provider/customers/[cid]/notes/[nid]` | Provider | Ta bort anteckning |

### Hastar -- [detaljer](api/horses.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/horses` | Session | Lista hastar |
| POST | `/api/horses` | Session | Skapa hast |
| GET | `/api/horses/[id]` | Agare | Hamta hast med historik |
| PUT | `/api/horses/[id]` | Agare | Uppdatera hast |
| DELETE | `/api/horses/[id]` | Agare | Soft delete hast |
| GET | `/api/horses/[id]/notes` | Agare | Lista hastanteckningar |
| POST | `/api/horses/[id]/notes` | Agare | Skapa hastanteckning |
| PUT | `/api/horses/[id]/notes/[nid]` | Agare | Uppdatera anteckning |
| DELETE | `/api/horses/[id]/notes/[nid]` | Agare | Ta bort anteckning |
| GET | `/api/horses/[id]/timeline` | Agare/Provider | Kombinerad tidslinje |
| POST | `/api/horses/[id]/profile` | Agare | Skapa delbar profillank |
| GET | `/api/profile/[token]` | - | Hamta delbar hastprofil |
| GET | `/api/horses/[id]/export` | Agare | Exportera hastdata |
| GET | `/api/export/my-data` | Session | GDPR-export all data |

### Leverantorer -- [detaljer](api/providers.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/providers` | - | Sok leverantorer (publikt) |
| GET | `/api/providers/[id]` | - | Leverantorsdetaljer (publikt) |
| PUT | `/api/providers/[id]` | Agare | Uppdatera profil |
| GET | `/api/provider/profile` | Provider | Egen profil |
| PUT | `/api/provider/profile` | Provider | Uppdatera egen profil |
| GET | `/api/providers/[id]/availability` | - | Tillganglighet (datum) |
| GET | `/api/providers/[id]/availability-schedule` | - | Veckans oppettider |
| PUT | `/api/providers/[id]/availability-schedule` | Agare | Uppdatera oppettider |
| GET | `/api/services` | Provider | Lista tjanster |
| POST | `/api/services` | Provider | Skapa tjanst |
| PUT | `/api/services/[id]` | Provider (agare) | Uppdatera tjanst |
| DELETE | `/api/services/[id]` | Provider (agare) | Ta bort tjanst |
| GET | `/api/provider/horses/[hid]/interval` | Provider | Hamta aterbesoksintervall |
| PUT | `/api/provider/horses/[hid]/interval` | Provider | Satt intervall |
| DELETE | `/api/provider/horses/[hid]/interval` | Provider | Ta bort intervall |
| GET | `/api/provider/due-for-service` | Provider | Hastar som behover aterbesok |
| PUT | `/api/provider/bookings/[id]/notes` | Provider (agare) | Leverantorsanteckningar |
| GET | `/api/verification-requests` | Provider | Lista verifieringar |
| POST | `/api/verification-requests` | Provider | Skapa verifiering |
| PUT | `/api/verification-requests/[id]` | Provider (agare) | Redigera verifiering |
| DELETE | `/api/verification-requests/[id]` | Provider (agare) | Ta bort verifiering |
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
| GET | `/api/admin/users` | Admin | Anvandarlista |
| PATCH | `/api/admin/users` | Admin | Blockera/admin-toggle |
| GET | `/api/admin/bookings` | Admin | Bokningslista |
| PATCH | `/api/admin/bookings` | Admin | Avboka bokning |
| GET | `/api/admin/providers` | Admin | Leverantorslista |
| GET | `/api/admin/integrations` | Admin | Integrationer |
| GET | `/api/admin/system` | Admin | Systemhalsa |
| GET | `/api/admin/reviews` | Admin | Recensioner |
| DELETE | `/api/admin/reviews` | Admin | Ta bort recension |
| POST | `/api/admin/notifications` | Admin | Bulk-notifikationer |
| GET | `/api/admin/verification-requests` | Admin | Lista verifieringar |
| PUT | `/api/admin/verification-requests/[id]` | Admin | Godkann/avvisa |
| GET | `/api/admin/settings` | Admin | Hamta installningar |
| PATCH | `/api/admin/settings` | Admin | Uppdatera installning |
| GET | `/api/cron/booking-reminders` | CRON_SECRET | Bokningspaminnelser |
| GET | `/api/email/unsubscribe` | HMAC-token | Avregistrera paminnelser |

### Gruppbokningar -- [detaljer](api/group-bookings.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/group-bookings` | Customer | Skapa grupprequest |
| GET | `/api/group-bookings` | Customer | Lista grupprequests |
| GET | `/api/group-bookings/[id]` | Session | Detaljer |
| PUT | `/api/group-bookings/[id]` | Skapare | Uppdatera/avbryt |
| POST | `/api/group-bookings/join` | Customer | Ga med via invite code |
| GET | `/api/group-bookings/available` | Provider | Oppna grupprequests |
| POST | `/api/group-bookings/[id]/match` | Provider | Matcha + skapa bokningar |
| DELETE | `/api/group-bookings/[id]/participants/[pid]` | Skapare/Deltagare | Ta bort deltagare |

### Rutter -- [detaljer](api/routes.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/route-orders` | Session | Lista ruttbestallningar |
| POST | `/api/route-orders` | Session | Skapa bestallning/annonsering |
| GET | `/api/route-orders/[id]` | - | Detaljer |
| GET | `/api/route-orders/available` | Provider | Tillgangliga bestallningar |
| GET | `/api/route-orders/my-orders` | Customer | Egna bestallningar |
| GET | `/api/route-orders/announcements` | - | Sok annonseringar (publikt) |
| POST | `/api/routes` | Provider | Skapa rutt |
| GET | `/api/routes/[id]` | Provider (agare) | Hamta rutt |
| GET | `/api/routes/my-routes` | Provider | Lista rutter |
| PATCH | `/api/routes/[id]/stops/[sid]` | Provider (agare) | Uppdatera stopp-status |

### Rost & AI -- [detaljer](api/voice-and-ai.md)

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| POST | `/api/voice-log` | Provider | Tolka rosttranskribering |
| POST | `/api/voice-log/confirm` | Provider | Bekrafta + spara tolkning |
| POST | `/api/provider/customers/[cid]/insights` | Provider | AI-drivna kundinsikter |

### Utilities

| Metod | Path | Auth | Beskrivning |
|-------|------|------|-------------|
| GET | `/api/health` | - | Health check |
| GET | `/api/geocode` | - | Geocoda adress till koordinater |
| POST | `/api/optimize-route` | - | Optimera ruttordning |
| POST | `/api/routing` | - | Korvagsbeskrivning (OSRM) |

---

*Senast uppdaterad: 2026-02-17*
