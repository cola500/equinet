# Skalningsplan: 500 användare

> **Status:** FAS 2 IMPLEMENTERAD ✅
> **Skapad:** 2026-01-26
> **Uppdaterad:** 2026-01-27 (Fas 2 implementerad)
> **Mål:** Göra Equinet robust för 500 samtidiga användare

---

## Sammanfattning

Denna plan beskriver nödvändiga åtgärder för att skala Equinet från nuvarande kapacitet (~50 användare) till 500 samtidiga användare. Analysen har identifierat **10 potentiella flaskhalsar** och säkerhetsaspekter som måste adresseras.

**Uppskattad kapacitetsökning:** 10x
**Uppskattad implementation:** 2-3 veckor
**Uppskattad månadskostnad vid 500 användare:** ~$75-110/månad

### Implementation Status

| Fas | Åtgärd | Status | Branch |
|-----|--------|--------|--------|
| 1.1 | Connection pooling | ✅ Mergad till main | main |
| 1.2 | Geocoding cache | ✅ Mergad till main | main |
| 1.3 | Rate limiting | ✅ Mergad till main | main |
| 1.4 | Bounding box queries | ✅ Mergad till main | main |
| 2.1 | Provider-lista cache | ✅ Mergad till main | main |
| 2.2 | Database indexes | ✅ Mergad till main | main |
| 2.3 | Query optimization | ✅ Mergad till main | main |

---

## ✅ MANUELLA STEG (Alla klara!)

### 1. Uppdatera produktions-miljövariabler ✅ KLART

**Konfigurerat i Vercel:** 2026-01-27
- `DATABASE_URL` med `?pgbouncer=true&connection_limit=10`
- `DIRECT_DATABASE_URL` för migrations

### 2. Verifiera Upstash Redis ✅ KLART

**Verifierat:** 2026-01-27
- `UPSTASH_REDIS_REST_URL` konfigurerad
- `UPSTASH_REDIS_REST_TOKEN` konfigurerad

### 3. Merge feature branch ✅ KLART

**Mergad:** 2026-01-27

### 4. Deploy och verifiera ✅ KLART

**Verifierad:** 2026-01-27

| Test | Förväntat | Resultat |
|------|-----------|----------|
| `GET /api/providers` | 200 + data | ✅ Passerade |
| `GET /api/providers?radiusKm=150...` | 400 (max 100km) | ✅ Passerade |
| `GET /api/geocode?address=Stockholm` | 200 + koordinater | ✅ Passerade |
| Geocoding cache | Snabbare 2:a request | ✅ ~950ms → ~580ms |
| Rate limiting (Upstash) | 429 efter 30 req | ✅ Triggered vid req 29 |

---

---

## Identifierade flaskhalsar

### Kritiska (HÖG prioritet)

| # | Problem | Fil | Konsekvens |
|---|---------|-----|------------|
| 1 | Ingen connection pooling | `src/lib/prisma.ts` | DB-connections tar slut vid >100 användare |
| 2 | Geocoding rate limit (1 req/s) | `src/lib/geocoding.ts` | Nominatim blockerar, provider-annonseringar failar |
| 3 | In-memory geo-filtrering | `api/providers/route.ts:74-99` | Laddar ALLA providers för varje sökning |
| 4 | Saknad rate limiting | Publika endpoints | DoS-sårbarhet, systemöverbelastning |

### Medium prioritet

| # | Problem | Fil | Konsekvens |
|---|---------|-----|------------|
| 5 | Ingen caching | `api/providers/` | 500 DB-queries/sekund vid peak |
| 6 | N+1 queries | `api/routes/route.ts` | Långsamma page loads vid många stops |
| 7 | Saknade indexes | `schema.prisma` (Notification) | Långsamma notification-queries |
| 8 | Upstash single point of failure | `src/lib/rate-limit.ts` | Om Redis nere = ingen rate limiting |

### Låg prioritet

| # | Problem | Fil | Konsekvens |
|---|---------|-----|------------|
| 9 | Serializable transactions | `api/bookings/route.ts` | Långsammare bookings vid hög last |
| 10 | Session update frequency | `auth.config.ts` | Onödiga cookie-updates |

---

## Fas 1: Kritiska åtgärder (Vecka 1) ✅ MERGAD TILL MAIN

### 1.1 Connection Pooling för Prisma ✅

**Status:** Implementerad i `prisma/schema.prisma` och `.env.example`

**Vad som gjordes:**
- Lade till `directUrl` i schema.prisma för migrations
- Uppdaterade `.env.example` med `pgbouncer=true&connection_limit=10`
- Lade till `checkDatabaseHealth()` funktion för monitoring

**Filer:**
- `prisma/schema.prisma` - directUrl konfiguration
- `.env.example` - dokumenterade connection params
- `src/lib/prisma.ts` - health check funktion

**Uppgifter:**
- [x] Verifiera att Supabase Session Pooler används
- [x] Sätt `connection_limit=10` i DATABASE_URL (i .env.example)
- [x] Lägg till query timeout (10s) - redan implementerat
- [x] Lokal .env uppdaterad med pgbouncer + DIRECT_DATABASE_URL
- [x] Uppdatera production .env i Vercel (2026-01-27)
- [ ] Testa under last

---

### 1.2 Geocoding Cache med Redis ✅

**Status:** Implementerad i `src/lib/cache/geocoding-cache.ts`

**Vad som gjordes:**
- Skapade `geocoding-cache.ts` med Upstash Redis integration
- SHA-256 hashade cache keys (förhindrar injection)
- 30 dagars TTL (adresser ändrar sällan plats)
- Graceful fallback om Redis är nere

**Filer:**
- `src/lib/cache/geocoding-cache.ts` - cache implementation
- `src/lib/geocoding.ts` - integrerad cache

**Uppgifter:**
- [x] Skapa `src/lib/cache/geocoding-cache.ts`
- [x] Integrera i `src/lib/geocoding.ts`
- [x] SHA-256 cache key hashing
- [x] Verifiera Upstash credentials i production (2026-01-27)
- [x] Testa cache hit/miss efter deploy (~950ms → ~580ms)

---

### 1.3 Rate Limiting på publika endpoints ✅

**Status:** Implementerad i `src/lib/rate-limit.ts` och API routes

**Vad som gjordes:**
- Lade till `getClientIP()` med IP-validering (förhindrar header injection)
- Lade till `geocode` rate limiter (30 req/min)
- Uppdaterade tre endpoints med rate limiting

**Rate limits:**
| Endpoint | Limit | Typ |
|----------|-------|-----|
| `/api/providers` | 100 req/min | Standard |
| `/api/geocode` | 30 req/min | Expensive |
| `/api/route-orders/available` | 100 req/min | Standard |

**Filer:**
- `src/lib/rate-limit.ts` - getClientIP + geocode limiter
- `src/app/api/providers/route.ts` - rate limited
- `src/app/api/geocode/route.ts` - rate limited
- `src/app/api/route-orders/available/route.ts` - rate limited

**Uppgifter:**
- [x] `GET /api/providers` - Standard rate limit
- [x] `GET /api/geocode` - Expensive rate limit (30/min)
- [x] `GET /api/route-orders/available` - Standard rate limit
- [x] IP-validering (förhindrar spoofing)

---

### 1.4 Bounding Box Geo-Queries ✅

**Status:** Implementerad i `src/lib/geo/bounding-box.ts` och ProviderRepository

**Vad som gjordes:**
- Skapade `bounding-box.ts` med `calculateBoundingBox()` funktion
- Lade till `boundingBox` filter i ProviderFilters interface
- Uppdaterade ProviderRepository för att filtrera i DB
- Max radius validering (100km) i `/api/providers`

**Prestandaförbättring:**
```
Innan: DB → hämta ALLA providers → JS filter (O(n) för alla)
Efter:  DB → hämta providers i box → JS filter (O(m) där m << n)
```

**Filer:**
- `src/lib/geo/bounding-box.ts` - beräkning + validering
- `src/infrastructure/persistence/provider/IProviderRepository.ts` - interface
- `src/infrastructure/persistence/provider/ProviderRepository.ts` - implementation
- `src/app/api/providers/route.ts` - använder bounding box

**Uppgifter:**
- [x] Skapa `calculateBoundingBox(lat, lng, radiusKm)` funktion
- [x] Lägg till boundingBox filter i ProviderRepository
- [x] Validera max radius (100km)
- [x] Uppdatera `/api/providers` route
- [ ] Load-testa med 1000 providers

---

## Fas 2: Optimering (Vecka 2) ✅ IMPLEMENTERAD

### 2.1 Provider-lista Cache ✅

**Status:** Implementerad i `src/lib/cache/provider-cache.ts`

**Vad som gjordes:**
- Skapade `provider-cache.ts` med Upstash Redis integration
- SHA-256 hashade cache keys (baserade på filter-parametrar)
- 5 minuters TTL (providers uppdateras oftare än geo-data)
- Graceful fallback om Redis är nere (fail-open)
- `invalidateProviderCache()` för cache invalidation

**Filer:**
- `src/lib/cache/provider-cache.ts` - cache implementation
- `src/app/api/providers/route.ts` - integrerad cache

**Uppgifter:**
- [x] Implementera provider cache
- [x] Cache invalidation vid provider-uppdatering
- [ ] Testa cache hit rate i produktion

---

### 2.2 Database Indexes ✅

**Status:** Implementerad i `prisma/schema.prisma`

**Vad som gjordes:**
- Lade till `@@index([userId, isRead])` för "olästa notifikationer"
- Lade till `@@index([userId, createdAt])` för "senaste notifikationer"
- Schema synkat med `prisma db push`

**Filer:**
- `prisma/schema.prisma` - indexes tillagda

**Uppgifter:**
- [x] Uppdatera schema.prisma
- [x] Kör migration/db push
- [ ] Verifiera index-användning med EXPLAIN ANALYZE

---

### 2.3 Query Optimization (N+1) ✅

**Status:** Implementerad i routes och route-orders

**Vad som gjordes:**
- Konverterade nested `include` till `select` i `/api/routes`
- Konverterade `include` till `select` i `/api/route-orders` (announcements)
- Hämtar nu endast nödvändiga fält istället för hela objekt

**Filer:**
- `src/app/api/routes/route.ts` - select istället för include
- `src/app/api/route-orders/route.ts` - select istället för include

**Uppgifter:**
- [x] `api/routes/route.ts` - Konvertera include → select
- [x] `api/route-orders/route.ts` - Konvertera include → select

---

## Säkerhetsaspekter

> Granskat av: Security Team

### Kritiska säkerhetsåtgärder

| Åtgärd | Status | Kommentar |
|--------|--------|-----------|
| Cache key hashing (förhindra injection) | ✅ | SHA-256 i `geocoding-cache.ts` |
| Sanitera cached data (ta bort PII) | ✅ | Endast lat/lng cachas |
| Multi-layer rate limiting | ✅ | Per-IP + Per-Endpoint implementerat |
| Bounding box max radius (100km) | ✅ | Valideras i `/api/providers` |
| IP-validering i rate limiting | ✅ | `getClientIP()` validerar format |
| Begränsa resultat (max 100) | ✅ | Implementerad i `/api/providers` med pagination |

### Potentiella sårbarheter att bevaka

1. **Cache poisoning** - Om cache keys inte hashas kan angripare injicera data
2. **Rate limit bypass** - Header spoofing om x-forwarded-for används naivt
3. **Information disclosure** - Timing-attacker kan avslöja cache hit/miss
4. **DoS via stora bounding boxes** - Utan max radius kan hela DB:n fetças

### Säkerhetsteamets signering

- [ ] Jag har granskat implementationsplanerna
- [ ] Säkerhetsrekommendationerna är inkorporerade
- [ ] Load testing-plan inkluderar abuse scenarios

**Signatur:** _________________
**Datum:** _________________

---

## DevOps-aspekter

> Granskat av: DevOps Team

### Infrastruktur-krav

| Komponent | Nuvarande | Efter skalning | Kostnad/mån |
|-----------|-----------|----------------|-------------|
| Supabase PostgreSQL | Free tier | Pro ($25) | $25 |
| Upstash Redis | Pay-as-you-go | ~10k req/dag | $0-10 |
| Vercel Hosting | Hobby | Pro ($20) | $20 |
| **Total** | ~$0 | | **~$45-55** |

### Monitoring att implementera

**Kritiska metrics:**
- [ ] Database connection pool saturation (alert >80%)
- [ ] API response times P95/P99 (target: <500ms/<2000ms)
- [ ] Rate limiter rejection rate (alert >10%)
- [ ] Geocoding cache hit rate (target: >90%)
- [ ] Redis latency P95 (alert >100ms)

**Verktyg:**
- [ ] Sentry - Error tracking (redan konfigurerat)
- [ ] Vercel Analytics - Performance monitoring
- [ ] Upstash Dashboard - Redis metrics

### Deployment Checklist

**Innan deploy:**
- [ ] Alla environment variables satta i Vercel
- [ ] Database migration körd i production
- [ ] Redis connection testad
- [ ] Rollback-plan dokumenterad

**Efter deploy:**
- [ ] Smoke test av kritiska endpoints
- [ ] Verifiera rate limiting fungerar
- [ ] Kontrollera cache hit rate
- [ ] Monitor error rate i Sentry

### Load Testing Plan

```bash
# Använd k6 för load testing
k6 run --vus 100 --duration 5m load-test.js
```

**Scenarios att testa:**
1. Normal load (50 VUs, 5 min)
2. Peak load (200 VUs, 2 min)
3. Spike test (0 → 500 VUs, 1 min)
4. Abuse scenario (rate limit bypass attempts)

### DevOps-teamets signering

- [ ] Infrastruktur-kostnaderna är godkända
- [ ] Monitoring-plan är implementerbar
- [ ] Load testing kommer genomföras innan go-live

**Signatur:** _________________
**Datum:** _________________

---

## Tidplan

```
Vecka 1: Kritiska åtgärder
├── Dag 1-2: Connection pooling + Geocoding cache
├── Dag 3-4: Rate limiting implementation
└── Dag 5: Bounding box geo-queries

Vecka 2: Optimering + Testing
├── Dag 1-2: Provider cache + DB indexes
├── Dag 3: Query optimization
├── Dag 4: Load testing
└── Dag 5: Bugfixar + dokumentation

Vecka 3: Deployment
├── Dag 1: Staging deploy + test
├── Dag 2: Production deploy
└── Dag 3-5: Monitoring + finjustering
```

---

## Definition of Done

Skalningsarbetet är **KLART** när:

### Funktionalitet
- [ ] Systemet hanterar 500 samtidiga användare utan degradering
- [ ] Alla API-svar under 500ms (P95)
- [ ] Cache hit rate >80% för providers och geocoding
- [ ] Inga timeout-errors i Sentry

### Säkerhet
- [x] Multi-layer rate limiting aktivt (verifierat 2026-01-27)
- [x] Ingen PII i publika caches (endast lat/lng cachas)
- [x] Max radius validering på plats (verifierat 2026-01-27)
- [ ] Abuse scenarios testade

### Operations
- [ ] Monitoring dashboards på plats
- [ ] Alerting konfigurerat
- [ ] Runbook för incidenter dokumenterad
- [ ] Load test passerat

### Dokumentation
- [x] Implementation status uppdaterad i skalning.md
- [x] Verifieringsresultat dokumenterade
- [ ] README uppdaterad vid behov
- [ ] CLAUDE.md uppdaterad med learnings

---

## Signeringar

### Utvecklingsteam
- [ ] Tekniska lösningar granskade och godkända

**Signatur:** _________________
**Datum:** _________________

### Säkerhetsteam
- [ ] Säkerhetsaspekter granskade och godkända

**Signatur:** _________________
**Datum:** _________________

### DevOps-team
- [ ] Infrastruktur och deployment-plan godkänd

**Signatur:** _________________
**Datum:** _________________

### Produktägare
- [ ] Kostnad och tidplan godkänd

**Signatur:** _________________
**Datum:** _________________

---

## Appendix

### A. Estimerade kostnader vid olika användarnivåer

| Användare | Supabase | Upstash | Vercel | Total/mån |
|-----------|----------|---------|--------|-----------|
| 0-50 | Free | Free | Free | $0 |
| 50-200 | Pro $25 | ~$5 | Hobby | ~$30 |
| 200-500 | Pro $25 | ~$10 | Pro $20 | ~$55 |
| 500+ | Pro $50 | ~$20 | Pro $20 | ~$90 |

### B. Rollback-plan

Om skalningsändringar orsakar problem:

1. **Cache-relaterade problem:**
   ```bash
   # Rensa all cache i Upstash
   redis-cli FLUSHALL
   ```

2. **Rate limiting för aggressivt:**
   - Öka limits temporärt i `rate-limit-enhanced.ts`
   - Deploy omedelbart

3. **Database-problem:**
   - Återställ till tidigare migration
   - Kontakta Supabase support

### C. Kontaktinformation

| Roll | Namn | Kontakt |
|------|------|---------|
| Tech Lead | | |
| Security Lead | | |
| DevOps Lead | | |
| Product Owner | | |

---

*Senast uppdaterad: 2026-01-27 (Fas 2 + pagination implementerad)*
