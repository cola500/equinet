# Retrospektiv: Runtime e-post-toggle + Lokal PostgreSQL

**Datum:** 2026-02-12
**Scope:** In-memory runtime settings for admin e-post-toggle + Docker Compose for lokal utvecklingsdatabas

---

## Resultat

- 8 andrade filer, 5 nya filer, 0 nya migrationer
- 18 nya tester (alla TDD, alla grona)
- 1500 totala tester (inga regressioner)
- Typecheck = 0 errors
- DB-svarstid: ~1000 ms (Supabase free tier) -> 3 ms (lokal Docker)

## Vad som byggdes

### Del 1: Runtime e-post-toggle

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Lib | `src/lib/settings/runtime-settings.ts` | In-memory key-value store (get/set/getAll/clear) |
| Lib | `src/lib/email/email-service.ts` | +1 rad i `isConfigured`: kollar runtime-toggle |
| API | `src/app/api/admin/settings/route.ts` | GET/PATCH med admin-auth, rate limit, Zod, whitelist |
| API | `src/app/api/admin/system/route.ts` | +`email.disabledByEnv` i response |
| UI | `src/app/admin/system/page.tsx` | "Utveckling & Test"-kort med Switch + auto-save |
| Test | 3 nya testfiler | 7 + 2 + 9 = 18 tester |

### Del 2: Lokal PostgreSQL (Docker Compose)

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Infra | `docker-compose.yml` | postgres:17-alpine, healthcheck, named volume |
| Config | `package.json` | 3 scripts: `db:up`, `db:down`, `db:nuke` |
| Config | `.env.example` | Lokal DB som default, Supabase utkommenterat |
| Config | `.env` + `.env.local` | Bytt till localhost (ej committad) |

## Vad gick bra

### 1. TDD fangade ratt beteende direkt
Runtime settings-modulen och admin-routen implementerades med RED-GREEN-REFACTOR. Alla 18 tester grona pa forsta GREEN-forsok -- inga fixrundor behovdes.

### 2. Noll kodandringar for lokal DB
Alla 14 migrationer applicerades utan modifiering. Prisma-schemat, seed-scriptet och E2E-testerna fungerade rakt av mot lokal PostgreSQL. Arkitekturen med env-baserade connection strings betalar sig.

### 3. Prioritetskedja for e-post-toggle
`env > runtime > default` ar en robust modell. Admin-UI:t disablar switchen nar env-variabeln ar satt -- forhindrar forvirring om vad som styr.

### 4. Snabb felsokningscykel for .env.local
Nar lokal DB "inte fungerade" identifierades rotorsaken (`.env.local` trumfar `.env`) snabbt via `Glob` + `Grep`. Fixat pa under 1 minut.

## Vad kan forbattras

### 1. `.env.local` missades i planeringen
Vi andrade `.env` men glomde att Vercel CLI skapat `.env.local` som overskrider vaerdena. Next.js env-prioritet (`.env.local` > `.env`) borde ha kontrollerats fore implementering.

**Prioritet:** MEDEL -- sparad som gotcha i MEMORY.md, men borde fangas i planfasen nasta gang.

### 2. DISABLE_EMAILS i .env var redan satt
Anvandaren kunde inte anvanda runtime-togglen forst -- env-variabeln fran session 18 var fortfarande aktiv. Planen borde ha inkluderat att rensa env-variabeln som en explicit fas.

**Prioritet:** LAG -- en-gongs-problem, UI:t visar tydligt "Avstangt via miljoevariabel".

## Patterns att spara

### In-memory runtime settings
`src/lib/settings/runtime-settings.ts` -- enkel `Record<string, string>` modul med synkron get/set. Aterannvaendbar for framtida runtime-toggles (t.ex. maintenance mode, feature flags). Whitelist i API-routen (`ALLOWED_KEYS`) begransar vilka nycklar som kan andras.

### Docker Compose for lokal dev
`docker-compose.yml` + `npm run db:up` -- zero-config lokal databas. Matcha alltid PostgreSQL-version med produktion (17-alpine). Named volume for data-persistens. Healthcheck + `--wait` for sakra npm-scripts.

## Larandeeffekt

**Nyckelinsikt:** Next.js `.env.local` har hogre prioritet an `.env` -- Vercel CLI skapar denna fil automatiskt. Vid byte av databas-URL maste BADA filerna uppdateras. Sparad som gotcha i MEMORY.md.
