# Vecka 4 Februari del 1: Bokning & Offline (2026-02-17 -- 2026-02-21)

> Konsoliderad sammanfattning av 14 retrospectives: bokningsfeatures, offline PWA, sync-motorn och infrastrukturfix.

## Sammanfattning

| Session | Datum | Ämne | Resultat |
|---------|-------|------|----------|
| 32 | 2026-02-17 | API-docs deploy | 10 filer, 0 tester, deploy i ~5min |
| 33-34 | 2026-02-17 | B2 Självservice-ombokning | 21 filer, 41 tester, feature complete (saknas integration: API->notification) |
| 35 | 2026-02-17 | B1 Bokningspåminnelser | 13 filer, 18 tester, cron + HMAC-token + e-post |
| 36-37 | 2026-02-17 | C1 Återkommande bokningar (rebuild) | 24 filer, 122 tester, feature flag enabled |
| 37 | 2026-02-17 | Optimera Provider Profile Loading | 11 filer, 14 tester, shallow-compare + SWR + server-cache |
| 40 | 2026-02-18 | Fix pre-existerande E2E-failures | 9 filer, 0 nya tester, 325/325 E2E gröna, cookie-dismissal fixture |
| 45 | 2026-02-19 | Offline PWA-stöd | 32 filer, 55 tester, Serwist + Dexie + feature flag |
| 46 | 2026-02-19 | Rutt-annonsering UX | 12 filer, 12 tester, 5-fas plan med ARIA + dateRange |
| 48 | 2026-02-20 | Error boundaries offline | 3 filer, 6 tester, `provider/error.tsx` + global fallback |
| 49 | 2026-02-20 | Offline navigeringsskydd | 6 filer, 10 tester, race condition fix + BottomTabBar guard |
| 50 | 2026-02-21 | Health endpoint rate limiting | 2 filer, 5 tester, säkerhet + probe-mönster |
| 51 | 2026-02-21 | iOS offline-detektion | 5 filer, 8 tester, probe-before-restore + apiCacheMatcher |
| 52 | 2026-02-21 | Offline kalender-bokningsdialog | 2 filer, 4 tester, `router.replace()` guard + side-effect testing |
| 53 | 2026-02-21 | Offline sync rate limiting + stale recovery | 8 filer, 8 tester, exponentiell backoff + `revalidateOnReconnect: false` |

## Nyckelresultat

- **Testökning:** 1890 -> 2235 totala tester (+345)
- **Bokningsfeatures:** 3 nya (ombokning, påminnelser, återkommande)
- **Offline-arkitektur:** Komplett PWA med IndexedDB-sync och rate-limit-resiliens
- **E2E-stabilitet:** Från ~40 failures till 325/325 gröna
- **TypeCheck:** 0 errors under hela veckan
- **Lint:** 0 varningar (bibehållet från sprint F)

## Viktiga learnings

### Bokningsflödet (B1, B2, C1)

**E-post-integrering måste vara explicit**
Plan för B2 (ombokning) hade fas 3 (API) och fas 4 (e-post) separata utan integrationssteg. Resultatet: API byggdes utan att anropa notification-funktionen. Lärdomen: integrationschecklist i planmallen för features som spänner flera sessioner.

**Select-block audit som dedikerat steg**
Varje nytt fält på Booking-modellen kräver uppdateringar i ~6 select-block (PrismaBookingRepository, API routes). Sessioner som missar detta får subtila buggar. C1-rebuildet (session 36-37) gjorde detta systematiskt som fas 7.

**Feature flags ger trygg deployment**
Alla tre bokningsfeatures (recurring, self-reschedule, reminders) deployas bakom flaggor. Kan testas i produktion innan aktivering. Flaggor default=false eller true beroende på feature-typ; miljövariabel > DB > kod.

### Offline PWA (session 45+)

**Fetch-strategier och Service Worker**
- **Precaching:** SVG-ikoner + offline-fallback
- **Runtime cache:** Network-first för API, fallback till IndexedDB
- **Offline fallback:** `/~offline` sida
- **SW tsconfig-isolation:** MÅSTE exkluderas från BÅDE `tsconfig.json` och `tsconfig.typecheck.json`

**Offline-aware SWR-integrations­mönster**
Byt global fetcher villkorligt via feature flag. Alla befintliga `useSWR`-hooks ärver automatiskt offline-stöd utan kod-ändringar. Mönstret: "network-first → write-through IndexedDB → catch → read IndexedDB → throw".

**iOS Safari-gotchor**
- Avfyrar falska `online`-events när enheten fortfarande är offline
- Lösning: probe med HEAD-request före `reportConnectivityRestored()`
- Pattern: "trust but verify" för alla browser-events om nätverksstatus

**useSession vs navigator.onLine race condition**
`useSession()` rapporterar `"unauthenticated"` ~2s FÖRE `navigator.onLine` ändras till false. Resultat: omöjligt att skilja "nätverk nere" från "användaren loggade ut". Lösning: ta bort auto-clear av sessionStorage helt. Lita på browserns naturliga rensning vid tab-stängning + overwrite vid ny inloggning.

**router.replace() triggar RSC-request**
Inte en lokal URL-uppdatering -- fullständig server-rendering. Offline failar detta. Guard med `if (isOnline)` när URL-uppdateringen bara är för deep-linking (t.ex. kalender-dialog state).

### E2E & Testning

**Cookie-consent Global Dismissal**
Lägg till `addInitScript` i fixtures för att setta `localStorage.setItem('equinet-cookie-notice-dismissed', 'true')` INNAN sidan laddas. Löser cookie-banners för ALLA framtida tester.

**Strict Mode Selektorer**
- `getByText('Text', { exact: true })` undviker dolda element
- `.first()` för multiple matchers
- Scopa till container (`page.locator('table').getByText('X')`)
- BottomTabBar admin-mönster: `.filter({ has: page.getByRole('link', { name: 'UniqueItem' }) })`

**Page-komponenter: testa side-effects, inte intern state**
Full-page rendering med 15+ mocks är fragilt. Fokusera på `router.replace`/`fetch`-anrop istället för React-state.

### Infrastruktur & Performance

**Shallow-compare i providers**
```typescript
setFlags((current) => {
  const next = data.flags
  const changed = Object.keys(next).some(k => next[k] !== current[k])
  return changed ? next : current
})
```
Förhindrar onödiga re-renders vid polling. Samma referens = React skippar update.

**Server-side feature flag cache (30s TTL)**
Modulvariabel med invalidering vid skriv-operationer. Enkel, serverless-safe, ingen Redis behövs.

**SWR över useState + setInterval**
`useSWR(key, fetcher, { refreshInterval })` ger gratis deduplication, error retry, stale-while-revalidate. Eliminerar en hel klass av polling-buggar.

**Exponentiell backoff med Retry-After**
```typescript
function getRetryDelay(attempt, response): number {
  const retryAfter = response?.headers?.get("Retry-After")
  if (retryAfter) return parseInt(retryAfter, 10) * 1000
  return 1000 * Math.pow(2, attempt) // 1s, 2s, 4s
}
```
Använd vid offline sync-motorn och alla retry-scenarier.

**Modul-nivå guard för async-operationer**
`let syncInProgress = false` på modul-nivå (inte `useRef`) -- överlever React-ommountering. Exportera `_resetSyncGuard()` för tester. Används i `useMutationSync`.

**SWR-koordinering vid reconnect**
Inaktivera `revalidateOnReconnect: false` + anropa `globalMutate(..., { revalidate: true })` manuellt EFTER sync. Sekvenserar: sync → data-refresh (inte concurrency).

### Rate Limiting & Säkerhet

**Public GET-endpoints behöver alltid rate limit**
Även "enkla" endpoints som `/api/health` med noll affärslogik -- publika + nätbar = enkla att missbruka. Använd `rateLimiters.api` som standard.

**HEAD för connectivity-probe (ej rate-limited)**
`new Response(null, { status: 200 })` behöver ingen Redis-lookup -- noll beräkning. Rate-limiting gör proben långsammare.

## Nyckelmetrik

| Mätvärde | Värde | Förändring |
|----------|-------|-----------|
| Totala tester | 2235 | +345 (+15%) |
| Bokningsfeatures | 3 | +3 (ombokning, påminnelser, återkommande) |
| Feature flags | 13 | +1 (offline_mode) |
| E2E specs | 27 | 325/325 gröna (från ~40 failures) |
| Typecheck errors | 0 | Stabil |
| Lint warnings | 0 | Stabil |
| Offline-cachebar endpoints | 3 | `/api/bookings`, `/api/routes/my-routes`, `/api/provider/profile` |

## Patterns att spara

### Boknings-arkitektur
1. **Repository-pattern för kärndomäner** (Booking, Series etc.)
2. **Feature flags for safe rollout** (recurring_bookings, self_reschedule flaggor default-false)
3. **Select-block audit som fas** (systemisk uppdatering av alla queries)
4. **HMAC-stateless verifiering** för magiska länkar (unsubscribe, one-click confirm)

### Offline PWA
1. **Conditional SWR-fetcher via feature flag** (network-first → cache-fallback)
2. **useSyncExternalStore för navigator.onLine** (tear-free reads, SSR-safe)
3. **Service Worker tsconfig-isolation** (exclude från BÅDE tsconfig.json)
4. **Probe-before-restore** (HEAD-request före `reportConnectivityRestored()`)
5. **apiCacheMatcher + connectivityNotifier** (omedelbar offline-detektion)

### E2E
1. **Global cookie dismissal i fixtures** (`addInitScript` + localStorage)
2. **Strict mode selektorer** (`{ exact: true }`, scoping, `.first()`)
3. **Page-test via side-effects** (router-anrop, fetch-anrop, inte state)

### Sync-motorn
1. **Exponentiell backoff med Retry-After** (1s → 2s → 4s + server header)
2. **`revalidateOnReconnect: false` + manual globalMutate** (sequence over concurrency)
3. **Modul-nivå sync-guard** (overlever unmount)
4. **Stale recovery** (`resetStaleSyncingMutations()` för förlorad kontext)

## 5 Whys sammanfattning

### Varför bröt E2E-tester innan fix?
Cookie-bannern blockerade pointer-events → CookieNotice saknade E2E-setup → Tester skrevs innan PWA-arbete → Global fixture-fix löste för ALLA framtida tester.

### Varför loggades användare ut offline?
useSession rapporterar "unauthenticated" 2s före navigator.onLine ändras → auto-clear cache vid denna signal → omöjligt skilja logout från nätverksfel → ta bort auto-clear helt.

### Varför fastnade sync-mutationen?
SWR:s `revalidateOnReconnect` trigger samtidigt som sync-motorn → bursten resurskonflikter → rate-limiting blockerar sync → `revalidateOnReconnect: false` + manual sequencing.

## Missade förbättringar

1. **B2 E-post-integration saknas** (API->notification koppling inte implementerad)
2. **E2E nav-uppdateringar** (rutt-annonsering ändrade nav-text, tester inte uppdaterade)
3. **CustomerLayout offline-navigeringsskydd** (ProviderNav + BottomTabBar fixat, Customer ej)
4. **Offine-mutations E2E** (booking-sync krävde Prisma-fallback i E2E, ej löst)

---

*Originaldokument: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)*

**Nästa fokus:** Session 54+ - Stripe subscription checkout flow, production readiness, mutation write-back för offline.
