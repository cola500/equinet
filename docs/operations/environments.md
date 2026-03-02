# Miljoer (Environments)

---

## Oversikt

| Miljo | URL | Databas | Deploy |
|-------|-----|---------|--------|
| **Lokal** | `localhost:3000` | Docker PostgreSQL (localhost:5432) | `npm run dev` |
| **Produktion** | Vercel-URL | Supabase (eu-central-2) | `git push` -> Vercel auto-deploy |

> Staging-miljo ar planerad men inte implementerad annu (se [NFR.md](../../NFR.md)).

---

## Lokal utveckling

### Databas

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/equinet
DIRECT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/equinet
```

Startas med `npm run db:up` (Docker Compose, `postgres:17-alpine`).

### Miljovariabler

Konfigureras i `.env`. Se `.env.example` for alla tillgangliga variabler.

**Skillnader mot produktion:**
- Rate limiting: In-memory fallback (hogre granser)
- E-post: Loggad till konsol om `RESEND_API_KEY` saknas
- Stripe: Mock-gateway (`SUBSCRIPTION_PROVIDER="mock"`)
- Kryptering: Auto-genererad fallback-nyckel

### Feature flags

Alla feature flags ar styrda av:
1. **Miljovariabel** (hogst prioritet): `FEATURE_X=true` i `.env`
2. **Databas-override**: Via admin-panelen `/admin/system`
3. **Kod-default**: I `src/lib/feature-flag-definitions.ts`

---

## Produktion (Vercel + Supabase)

### Vercel

- **Region:** `fra1` (Frankfurt, matchar Supabase eu-central-2)
- **Konfiguration:** `vercel.json`
- **Miljovariabler:** Vercel Project Settings -> Environment Variables

### Supabase

- **Region:** `eu-central-2` (Frankfurt)
- **Connection pooling:** PgBouncer (transaction mode)
- **`connection_limit=1`** i DATABASE_URL (krävs for serverless)

```
DATABASE_URL=postgresql://postgres.REF:PWD@pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres.REF:PWD@pooler.supabase.com:5432/postgres
```

> `DIRECT_DATABASE_URL` anvands for migrationer (kringgår PgBouncer).

### Cron-jobb

| Jobb | Schema (UTC) |
|------|-------------|
| Paminnelser | 08:00 dagligen |
| Bokningspaminnelser | 06:00 dagligen |

Autentiseras med `CRON_SECRET` (Bearer token).

---

## Miljovariabler per miljo

| Variabel | Lokal | Produktion | Anteckning |
|----------|-------|------------|------------|
| `DATABASE_URL` | localhost | Supabase pooler | `connection_limit=1` i prod |
| `NEXTAUTH_SECRET` | Valfri strang | Stark slumpad | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` | Vercel-URL | Auto-detekterad pa Vercel |
| `UPSTASH_REDIS_REST_URL` | (tom = in-memory) | Upstash URL | Rate limiting |
| `RESEND_API_KEY` | (tom = konsol-logg) | Resend API-nyckel | E-post |
| `CRON_SECRET` | Valfri | Stark slumpad | Cron-autentisering |
| `SUBSCRIPTION_PROVIDER` | `mock` | `stripe` | Betalning |
| `STRIPE_SECRET_KEY` | -- | `sk_live_...` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | -- | `whsec_...` | Webhook-signering |
| `NEXT_PUBLIC_SUPABASE_URL` | -- | Supabase URL | Bilduppladdning |
| `SUPABASE_SERVICE_ROLE_KEY` | -- | Service role key | Bilduppladdning |

---

## Deploy-ordning vid schemaandring

```
1. Committa andringar
2. git push (startar Vercel build)
3. npm run migrate:supabase  (FORE deploy nar klart!)
4. Verifiera i Vercel Dashboard
```

> **Kritiskt:** Migrationer MASTE appliceras INNAN Vercel-deployen nar produktionstrafik. Saknade migrationer ger 500-fel.

Se [deployment.md](deployment.md) for fullstandig deploy-guide.

---

## .env.local-fallgropen

Next.js prioriterar `.env.local` over `.env`. Om du har bade filer och de innehaller olika `DATABASE_URL`:

```
.env.local  -> Supabase (hogst prioritet)
.env        -> Lokal Docker (ignoreras)
```

**Losning:** Ta bort `.env.local` for lokal utveckling, eller uppdatera `DATABASE_URL` i bada filerna.

---

*Senast uppdaterad: 2026-02-28*
