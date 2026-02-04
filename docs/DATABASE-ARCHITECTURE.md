# Databas-arkitektur - Equinet

> Hur databasen fungerar idag och vad som behövs för production readiness.

**Senast uppdaterad:** 2026-02-04
**Status:** Supabase PostgreSQL, single database för dev/prod

---

## Innehåll

1. [Nuvarande Arkitektur](#nuvarande-arkitektur)
2. [Connection Management](#connection-management)
3. [Miljöseparation (Dev/Staging/Prod)](#miljöseparation-devstagingprod)
4. [Migration Workflow](#migration-workflow)
5. [Backup & Återställning](#backup--återställning)
6. [Monitoring & Performance](#monitoring--performance)
7. [Säkerhetslager](#säkerhetslager)
8. [Kända Problem & Gotchas](#kända-problem--gotchas)
9. [Action Items](#action-items)

---

## Nuvarande Arkitektur

### Översikt

```
┌─────────────────┐
│   Vercel        │
│   Next.js 16    │
│   (Serverless)  │
└────────┬────────┘
         │ Prisma Client
         │ (service_role)
         ▼
┌─────────────────┐
│   PgBouncer     │
│ Session Pooler  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │
│   PostgreSQL    │
│   (21 tabeller) │
└─────────────────┘
```

### Connection Strings

Equinet använder två connection strings för olika ändamål:

```bash
# 1. SESSION POOLER - För applikationen (Vercel serverless)
DATABASE_URL="postgresql://postgres.[PROJECT]:pass@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=10"

# 2. DIRECT CONNECTION - För migrationer (lokalt/CI)
DIRECT_DATABASE_URL="postgresql://postgres.[PROJECT]:pass@aws-0-eu-north-1.pooler.supabase.com:5432/postgres"
```

**Varför två strings?**
- **Session Pooler**: PgBouncer-pooling för serverless -- hanterar connection reuse
- **Direct**: Krävs för Prisma migrations (`migrate dev`, `migrate deploy`)
- `connection_limit=10`: Optimalt för Vercel serverless (max 10 connections per function)

### Prisma Client Konfiguration

```typescript
// src/lib/prisma.ts (förenklat)
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

const prismaWithExtensions = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const timeout = 10000 // 10s timeout
        const start = Date.now()

        const result = await Promise.race([query(args), timeoutPromise])
        const duration = Date.now() - start

        if (duration > 2000) {
          logger.warn(`Slow query: ${model}.${operation} took ${duration}ms`)
        } else if (duration > 500) {
          logger.database(`${model}.${operation} (${duration}ms)`)
        }

        return result
      }
    }
  }
})
```

**Features:**
- 10 sekunder timeout på alla queries (förhindrar hung connections)
- Slow query logging (>2s varning, >500ms info)
- Development logging för debugging

### Databasschema

**21 tabeller** med index optimerade för vanliga queries:

| Tabell | Kritiska Index | Syfte |
|--------|----------------|-------|
| User | email, latitude/longitude | Användarkonton |
| Provider | isActive, city, businessName, lat/long | Leverantörsprofiler |
| Service | providerId+isActive | Tjänster |
| Booking | providerId+date+status, customerId, horseId | Bokningar |
| Horse | ownerId+isActive | Hästregister |
| Payment | bookingId, status+paidAt | Betalningar |
| AvailabilityException | providerId+date | Undantag från öppettider |
| Review | providerId+createdAt | Recensioner |
| (+ 13 andra) | ... | ... |

**Viktiga patterns:**
- Foreign keys + vanliga filter-kombinationer indexerade
- Geo-queries: `latitude`, `longitude` index på User, Provider, RouteOrder
- Composite unique constraints för race condition-skydd (t.ex. `Booking.unique_booking_slot`)
- Soft deletes: `isActive` boolean (ingen hård radering av data)

### RLS Security Model

**Status:** Aktiverat på alla 21 tabeller + `_prisma_migrations` sedan 2026-02-04

```sql
-- Migration: 20260204120000_enable_rls
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Provider" ENABLE ROW LEVEL SECURITY;
-- ... (19 fler)
```

**Approach: Deny-All**
- Inga permissive policies definierade
- PostgREST API (`anon` key): Blockerad helt
- Prisma (`service_role`): Full access (bypassar RLS)
- Supabase Dashboard: Full access

**Varför denna approach?**
- All dataåtkomst går genom server-side Prisma (ingen frontend database access)
- Authorization sköts i API routes (session + ownership checks)
- RLS är "defense in depth" om `anon` key skulle läcka
- Enklast att underhålla (inga komplexa policies)

---

## Connection Management

### PgBouncer Session Pooler

Supabase Session Pooler använder **PgBouncer** i session mode:

```
Vercel Function 1  ──┐
Vercel Function 2  ──┼──> PgBouncer ──> PostgreSQL
Vercel Function 3  ──┘    (Pool: 10)    (Max: 100)
```

**Fördelar:**
- Connection reuse mellan requests
- Låg latency (ingen connection overhead per query)
- Fungerar med Prisma transactions

**Begränsningar:**
- Prepared statements måste re-prepared per connection
- Session-level settings (SET commands) fungerar inte mellan requests

### Connection Limits

```bash
DATABASE_URL="...?pgbouncer=true&connection_limit=10"
```

**Varför 10?**
- Vercel serverless: Många korta funktioner (30s-300s livstid)
- Högre gräns = risk för pool exhaustion vid traffic-spike
- Lägre gräns = färre simultana queries men säkrare

**Supabase limits (Free tier):**
- Max 100 simultana connections till PostgreSQL
- Session Pooler: Shared pool mellan alla clients

### Transaction Pattern

**Problem:** `Promise.all` med många operations kan överskrida connection limit.

```typescript
// FEL - 7 parallella connections
const promises = schedule.map(item =>
  prisma.availability.upsert({ where: {...}, ... })
)
await Promise.all(promises)  // 7 connections samtidigt!

// RÄTT - 1 connection via transaction
await prisma.$transaction(async (tx) => {
  await tx.availability.deleteMany({ where: { providerId } })

  for (const item of schedule) {
    await tx.availability.create({ data: { providerId, ...item } })
  }

  return tx.availability.findMany({ where: { providerId } })
})
```

**Pattern: Använd `$transaction` för:**
- Batch CRUD-operationer (skapa/uppdatera många records)
- Operationer som ska vara atomära (allt eller inget)
- När du behöver flera write-operations som hör ihop

**Bonus:** Transactions ger rollback vid fel -- data consistency garanterad.

---

## Miljöseparation (Dev/Staging/Prod)

### Nuvarande Problem

**En databas för allt:**
```
Dev (lokal) ─┐
Dev (CI)    ─┼──> Samma Supabase-projekt
Prod        ─┘
```

**Risker:**
- `db:seed:force` i dev påverkar produktion (om man kör fel connection string)
- Schema-ändringar kan inte testas isolerat
- Preview deployments (Vercel) delar production data
- Debugging kan exponera produktionsdata

### Rekommenderad Lösning: 3 Separata Databaser

```
┌─────────────────┐
│  Development    │  Supabase Project: equinet-dev
│  localhost:3000 │  Free tier, seedad med test-data
│  + CI tests     │  Återställs ofta, ingen känslig data
└─────────────────┘

┌─────────────────┐
│  Staging        │  Supabase Project: equinet-staging
│  (Vercel prev.) │  Free tier, subset av prod-data
│  PR previews    │  Migrations testas här först
└─────────────────┘

┌─────────────────┐
│  Production     │  Supabase Project: equinet-prod
│  equinet.se     │  Paid tier (för backups/support)
│  Live traffic   │  Verklig användardata
└─────────────────┘
```

### Setup-process

**1. Skapa Supabase-projekt**

```
Development:  equinet-dev     | Region: EU North (Stockholm) | Plan: Free
Staging:      equinet-staging | Region: EU North (Stockholm) | Plan: Free
Production:   equinet-prod    | Region: EU North (Stockholm) | Plan: Pro ($25/mo)
```

Spara database passwords i lösenordshanterare.

**2. Environment Variables per miljö**

```bash
# .env (lokal development)
DATABASE_URL="postgresql://...equinet-dev..."
DIRECT_DATABASE_URL="postgresql://...equinet-dev..."

# Vercel: Preview (staging)
DATABASE_URL="postgresql://...equinet-staging..."
DIRECT_DATABASE_URL="postgresql://...equinet-staging..."

# Vercel: Production
DATABASE_URL="postgresql://...equinet-prod..."
DIRECT_DATABASE_URL="postgresql://...equinet-prod..."
```

**3. Migration workflow**

```bash
# Dev: Skapa ny migration
npx prisma migrate dev --name add_new_field

# Committa migration
git add prisma/migrations/
git commit -m "feat: add new_field to MyModel"

# Push till GitHub -> CI kör tester mot dev DB

# Merge till main -> Vercel preview deployment
# -> Kör automatiskt `prisma migrate deploy` mot staging DB

# Efter verifiering: Promote till production
# -> Kör `prisma migrate deploy` mot prod DB
```

### Kostnad & Free Tier-begränsningar

| Feature | Free | Pro ($25/mo) |
|---------|------|--------------|
| Database size | 500 MB | 8 GB |
| Bandwidth | 5 GB | 250 GB |
| Backups | Daily (7 days) | PITR (30 days) |
| Pausing | After 7 days inactive | Never |
| Support | Community | Email |

**Rekommendation:**
- **Dev & Staging:** Free tier (resettas ofta, ingen kritisk data)
- **Production:** Pro tier (PITR, support, ingen pausing)

**Total kostnad:** $25/månad för production database

---

## Migration Workflow

### Nuvarande Setup

Equinet använder **Prisma Migrate** med baseline-migration:

```bash
prisma/migrations/
├── 0_init/                           # Baseline (hela schemat)
│   └── migration.sql
├── 20260204120000_enable_rls/        # RLS-aktivering
│   └── migration.sql
└── migration_lock.toml
```

**Baseline-konceptet:**
- `0_init` representerar hela schemat när migrations-workflow startades
- Markerad som applicerad via `prisma migrate resolve --applied 0_init`
- Nya ändringar skapar egna migrations efter baseline

### Development Workflow

```bash
# 1. Ändra schema
vim prisma/schema.prisma

# 2. Skapa och applicera migration
npx prisma migrate dev --name add_horse_color

# Prisma gör automatiskt:
# - Skapar migration SQL-fil
# - Applicerar mot databas
# - Regenererar Prisma Client
# - Kör seed (om konfigurerad)

# 3. Verifiera
npm run typecheck     # TypeScript ser nya typer
npm run test:run      # Tester mot nya schema
```

### Staging/Production Deployment

```bash
# Vercel build script (package.json)
"postinstall": "prisma generate",
"vercel-build": "prisma migrate deploy && next build"

# Manuell deploy (om behövs)
npx prisma migrate deploy
npm run build
```

**`migrate deploy` vs `migrate dev`:**

| Kommando | Användning | Vad det gör |
|----------|------------|-------------|
| `migrate dev` | Lokal dev | Skapar migrations, hanterar drift, kör seed |
| `migrate deploy` | CI/Prod | Kör **endast** pending migrations, ingen drift detection |

**Viktigt:** Använd **aldrig** `db push` i projekt med migrations (skippar historik).

### Rollback-strategi

**Scenario:** Migration går fel i production.

```bash
# 1. Identifiera senaste migration
npx prisma migrate status

# 2. Revert via SQL (manuellt)
# Prisma har ingen "migrate rollback" -- du måste skapa en ny migration
# som revertar ändringarna

# 3. Markera som applied (om du revertat manuellt)
npx prisma migrate resolve --rolled-back [migration-name]

# 4. Skapa fix-migration
npx prisma migrate dev --name revert_bad_change
```

**Bästa practices:**
- Testa migrations i staging **först**
- Gör databas-backup före stora migrations
- Skriv DOWN-migrations manuellt i kommentarer
- Använd `BEGIN; ... ROLLBACK;` för att dry-run manuella SQL-ändringar

---

## Backup & Återställning

### Supabase Default Backups

**Free tier:**
- Dagliga backups
- 7 dagars retention
- Manuell restore via Supabase Dashboard

**Pro tier ($25/månd):**
- Point-in-Time Recovery (PITR)
- 30 dagars retention
- Restore till valfri tidpunkt

### Manual Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/equinet_backup_$DATE.sql"

mkdir -p $BACKUP_DIR

# Hämta från Supabase via pg_dump
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  > "$BACKUP_FILE"

echo "Backup saved: $BACKUP_FILE"

# Komprimera
gzip "$BACKUP_FILE"
echo "Compressed: $BACKUP_FILE.gz"

# Cleanup: behåll bara senaste 30 dagarna
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery Plan

**Scenario 1: Data corruption**

1. Stoppa traffic (sätt app i maintenance mode)
2. Restore från backup via Supabase Dashboard
3. Verifiera data integrity
4. Aktivera app igen

**Scenario 2: Accidental delete/update**

Med PITR (Pro tier):
1. Supabase Dashboard -> Restore -> Point in Time
2. Välj timestamp innan felet
3. Restore skapar NY databas (original intakt)
4. Migrera data manuellt eller byt connection string

**Scenario 3: Migration failure**

1. Rollback migration (se [Migration Workflow](#migration-workflow))
2. Fix schema.prisma
3. Skapa ny migration med fix
4. Deploy fix

### Backup Checklist

- [ ] Dagliga backups aktiverade (Supabase default)
- [ ] PITR aktiverat för production (Pro tier)
- [ ] Manual backup script för extra säkerhet
- [ ] Restore-process testad minst 1 gång/kvartal
- [ ] Backup retention policy dokumenterad
- [ ] Off-site backups (S3/Dropbox) för critical data

---

## Monitoring & Performance

### Slow Query Detection

Equinet har **built-in slow query logging** via Prisma extensions:

```typescript
// src/lib/prisma.ts
if (duration > 2000) {
  logger.warn(`Slow query: ${model}.${operation} took ${duration}ms`)
} else if (duration > 500) {
  logger.database(`${model}.${operation} (${duration}ms)`)
}
```

**Varför 2s threshold?**
- Serverless functions har 10s default timeout på Vercel
- 2s+ queries riskerar timeout vid hög load
- Användare förväntar sig svar <1s för bra UX

**Hur övervaka:**
```bash
# Vercel logs (production)
vercel logs --filter "Slow query"

# Sentry (om konfigurerad)
# Slow queries syns som "performance issues"
```

### Connection Pool Monitoring

```sql
-- Kolla aktiva connections i Supabase SQL Editor
SELECT count(*) FROM pg_stat_activity
WHERE datname = 'postgres'
  AND state = 'active';

-- Hitta långvariga queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

**Varningssignaler:**
- Många connections i "idle" state (connection leak)
- Connections >10 simultant (överskrider `connection_limit`)
- Queries som tar >10s (timeout-risk)

### Supabase Dashboard Metrics

**Database -> Performance:**
- Active connections (real-time)
- Query latency (p50, p95, p99)
- Database size
- Table sizes
- Cache hit ratio

**Alerts att sätta upp:**
- Active connections >80 (av 100 max)
- Cache hit ratio <90% (ineffektiv indexering)
- Database size >400 MB (80% av free tier)
- Query latency p95 >2s

### Sentry Database Monitoring

Prisma errors loggas automatiskt till Sentry (om konfigurerat med `NEXT_PUBLIC_SENTRY_DSN`):

- Unique constraint violations
- Foreign key errors
- Query timeouts
- Connection errors

**Konfigurera Sentry alerts:**
1. Sentry Dashboard -> Alerts
2. **Database Error Rate > 5 errors/hour**
3. **Slow Query Alert** (om Sentry Performance är aktivt)

---

## Säkerhetslager

Equinet har **4 lager av säkerhet** för data access:

### Lager 1: Row Level Security (Database)

```sql
-- Alla tabeller har RLS aktiverat (deny-all)
-- PostgREST API: Blockerad
-- Prisma (service_role): Full access
```

**Skydd mot:** Direct database access via Supabase anon key, PostgREST API exploitation

### Lager 2: Session-baserad Authorization (API Routes)

```typescript
const session = await auth()
if (!session?.user?.id) {
  return new Response("Unauthorized", { status: 401 })
}
```

**Skydd mot:** Oautentiserade requests, stulna/expired tokens

### Lager 3: Ownership Checks (Prisma WHERE)

```typescript
// Authorization i WHERE clause (atomärt, förhindrar IDOR + race conditions)
const booking = await prisma.booking.update({
  where: {
    id: bookingId,
    customerId: session.user.id  // Ownership check
  },
  data: { status: "cancelled" }
})

if (!booking) {
  return new Response("Not found or unauthorized", { status: 404 })
}
```

**Skydd mot:** IDOR (Insecure Direct Object Reference), TOCTOU race conditions, privilege escalation

### Lager 4: Rate Limiting (Redis)

```typescript
// Rate limit FÖRE request parsing
const ip = getClientIP(request)
const allowed = await rateLimiters.booking(ip)

if (!allowed) {
  return new Response("Too many requests", { status: 429 })
}
```

**9 typer av rate limiters:**

| Limiter | Limit | Window |
|---------|-------|--------|
| Login | 5 försök | 15 min |
| Registration | 3 försök | 1h |
| API | 100 requests | 1 min |
| Booking | 10 bokningar | 1h |
| Password reset | 3 försök | 1h |
| Profile update | 20 uppdateringar | 1h |
| Service create | 10 tjänster | 1h |
| Geocode | 30 requests | 1 min |
| Resend verification | 3 försök | 15 min |

**Skydd mot:** Brute force attacks, API abuse, resource exhaustion (DDoS)

### Connection-säkerhet

- Environment variables committas aldrig (`.env` i `.gitignore`)
- Prisma använder `service_role` (bypassar RLS) -- exponeras aldrig till frontend
- TLS krävs av Supabase (krypterad transport)

---

## Kända Problem & Gotchas

### 1. DATE-kolumner och Timezone

**Problem:** Prisma `@db.Date` kolumner lagrar endast datum, men JavaScript `Date` har timezone.

```typescript
// FEL - Lokal tid ger off-by-one i UTC
const date = new Date(2026, 0, 27)  // 2026-01-26T23:00:00Z (UTC+1)

// RÄTT - Explicit UTC
const date = new Date("2026-01-27T00:00:00.000Z")
```

**Använd alltid:** `src/lib/date-utils.ts` -> `parseDate()` för konsekvent parsing.

**Impact:** Records hittas inte vid UPDATE/DELETE om timezone är inkonsekvent.

### 2. Connection Pool Exhaustion

**Problem:** `Promise.all` med många Prisma-operationer kan överskrida `connection_limit=10`.

**Symptom:** `FATAL: MaxClientsInSessionMode: max clients reached`

**Lösning:** Använd `$transaction` (se [Connection Management](#connection-management)).

### 3. Prisma Studio Zombie Processes

**Problem:** `npm run db:studio` stängs inte automatiskt -- ackumuleras i bakgrunden.

```bash
# Kolla om Prisma Studio körs
ps aux | grep prisma

# Döda alla instanser
pkill -f "prisma studio"
```

**Impact:** Äter upp database connections över tid.

### 4. Supabase Free Tier Pausing

**Problem:** Free tier projects pausas efter 7 dagars inaktivitet.

**Symptom:** App ger connection errors, Supabase Dashboard säger "Project paused".

**Lösning:**
- Resume project manuellt via Dashboard
- **Production:** Använd Pro tier (ingen auto-pause)
- **Dev:** Acceptera att dev DB kan pausa

### 5. Migration Drift Detection

**Problem:** Om någon kör `db push` eller manuella SQL-ändringar bypassas migration-historik.

**Symptom:** `prisma migrate dev` failar med "Database schema is not in sync with migration history".

**Lösning:**
```bash
# Skapa baseline från current state
npx prisma migrate dev --create-only --name catch_up
# Granska SQL-filen, justera vid behov
npx prisma migrate dev
```

**Prevention:** Använd **aldrig** `db push` när migrations är aktiverade.

---

## Action Items

### P0: KRITISKT (Före production launch)

#### 1. Separera Dev/Staging/Prod Databaser

**Uppgift:**
1. Skapa 3 Supabase-projekt (dev, staging, prod)
2. Konfigurera environment variables per miljö i Vercel
3. Kör `prisma migrate deploy` mot alla nya databaser
4. Kör `db:seed` mot dev och staging
5. Uppgradera production till Pro tier ($25/månad)

**Risk om ej åtgärdat:**
- Accidental data corruption i production från dev-aktiviteter
- Ingen isolerad staging för migration-testning
- Preview deployments exponerar production data

#### 2. Konfigurera Production Backups

**Uppgift:**
1. Verifiera Supabase daily backups är aktiverade
2. Uppgradera till Pro tier för PITR
3. Testa restore-processen 1 gång

**Risk om ej åtgärdat:**
- Ingen återställning vid migration-fel
- Data loss vid corruption/accidental delete

---

### P1: HÖGT (Inom 2 veckor efter launch)

#### 3. Sätt upp Database Monitoring & Alerts

**Uppgift:**
1. Konfigurera Supabase Dashboard alerts (connections, size, cache hit ratio)
2. Verifiera Sentry fångar database errors (`NEXT_PUBLIC_SENTRY_DSN`)
3. Sätt upp notifieringar för alerts

**Risk om ej åtgärdat:**
- Ingen varning innan connection pool exhaustion
- Slow queries upptäcks först via user complaints

#### 4. Optimera Indexes Baserat på Produktion

**Uppgift:**
1. Samla query-patterns efter launch
2. Analysera slow queries i Supabase Dashboard
3. Identifiera saknade index via `EXPLAIN ANALYZE`
4. Skapa migration för nya index

**Risk om ej åtgärdat:**
- Vissa queries kan vara 10-30x långsammare än nödvändigt

---

### P2: MEDEL (Inom 1 månad)

#### 5. Tune Connection Pooling för Production Load

**Uppgift:**
1. Analysera Vercel function invocations/min
2. Mät connection usage i Supabase Dashboard
3. Justera `connection_limit` parameter vid behov

#### 6. Dokumentera Slow Query Troubleshooting Runbook

**Uppgift:**
1. Steg-för-steg för slow query investigation
2. `EXPLAIN ANALYZE` exempel
3. Index optimization guide

---

### P3: LÅGT (Nice-to-have)

#### 7. Automatisera Backup till S3

Off-site backups via cron/Vercel Cron för extra redundancy.

#### 8. Implementera Query Result Caching

Redis-cache för read-heavy queries (provider listings, service catalog) med invalidation strategy.

---

## Relaterade Dokument

- [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) - Full deployment guide
- [GOTCHAS.md](GOTCHAS.md) - Vanliga databas-gotchas
- [RLS-SECURITY-FINDINGS.md](RLS-SECURITY-FINDINGS.md) - RLS implementation details
- [SECURITY-REVIEW-2026-01-21.md](SECURITY-REVIEW-2026-01-21.md) - Säkerhetsaudit
- [CLAUDE.md](../CLAUDE.md) - Utvecklingsguide (inkl. Prisma patterns)
