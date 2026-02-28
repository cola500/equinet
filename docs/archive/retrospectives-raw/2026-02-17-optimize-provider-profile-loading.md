# Retrospektiv: Optimera Provider Profile Loading

**Datum:** 2026-02-17
**Scope:** Performance-optimering av provider dashboard/profil -- eliminera onodiga re-renders och redundanta API-anrop

---

## Resultat

- 11 andrade filer, 1 ny fil (FeatureFlagProvider.test.tsx), 0 nya migrationer
- ~14 nya tester (1959 totalt, upp fran 1945), alla TDD, alla grona
- Typecheck = 0 errors
- Tid: ~1 session (3 faser)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Provider (client) | `FeatureFlagProvider.tsx` | Tog bort pathname-refetch, la till staleness-check (30s), shallow-compare fore setFlags |
| Provider (client) | `FeatureFlagProvider.test.tsx` (ny) | 10 tester: mount-beteende, focus-refetch, staleness, polling, render-count |
| Hooks | `useAuth.ts` | Exponerar `providerId` direkt fran session (undviker extra fetch) |
| Hooks | `useNotifications.ts` | Omskriven fran useState/setInterval till SWR (deduplication, caching, stale-while-revalidate) |
| API | `notifications/route.ts` | Returnerar `{ notifications, unreadCount }` i ett svar (paralleliserat med Promise.all) |
| UI | `provider/profile/page.tsx` | Anvander `providerId` fran useAuth istallet for profile.id |
| UI | `notifications/page.tsx` | Anpassad till nytt API-response format |
| Lib | `feature-flags.ts` | Server-side cache (30s TTL) for getFeatureFlags, med invalidering vid override-andringar |
| Tester | `feature-flags.test.ts`, `useAuth.test.ts`, `route.test.ts` (x2) | Tester for caching, invalidering, nytt response-format |

## Vad gick bra

### 1. Tydlig root-cause-analys
Istallet for att gissa optimerade vi med tydlig forstaelse av vad som orsakade re-renders: (1) pathname-refetch vid varje navigation, (2) focus-refetch utan staleness-check, (3) polling som alltid satte nytt objekt i state.

### 2. TDD fangade regressioner tidigt
Render-count-testet bevisade problemet (RED) och verifierade fixen (GREEN) direkt. Utan testet hade det varit svart att bekrafta att shallow-compare faktiskt fungerade.

### 3. Lagervis optimering
Varje fas tacklade ett specifikt lager (FeatureFlagProvider -> hooks -> server-side cache) utan att bryta befintlig funktionalitet. Inkrementellt och sakert.

### 4. SWR-migrering for useNotifications
Bytet fran manuell useState/setInterval till SWR eliminerade en hel klass av buggar (race conditions, stale data, polling-hantering) och gav gratis deduplication.

## Vad kan forbattras

### 1. Branchen saknar commits
Alla 11 filer ar andrade men inget ar committat. Vid crash/byte av session forsvinner arbetet.

**Prioritet:** HOG -- vi har forlorat arbete forut (session 36).

### 2. Saknar E2E-verifiering av polling-beteendet
Vi har unit-tester men inget E2E som bekraftar att dashboarden inte blinkar. Manuell verifiering ar angiven i planen men inte automatiserad.

**Prioritet:** LAG -- unit-testerna tacker logiken, manuell verifiering racker for nu.

## Patterns att spara

### Shallow-compare i setFlags
```typescript
setFlags((current) => {
  const next = data.flags
  const changed =
    Object.keys(next).length !== Object.keys(current).length ||
    Object.keys(next).some((k) => next[k] !== current[k])
  return changed ? next : current
})
```
`setFlags(fn)` som returnerar samma referens -> React skippar re-render helt. Anvandbart i alla providers som pollar.

### Server-side TTL-cache for feature flags
Modulvariabel `flagCache` med TTL (30s) + invalidering vid write-operationer. Enkelt, effektivt, inga externa beroenden. Fungerar i serverless sa lange request-livstiden ar kort.

### SWR for polling-hooks
`useSWR(key, fetcher, { refreshInterval })` ersatter manuell useState + setInterval + fetchCallback. Ger gratis deduplication, error retry, och stale-while-revalidate.

## Larandeeffekt

**Nyckelinsikt:** Polling-baserade providers maste alltid jamfora data fore state-uppdatering. `setFlags(newObj)` med ett nytt objekt triggar ALLTID re-render, oavsett om vardena ar identiska. Losningen ar `setFlags(fn)` med referens-jamforelse -- det ar Reacts inbyggda mekanism for att skippa onodiga uppdateringar.
