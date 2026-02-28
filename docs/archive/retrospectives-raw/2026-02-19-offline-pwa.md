# Retrospektiv: Offline PWA-stod for Equinet

**Datum:** 2026-02-19
**Scope:** Installbar PWA med offline-stod for leverantorer (lasbara data)

---

## Resultat

- 12 andrade filer, 20 nya filer (+318/-9 rader exkl. package-lock)
- 55 nya tester (7 testfiler), alla TDD, alla grona
- 2037 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- 4 nya beroenden: `@serwist/next`, `serwist`, `dexie`, `fake-indexeddb`
- 0 nya migrationer (rent client-side feature)
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Config | `next.config.ts`, `tsconfig.json`, `tsconfig.typecheck.json`, `.gitignore` | Serwist-wrapper, SW-headers, TS excludes |
| Manifest | `src/app/manifest.ts`, `public/icons/*` (3 st) | PWA Web App Manifest med SVG-ikoner |
| Service Worker | `src/sw.ts` | Serwist SW: precaching, defaultCache, offline-fallback |
| Offline UI | `src/app/~offline/page.tsx` | Offline-fallback sida |
| Hooks | `src/hooks/useOnlineStatus.ts` | useSyncExternalStore-baserad online/offline-detection |
| IndexedDB | `src/lib/offline/db.ts`, `cache-manager.ts` | Dexie.js schema + cache CRUD med 4h MAX_AGE |
| SWR Integration | `src/lib/offline/offline-fetcher.ts`, `SWRProvider.tsx` | Network-first, cache-fallback fetcher |
| UI Components | `OfflineBanner.tsx`, `InstallPrompt.tsx` | Amber/gron banner + Android/iOS install-prompt |
| Layout | `ProviderLayout.tsx`, `layout.tsx` | Banner-integration + Apple PWA-metadata |
| Feature Flags | `feature-flags.ts` | `offline_mode`-flagga (default: false) |
| E2E | `e2e/offline-pwa.spec.ts` | Manifest, offline-sida, SW-headers |

## Vad gick bra

### 1. Ren separation med feature flag
Hela offline-funktionaliteten ar gatad bakom `offline_mode`-flaggan (default: false). Inget paverkar befintliga anvandare forran flaggan slas pa. SWRProvider byter fetcher villkorligt -- enda andringen i befintlig SWR-setup.

### 2. TDD fangade designbeslut tidigt
55 tester skrevs fore implementation. Testerna definierade kontrakten: 4h cache-staleness, vilka endpoints som ar cachebara, att reconnection-bannern forsvinner efter 3s. Ingen omskrivning behrovdes.

### 3. Minimal invasion i befintlig kod
Bara 2 befintliga komponenter andrades (SWRProvider +5 rader, ProviderLayout +4 rader). Resten ar nya filer. De 2 feature-flag-testerna som brot var vantade och enkla att fixa (lagga till `offline_mode: false`).

### 4. Serwist + Next.js App Router fungerade smidigt
`withSerwistInit` wrappade `nextConfig` utan konflikter med Sentry. SW kompileras fran `src/sw.ts` med eget scope (exkluderad fran tsconfig) -- inga typkrockar med DOM-lib.

## Vad kan forbattras

### 1. SVG-ikoner istallet for PNG
PWA-manifestet anvander SVG-ikoner. De flesta moderna browsers stodjer detta, men vissa aldre Android-versioner kraver PNG. For produktion bor riktiga designade PNG-ikoner skapas (192x192, 512x512).

**Prioritet:** LAG -- SVG fungerar for MVP/test, PNG-ikoner ar en designuppgift

### 2. Offline-fetcher cachar bara 3 endpoints
`/api/bookings`, `/api/routes/my-routes`, `/api/provider/profile` ar cachebara. Andra provider-endpoints (kunder, tjanster, insikter) ar inte med. Utbyggnad kraver manuell mappning per endpoint.

**Prioritet:** MEDEL -- utoka nar anvandare rapporterar vilken data de behover offline

### 3. Ingen write-back (mutation offline)
Denna iteration ar read-only. Leverantorer kan se data offline men inte markera bokningar som klara eller uppdatera ruttstopp. Background Sync ar nasta steg.

**Prioritet:** MEDEL -- planerad som fas 2+ i planen

## Patterns att spara

### Offline-aware SWR Fetcher
Monstret "byt ut SWR:s globala fetcher villkorligt" ar kraftfullt:
1. Alla befintliga `useSWR`-hooks arver automatiskt offline-stod
2. Ingen hook behover andras
3. Feature flag styr om offline-fetcher anvands
4. `offlineAwareFetcher`: try network -> write-through IndexedDB -> catch -> read IndexedDB -> throw

### useSyncExternalStore for browser-events
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` ar renare an `useState` + `useEffect` for `navigator.onLine`:
- Inga stale closures
- SSR-safe med `getServerSnapshot`
- React guarantees tear-free reads

### Service Worker tsconfig-isolation
SW-filer (`src/sw.ts`) ska exkluderas fran bade `tsconfig.json` OCH `tsconfig.typecheck.json` (den later har eget `exclude` som overridar). Serwist-pluginet kompilerar SW:n separat med egna typer.

## 5 Whys (Root-Cause Analysis)

### Problem: tsconfig.typecheck.json ignorerade SW-exclude fran tsconfig.json
1. Varfor? `npm run typecheck` klagade pa `ServiceWorkerGlobalScope` i sw.ts
2. Varfor? `tsconfig.typecheck.json` extenderar `tsconfig.json` men har eget `exclude`
3. Varfor? TypeScript:s `exclude` fran extends overrids helt av barnets `exclude`
4. Varfor? TS-konfigens merge-strategi ar "replace" for arrays, inte "merge"
5. Varfor? TypeScript-designbeslut -- arrays i config ar atomara

**Atgard:** Lade till `src/sw.ts` i BADA tsconfig-filernas exclude. Dokumenterat som pattern ("Service Worker tsconfig-isolation") ovan.
**Status:** Implementerad

### Problem: Feature flag-tester brot nar offline_mode lades till
1. Varfor? 2 tester anvande `toEqual` med hardkodad lista av alla flaggor
2. Varfor? Testerna var skrivna fore det fanns ett pattern for dynamiska flaggor
3. Varfor? Projektet saknade en konvention for hur flag-tester ska skrivas
4. Varfor? Flag-registret vaxer organiskt -- varje ny flagga bryter exakt-tester
5. Varfor? `toEqual` ar brittle for register som vaxer over tid

**Atgard:** Fixade testerna genom att lagga till `offline_mode: false`. Framtida forbattring: byt `toEqual` mot `toMatchObject` + separat langdcheck, sa nya flaggor bara bryter langd-testet.
**Status:** Quick fix implementerad, storre refactor parkerad

## Larandeeffekt

**Nyckelinsikt:** Offline-stod kan laggas till med minimal invasion i en befintlig SWR-baserad app genom att byta ut den globala fetcher-funktionen villkorligt. Hela arkitekturen (55 tester, 7 moduler) lades till utan att andra en enda befintlig hook eller API-route. Feature flags ar nyckeln till saker utrullning.
