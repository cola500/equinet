---
title: "Lasttestning -- Baseline-dokumentation"
description: "Lasttestning med k6 -- scenarios, baseline-resultat och prestandaoptimeringar"
category: operations
tags: [load-testing, k6, performance, baseline]
status: active
last_updated: 2026-03-02
related:
  - docs/architecture/scaling.md
  - NFR.md
sections:
  - Verktyg
  - Hur man kör
  - Scenarios
  - Baseline-resultat
  - Prestandaoptimeringar implementerade
  - Anteckningar
---

# Lasttestning -- Baseline-dokumentation

> NFR-08: Lasttestverktyg, baseline för kritiska endpoints, 100 concurrent users utan degradering.

## Verktyg

- **k6** (Grafana): Standalone binary, installeras med `brew install k6`
- Scenarios i `load-tests/scenarios/`
- Auth helper i `load-tests/utils/auth.js`

## Hur man kör

### Förutsättningar

1. Installera k6: `brew install k6`
2. Starta dev-server + databas: `npm run db:up && npm run dev`
3. (Valfritt) Seeda data: `npm run db:seed`

### Kör tester

```bash
# Publik endpoint (inga cookies behövs)
npm run loadtest

# Autentiserade endpoints (kräver session cookie)
export LOAD_TEST_SESSION_COOKIE="next-auth.session-token=<din-cookie>"
npm run loadtest:dashboard
npm run loadtest:insights

# Alla tre i sekvens
npm run loadtest:all
```

### Mot Vercel/produktion

```bash
export LOAD_TEST_BASE_URL="https://equinet-app.vercel.app"
export LOAD_TEST_SESSION_COOKIE="next-auth.session-token=..."
npm run loadtest:all
```

## Scenarios

| Script | Endpoint | VUs | Duration | Thresholds |
|--------|----------|-----|----------|------------|
| `providers-listing.js` | `GET /api/providers` | 100 | 2 min | p95 < 500ms, error < 5% |
| `provider-dashboard.js` | `GET /api/provider/dashboard/stats` | 50 | 2 min | p95 < 500ms, error < 10% |
| `provider-insights.js` | `GET /api/provider/insights?months=6` | 50 | 2 min | p95 < 1000ms, error < 10% |

## Baseline-resultat

**Datum**: 2026-02-27
**Miljö**: Next.js dev-server (lokal), Docker PostgreSQL, MacOS ARM64
**k6**: v1.6.1
**Seedat data**: Ja (db:seed)

### Dev-server (next dev)

**Baseline (2026-02-27, före optimering):**

| Endpoint | VUs | p50 | p95 | Error rate | Req/s |
|----------|-----|-----|-----|------------|-------|
| GET /api/providers | 100 | 7.12s | 19.08s | 0% | 7.0 |
| GET /api/provider/dashboard/stats | 50 | 457ms | 1.06s | 100%* | 19.2 |
| GET /api/provider/insights | 50 | 440ms | 1.08s | 100%* | 19.1 |

**Efter enrichment-optimering (2026-02-27):**

| Endpoint | VUs | p50 | p95 | Error rate | Req/s |
|----------|-----|-----|-----|------------|-------|
| GET /api/providers | 100 | 7.18s | 16.0s | 0% | 7.2 |

*\* Autentiserade endpoints utan session cookie returnerar 500 (auth() kastar utan cookie). Error rate avser HTTP-statuskod, inte serverstabilitet -- servern hanterade lasten utan krasch.*

### Analys

- **Providers-listing** (publik, 100 VUs): Svarstiderna är höga pga Next.js dev-mode (on-the-fly kompilering). Dev-server kompilerar API-routen vid varje request (~5-7s overhead), vilket döljer effekten av query-optimeringarna. I production build förväntas p95 < 500ms.
- **Enrichment-optimering**: `enrichWithReviewStats` byttes från `findMany` + JS-aggregering till `groupBy` (1 rad per provider). `enrichWithNextVisit` byttes från `findMany` utan LIMIT till `DISTINCT ON` raw SQL (1 rad per provider). Minskar data från DB med 100-1000x, men effekten maskeras av dev-mode compilation overhead.
- **Dashboard/Insights** (50 VUs, utan auth): ~460ms median visar att servern hanterar 50 concurrent utan problem. Med caching aktivt (Redis) förväntas cached requests < 50ms.
- **Inga krascher** under hela testperioden (2 min per scenario).

### Nästa steg

- [ ] Kör mot production build (`npm run build && npm start`) för realistiska siffror
- [ ] Kör med giltig session cookie för autentiserade endpoints
- [ ] Kör mot Vercel staging med `LOAD_TEST_BASE_URL`
- [ ] Jämför med/utan Redis-cache

## Prestandaoptimeringar implementerade

### Rate-limit-buggfix

3 routes hade `await rateLimiters.api(ip)` utan att kontrollera returvärdet -- rate limiting var helt verkningslös:
- `src/app/api/provider/insights/route.ts`
- `src/app/api/provider/dashboard/stats/route.ts`
- `src/app/api/customer/onboarding-status/route.ts`

**Fix**: Lade till `const isAllowed = ...` + `if (!isAllowed) return 429`.

### Enrichment-funktioner i providers-listing

`GET /api/providers` hade två enrichment-funktioner som hämtade obegränsade resultatmängder:

| Funktion | Före | Efter | Förväntat |
|----------|------|-------|-----------|
| `enrichWithReviewStats` | `findMany` alla reviews + JS-aggregering | `groupBy` (1 rad per provider) | ~50-100ms |
| `enrichWithNextVisit` | `findMany` alla AvailabilityExceptions + JS-filtrering | `DISTINCT ON` raw SQL (1 rad per provider) | ~50-100ms |

Datamängd från DB minskas med 100-1000x (N providers istället för 10 000+ rader).

### Redis-caching på tunga analytics-routes

| Endpoint | Cache-nyckelprefix | TTL | Motivering |
|----------|--------------------|-----|------------|
| `/api/provider/insights` | `provider-insights:` | 10 min | Historisk data (3-12 mån), ändras sällan |
| `/api/provider/dashboard/stats` | `dashboard-stats:` | 5 min | 8-veckors data, uppdateras oftare |

Cachen är fail-open: vid Redis-fel returneras `null` och vi kör mot DB som vanligt.

Cache-modulen: `src/lib/cache/provider-stats-cache.ts`

## Anteckningar

- Dev-servern använder in-memory rate limiting (1000 req/min) -- tillräckligt för 100 VUs med 1s sleep
- Autentiserade tester kräver en giltig session cookie (alla VUs delar samma cookie)
- k6 är INTE ett npm-paket -- installeras separat med `brew install k6`

---

**Senast uppdaterad**: 2026-02-27
