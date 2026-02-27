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
export LOAD_TEST_BASE_URL="https://equinet.vercel.app"
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

> **TODO**: Fyll i efter första körningen med k6.
>
> Mall:
>
> | Endpoint | p50 | p95 | p99 | Error rate | Req/s |
> |----------|-----|-----|-----|------------|-------|
> | GET /api/providers | - | - | - | - | - |
> | GET /api/provider/dashboard/stats | - | - | - | - | - |
> | GET /api/provider/insights | - | - | - | - | - |

## Prestandaoptimeringar implementerade

### Rate-limit-buggfix

3 routes hade `await rateLimiters.api(ip)` utan att kontrollera returvärdet -- rate limiting var helt verkningslös:
- `src/app/api/provider/insights/route.ts`
- `src/app/api/provider/dashboard/stats/route.ts`
- `src/app/api/customer/onboarding-status/route.ts`

**Fix**: Lade till `const isAllowed = ...` + `if (!isAllowed) return 429`.

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
