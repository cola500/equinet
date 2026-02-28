# Retrospektiv: E2E-tester för follow provider-feature

**Datum:** 2026-02-23
**Scope:** E2E-testsvit för följ-leverantör-funktionen (session 56) -- follow/unfollow, persist, rollseparation, kommun-val

---

## Resultat

- 2 ändrade filer, 1 ny fil, 0 nya migrationer
- 10 nya E2E-tester (5 testfall x 2 browsers: chromium + mobile), alla gröna
- 2314 unit-tester (oförändrat), 0 regressioner
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| E2E test | `e2e/follow-provider.spec.ts` (328 rader) | 5 testfall: follow, unfollow, persist across navigation, provider can't follow, municipality select |
| E2E infra | `e2e/setup/seed-helpers.ts` | `cleanupFollowData()` -- rensar Follow, NotificationDelivery, Notification för test-isolation |
| Config | `playwright.config.ts` | `FEATURE_FOLLOW_PROVIDER: 'true'` i webServer.env (CI) |
| Config | `.env` | `FEATURE_FOLLOW_PROVIDER=true` för lokal dev-server |

## Vad gick bra

### 1. UI-baserad testinteraktion istället för Prisma-seeding
Istället för att seeda follow-relationer direkt i databasen via Prisma (som kan hamna i en annan modulinstans i dev mode), interagerar testerna via UI-klick (follow/unfollow-knappen). Detta kringgår dev mode module-isolation och ger mer realistiska tester.

### 2. Snabb rotorsaks-identifiering av env-var-problemet
Identifierade att `reuseExistingServer: true` (lokal default) gör att `webServer.env` i playwright.config.ts INTE appliceras på en redan startad dev-server. Lösningen: sätt flaggan i `.env` + admin API toggle i beforeAll/afterAll.

### 3. Bra testdesign med cleanup
beforeAll/afterAll-mönstret med admin-login, flag-toggle och `cleanupFollowData()` ger pålitlig test-isolation utan sidoeffekter.

## Vad kan förbättras

### 1. Feature flag E2E-strategi bör dokumenteras tydligare
Tre parallella mekanismer för feature flags i E2E (env var, admin API, `syncClientFlags`) är förvirrande. En standardiserad approach bör dokumenteras.

**Prioritet:** MEDEL -- nya feature-flag-gated E2E-tester kommer stöta på samma problem

### 2. Dev server restart-beroende
Att kräva manuell omstart av dev-servern efter kodändringar från en annan session är en friktionskälla. Turbopack borde hot-reload, men nya filer och env-ändringar kräver omstart.

**Prioritet:** LÅG -- sällan problem, och HMR hanterar de flesta fall

## Patterns att spara

### Feature flag-gated E2E-tester
1. Sätt `FEATURE_X=true` i `.env` (lokal) OCH `playwright.config.ts` webServer.env (CI)
2. Använd admin API i `beforeAll` för att aktivera flaggan (för modulinstanser som inte läser env)
3. Kör `syncClientFlags(page)` efter navigation för att synka klienten
4. Återställ flaggan i `afterAll`
5. Interagera via UI (inte Prisma-seeding) för att undvika module-isolation-problem

### cleanupFollowData-mönster
Dedikerad cleanup-funktion i `seed-helpers.ts` som rensar relaterade tabeller i rätt ordning (NotificationDelivery -> Notification -> Follow). Importeras i spec-filens beforeAll/afterAll.

## 5 Whys (Root-Cause Analysis)

### Problem: E2E-tester failade trots korrekt feature flag via admin API
1. Varför? GET `/api/follows/:providerId` returnerade 404 (feature disabled)
2. Varför? `isFeatureEnabled("follow_provider")` returnerade false i den API-routens modulinstans
3. Varför? Admin API-toggling uppdaterade en ANNAN modulinstans (in-memory state delas inte i dev mode)
4. Varför? Next.js dev mode med Turbopack skapar separata modulinstanser per route
5. Varför? Hot module replacement (HMR) isolerar moduler för att möjliggöra snabb omstart utan sidoeffekter

**Åtgärd:** Sätt feature flags som env-variabler (`FEATURE_X=true` i `.env`) -- env-variabler har högsta prioritet i flag-systemet och delas av ALLA modulinstanser.
**Status:** Implementerad

### Problem: Municipality-testet matchade 2 element ("Göteborg" strict mode violation)
1. Varför? `getByText('Göteborg')` hittade 2 `<p>` element
2. Varför? Profil-sidan visar kommun-namnet på två ställen (t.ex. header + profilkort)
3. Varför? Vi använde en för bred selektor utan att scopa till ett specifikt element
4. Varför? Första implementationen antog att kommun-text bara visas en gång
5. Varför? Vi testade inte mot den faktiska DOM-strukturen innan vi skrev selektorn

**Åtgärd:** Använd `.first()` eller scopa till specifikt container-element vid text som kan förekomma på flera ställen.
**Status:** Implementerad

## Lärandeeffekt

**Nyckelinsikt:** Feature flags i E2E kräver env-variabler (inte bara admin API) för att fungera pålitligt i Next.js dev mode, eftersom modulinstanser inte delar in-memory state. Prioritetskedjan `env > Redis > in-memory > default` gör att env-variabler är den enda mekanismen som garanterat fungerar i ALLA modulinstanser.
