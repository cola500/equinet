# Skalningsplan: 500 användare

> **Status:** UTKAST - Väntar på teamgranskning
> **Skapad:** 2026-01-26
> **Mål:** Göra Equinet robust för 500 samtidiga användare

---

## Sammanfattning

Denna plan beskriver nödvändiga åtgärder för att skala Equinet från nuvarande kapacitet (~50 användare) till 500 samtidiga användare. Analysen har identifierat **10 potentiella flaskhalsar** och säkerhetsaspekter som måste adresseras.

**Uppskattad kapacitetsökning:** 10x
**Uppskattad implementation:** 2-3 veckor
**Uppskattad månadskostnad vid 500 användare:** ~$75-110/månad

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

## Fas 1: Kritiska åtgärder (Vecka 1)

### 1.1 Connection Pooling för Prisma

**Problem:** Varje serverless function skapar nya DB-connections. Vid hög last -> connection exhaustion.

**Lösning:**
```typescript
// src/lib/prisma.ts
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Använd Supabase Session Pooler (redan konfigurerad)
// Sätt connection_limit i connection string
// DATABASE_URL="postgres://...?pgbouncer=true&connection_limit=10"
```

**Uppgifter:**
- [ ] Verifiera att Supabase Session Pooler används
- [ ] Sätt `connection_limit=10` i DATABASE_URL
- [ ] Lägg till query timeout (10s)
- [ ] Testa under last

**Ansvarig:** _________________
**Deadline:** _________________

---

### 1.2 Geocoding Cache med Redis

**Problem:** Nominatim API: 1 request/sekund. Ingen caching = requests blockeras.

**Lösning:**
```typescript
// src/lib/cache/geocoding.ts
import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// SÄKER: Hash address för att förhindra cache key injection
function createSafeCacheKey(address: string): string {
  const normalized = address.trim().toLowerCase()
  const hash = crypto.createHash('sha256').update(normalized).digest('hex')
  return `geocode:${hash}`
}

export async function getCachedGeocode(address: string) {
  const key = createSafeCacheKey(address)
  return redis.get(key)
}

export async function setCachedGeocode(address: string, data: object) {
  const key = createSafeCacheKey(address)
  await redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(data)) // 30 dagar TTL
}
```

**Uppgifter:**
- [ ] Skapa `src/lib/cache/geocoding.ts`
- [ ] Integrera i `src/lib/geocoding.ts`
- [ ] Lägg till cache invalidation vid adressändringar
- [ ] Testa cache hit/miss

**Ansvarig:** _________________
**Deadline:** _________________

---

### 1.3 Rate Limiting på publika endpoints

**Problem:** `/api/providers`, `/api/geocode` saknar rate limiting.

**Lösning: Multi-layer rate limiting**
```typescript
// src/lib/rate-limit-enhanced.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Layer 1: Per-IP (100 req/min)
export const rateLimitPerIP = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:ip',
})

// Layer 2: Global (1000 req/min)
export const rateLimitGlobal = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '1 m'),
  prefix: 'ratelimit:global',
})

// Layer 3: Expensive endpoints (10 req/min)
export const rateLimitExpensive = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'ratelimit:expensive',
})
```

**Endpoints att uppdatera:**
- [ ] `GET /api/providers` - Standard rate limit
- [ ] `GET /api/geocode` - Expensive rate limit
- [ ] `GET /api/route-orders/available` - Standard rate limit

**Ansvarig:** _________________
**Deadline:** _________________

---

### 1.4 Bounding Box Geo-Queries

**Problem:** Geo-filtrering laddar ALLA providers och filtrerar i JavaScript.

**Lösning:**
```typescript
// I ProviderRepository.ts
async findWithinBoundingBox(bbox: BoundingBox, limit = 100) {
  return this.prisma.provider.findMany({
    where: {
      isActive: true,
      latitude: { gte: bbox.minLat, lte: bbox.maxLat },
      longitude: { gte: bbox.minLng, lte: bbox.maxLng },
    },
    select: {
      id: true,
      businessName: true,
      address: true,
      latitude: true,
      longitude: true,
      // Exkludera känsliga fält
    },
    take: limit,
  })
}
```

**Uppgifter:**
- [ ] Lägg till `findWithinBoundingBox` i ProviderRepository
- [ ] Skapa hjälpfunktion `calculateBoundingBox(lat, lng, radiusKm)`
- [ ] Validera max radius (100km) med Zod
- [ ] Uppdatera `/api/providers` route
- [ ] Testa performance

**Ansvarig:** _________________
**Deadline:** _________________

---

## Fas 2: Optimering (Vecka 2)

### 2.1 Provider-lista Cache

**Problem:** Provider-data ändras sällan men fetchas vid varje request.

**Lösning:**
```typescript
// 5 minuters TTL för provider-listan
const CACHE_TTL = 5 * 60

export async function GET(request: NextRequest) {
  const cacheKey = `providers:${searchParams.toString()}`

  // Check cache
  const cached = await redis.get(cacheKey)
  if (cached) return NextResponse.json(cached)

  // Fetch from DB
  const providers = await providerRepo.findAllWithDetails(...)

  // Cache (saniterad data)
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(providers))

  return NextResponse.json(providers)
}
```

**Uppgifter:**
- [ ] Implementera provider cache
- [ ] Cache invalidation vid provider-uppdatering
- [ ] Testa cache hit rate

**Ansvarig:** _________________
**Deadline:** _________________

---

### 2.2 Database Indexes

**Problem:** Notification-tabellen saknar index.

**Lösning:**
```prisma
// schema.prisma
model Notification {
  // ... existing fields

  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, isRead])
}
```

**Uppgifter:**
- [ ] Uppdatera schema.prisma
- [ ] Generera och kör migration
- [ ] Verifiera index-användning med EXPLAIN ANALYZE

**Ansvarig:** _________________
**Deadline:** _________________

---

### 2.3 Query Optimization (N+1)

**Problem:** Nested includes i routes-endpoint.

**Lösning:** Använd `select` istället för `include`.

**Filer att uppdatera:**
- [ ] `api/routes/route.ts` - Konvertera include → select
- [ ] `api/bookings/route.ts` - Verifiera select-användning

**Ansvarig:** _________________
**Deadline:** _________________

---

## Säkerhetsaspekter

> Granskat av: Security Team

### Kritiska säkerhetsåtgärder

| Åtgärd | Status | Kommentar |
|--------|--------|-----------|
| Cache key hashing (förhindra injection) | [ ] | Använd SHA-256 för address-baserade nycklar |
| Sanitera cached data (ta bort PII) | [ ] | Aldrig cacha passwordHash, email i public cache |
| Multi-layer rate limiting | [ ] | Per-IP + Global + Per-Endpoint |
| Bounding box max radius (100km) | [ ] | Förhindra kartläggning av alla providers |
| IP-validering i rate limiting | [ ] | Använd Vercel's x-real-ip header |
| Begränsa resultat (max 100) | [ ] | Förhindra data enumeration |

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
- [ ] Multi-layer rate limiting aktivt
- [ ] Ingen PII i publika caches
- [ ] Max radius validering på plats
- [ ] Abuse scenarios testade

### Operations
- [ ] Monitoring dashboards på plats
- [ ] Alerting konfigurerat
- [ ] Runbook för incidenter dokumenterad
- [ ] Load test passerat

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

*Senast uppdaterad: 2026-01-26*
