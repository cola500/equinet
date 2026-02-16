# Retrospektiv: Redis-backade Feature Flags + Sakerhetshardning

**Datum:** 2026-02-16
**Scope:** Redis-persistent feature flags for Vercel serverless + security hardening (login rate limiting, XSS, select blocks)

---

## Resultat

- 14 andrade filer, 8 nya filer, 0 nya migrationer
- 42 nya tester (1707 -> 1749, alla grona)
- 1749 totala tester (inga regressioner)
- Typecheck = 0 errors
- 3 commits: security hardening, feature flags, admin UI fix
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Lib (core) | `feature-flags.ts`, `runtime-settings.ts` | Async Redis-backed feature flags med prioritetskedja: env > Redis > in-memory > default. `isFeatureEnabled()`, `getFeatureFlags()`, `setFeatureFlagOverride()`, `removeFeatureFlagOverride()` |
| API | `feature-flags/route.ts`, `admin/settings/route.ts` | Publik GET med `await`, admin PATCH routar feature_*-nycklar via Redis |
| UI (admin) | `admin/system/page.tsx` | Feature flag toggles med env-override-visning, optimistisk UI-uppdatering |
| UI (provider) | `ProviderNav.tsx`, `FeatureFlagProvider.tsx` | Nav-items filtreras pa feature flags. SSR -> client hydration via context provider |
| Layout | `layout.tsx` | Async RootLayout, server-side flag-fetch vid SSR |
| Security | `[...nextauth]/route.ts`, `receipt/route.ts`, `provider/profile/route.ts`, `route-orders/[id]/route.ts` | IP-baserad login rate limiting, XSS-escaping i kvitton, select istallet for include |
| Rate limiting | `rate-limit.ts`, `reset-rate-limit/route.ts` | Ny `loginIp` limiter (30/15min), E2E reset utokad |
| Tester | 6 nya testfiler + 2 utokade | Full coverage for feature flags, admin settings, auth, receipt, provider profile, route orders |
| Docs | `pentest-report-2026-02-15.md` | Penetrationstestrapport med fixade och oppna fynd |

## Vad gick bra

### 1. Snabb root-cause-analys av Vercel-buggen
Anvandaren rapporterade "kan inte satta tillbaka flaggorna" -- inom minuter identifierades grundorsaken: admin GET laste in-memory (tomt pa ny serverless-instans) istallet for Redis. Fixades med en enda andring: returnera `featureFlagStates` fran `getFeatureFlags()`.

### 2. Befintlig Upstash-infrastruktur ateranvands
Redis var redan konfigurerat for rate limiting. Inga nya beroenden, inga nya env-variabler, ingen ny infrastruktur. Bara en ny anvandning av befintlig `@upstash/redis`.

### 3. Graceful degradation fungerar
Prioritetskedjan (env > Redis > in-memory > default) gor att systemet funkar i alla miljoer: lokalt utan Redis, pa Vercel med Redis, med env-overrides for emergency kills.

### 4. Tva separata commits for renare historik
Sakerhetshardning och feature flags separerades i egna commits, vilket gor git-historiken lattare att forsta och revertera vid behov.

## Vad kan forbattras

### 1. In-memory state i serverless borde ha fangas tidigare
Runtime settings-systemet (session 19) designades for in-memory, vilket ar fundamentalt inkompatibelt med serverless. Detta borde ha identifierats nar feature flags lades till.

**Prioritet:** MEDEL -- dokumenteras som gotcha for framtida features.

### 2. Silent Redis error handling
`setFeatureFlagOverride` svalde Redis-fel tyst. Pa Vercel gor detta att admin tror att togglen lyckades (in-memory uppdateras, optimistisk UI visar ratt) men Redis aldrig skrivs. Borde returnera success/failure till klienten.

**Prioritet:** LAG -- i praktiken har Upstash extrem uptid, men principen ar fel.

### 3. Admin UI borde ha haft serverless-testning
Admin-togglen testades bara lokalt (en process), aldrig pa Vercel. En enkel smoke test pa staging hade fangat problemet.

**Prioritet:** HOG -- behover en process for att verifiera serverless-specifik funktionalitet.

## Patterns att spara

### Redis som shared state for serverless
```
Lokalt:  getRedis() -> null -> in-memory fallback
Vercel:  getRedis() -> Upstash Redis -> persistent across instances
```
Anvand for all shared state som maste overleva mellan requests (feature flags, runtime config). In-memory ar ALDRIG persistent pa Vercel.

### Admin GET ska returnera actual state, inte raw storage
Admin-UI maste visa det *faktiska* tillstandet, inte ra storage-varden. `getFeatureFlags()` (som gor hela prioritetskedjan) ar source of truth -- inte `getAllRuntimeSettings()` (som bara ar ett lager).

### Redis mock-pattern for Vitest
```typescript
const mockRedisGet = vi.fn().mockResolvedValue(null)
vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    get = mockRedisGet
    set = mockRedisSet
    mget = mockRedisMget
  },
}))
```
Anvand `class` (inte arrow function) -- `vi.fn().mockImplementation(() => ...)` fungerar INTE som konstruktor med `new`.

## 5 Whys (Root-Cause Analysis)

### Problem: Feature flag toggles kunde inte sattas tillbaka pa Vercel
1. Varfor? Admin UI visade fel state efter sidladdning (alla flaggor visades som PA)
2. Varfor? `isFlagEnabled()` i admin-sidan laste fran `getAllRuntimeSettings()` som var tomt
3. Varfor? `getAllRuntimeSettings()` ar in-memory, och varje Vercel-instans startar med tomt minne
4. Varfor? Runtime settings designades for single-process (lokal dev) och anpassades aldrig for serverless
5. Varfor? Det saknades en arkitekturell granskning av hur in-memory state beter sig i serverless-miljo

**Atgard:** Dokumentera i MEMORY.md och GOTCHAS.md: "In-memory state overlever INTE mellan requests pa Vercel. Anvand Redis for shared state." Lagt till som gotcha.
**Status:** Implementerad

### Problem: Redis-mock med `vi.fn().mockImplementation()` kraschade med "is not a constructor"
1. Varfor? `new Redis(...)` kraver att mocken stodjer `new`-operatorn
2. Varfor? Arrow functions (`() => ...`) kan inte anvandas med `new` i JavaScript
3. Varfor? Vitest `vi.fn().mockImplementation()` anvander arrow function internt
4. Varfor? Vitest-dokumentationen belyser inte detta tydligt for constructor-mocking
5. Varfor? Constructor-mocking ar en edge case som inte testas lika ofta

**Atgard:** Dokumentera pattern: anvand `class MockRedis` istallet for `vi.fn().mockImplementation()` vid constructor-mocking.
**Status:** Implementerad (pattern dokumenterat ovan)

## Larandeeffekt

**Nyckelinsikt:** In-memory state ar en illusion i serverless. Allt som maste delas mellan requests MASTE anvanda extern persistent storage (Redis, databas). Testa serverless-specifik funktionalitet pa staging, inte bara lokalt.
