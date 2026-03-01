# Offline-arkitektur

> Centraliserad teknisk guide för Equinets offline PWA-stöd.
> Implementerad i session 47-52 (2026-02-19 till 2026-02-21).

---

## Översikt

Equinet stödjer offline-läge för **leverantörer** (hovslagare, veterinärer etc.) som arbetar i områden utan mobilnät. Funktionaliteten är gated bakom feature flag `offline_mode` och inkluderar:

- **Läsa data offline**: Bokningar, rutter och profil cachas lokalt i IndexedDB
- **Göra ändringar offline**: Markera bokning klar, uppdatera anteckningar, ändra ruttstopp-status
- **Automatisk synkronisering**: Ändringar köas och synkas automatiskt vid återanslutning
- **Installbar PWA**: Appen kan installeras på hemskärmen (Android + iOS)

---

## Arkitektur

Systemet består av 5 lager som samverkar:

```
┌─────────────────────────────────────────────────┐
│  UI-lager                                       │
│  OfflineBanner, PendingSyncBadge, InstallPrompt │
├─────────────────────────────────────────────────┤
│  Hook-lager                                     │
│  useOnlineStatus, useMutationSync,              │
│  useOfflineGuard                                │
├─────────────────────────────────────────────────┤
│  SWR Fetcher                                    │
│  offline-fetcher.ts (network-first,             │
│  cache-fallback)                                │
├─────────────────────────────────────────────────┤
│  Offline Storage                                │
│  Dexie.js (IndexedDB): cache-manager.ts,        │
│  mutation-queue.ts                              │
├─────────────────────────────────────────────────┤
│  Service Worker                                 │
│  Serwist (src/sw.ts): precaching,               │
│  offline-fallback, connectivity notifier        │
└─────────────────────────────────────────────────┘
```

---

## Komponenter

### Online-detektion

**`src/hooks/useOnlineStatus.ts`** -- 5 strategier kombinerade:
1. `navigator.onLine` (snabb men opålitlig)
2. `online`/`offline` window events
3. HEAD-poll mot `/api/health` var 30s
4. Service worker connectivity notifier
5. `useSyncExternalStore` för SSR-kompatibilitet

### IndexedDB & Cache

**`src/lib/offline/db.ts`** -- Dexie.js-databas med tabeller: `bookings`, `routes`, `profile`, `metadata`

**`src/lib/offline/cache-manager.ts`** -- Cache-lager med 4h MAX_AGE:
- `cacheBookings()` / `getCachedBookings()` -- sparar/hämtar bokningsdata
- `cacheRoutes()` / `getCachedRoutes()` -- sparar/hämtar ruttdata
- `cacheProfile()` / `getCachedProfile()` -- sparar/hämtar profil
- Stale data (>4h) returneras inte -- användaren uppmanas ansluta

### Mutation Queue

**`src/lib/offline/mutation-queue.ts`** -- FIFO-kö i IndexedDB:
- Sparar operationer som `PendingMutation` (endpoint, method, body, status)
- Status: `pending` -> `syncing` -> `synced` / `failed`
- Deduplicering: om samma endpoint+method redan finns som pending, ersätts den

### Sync Engine

**`src/lib/offline/sync-engine.ts`** -- Bearbetar mutation-kön vid återanslutning:
- Exponentiell backoff: 1s, 2s, 4s (max 3 retries)
- Respekterar `Retry-After`-header från servern
- **429 (rate limited)**: Återställer mutation till `pending` (inte `failed`) -- försöker igen
- **5xx**: Permanent `failed` efter max retries
- `resetStaleSyncingMutations()` körs först i varje sync-runda (återställer stuck `syncing` -> `pending`)

### SWR-integration

**`src/lib/offline/offline-fetcher.ts`** -- Ersätter SWR:s standard-fetcher:
- **Online**: Network-first, skriver svaret till IndexedDB cache (write-through)
- **Offline**: Läser från IndexedDB cache
- Aktiveras villkorligt via feature flag i `SWRProvider`

### Sync-orkestrering

**`src/hooks/useMutationSync.ts`** -- Koordinerar synk vid återanslutning:
- **Sekventiell strategi**: `revalidateOnReconnect: false` i SWR, sync körs först, sedan `globalMutate()` för att refresha all data
- **Modul-nivå guard**: `let syncInProgress = false` på modul-nivå (överlever React-ommountering vid Suspense/error boundaries)
- Exporterar `_resetSyncGuard()` för testbarhet

### Offline Mutation Guard

**`src/hooks/useOfflineGuard.ts`** -- Skyddar mutationer:
- Om offline: blockerar API-anrop, visar toast, sparar i mutation queue
- Om online: kör API-anropet direkt
- Optimistisk UI: uppdaterar lokalt state före API-svar

### Service Worker

**`src/sw.ts`** -- Serwist-baserad service worker:
- Precaching av app-shell (Next.js build output)
- Runtime caching med `defaultCache` strategi
- Offline-fallback: serverar `/~offline` vid cache miss
- Connectivity notifier: meddelar klienten om nätverksändringar

### UI-komponenter

| Komponent | Fil | Beskrivning |
|-----------|-----|-------------|
| OfflineBanner | `src/components/provider/OfflineBanner.tsx` | Gul banner offline, grön "Återansluten" i 3s |
| InstallPrompt | `src/components/provider/InstallPrompt.tsx` | Installationsbanner (Android + iOS-instruktioner) |
| PendingSyncBadge | `src/components/ui/PendingSyncBadge.tsx` | Gul badge "Sparad lokalt" på enskilda bokningar (röd vid konflikt/fel) |

### Error Boundaries

| Fil | Beskrivning |
|-----|-------------|
| `src/app/error.tsx` | Global error boundary -- WifiOff-UI offline, generisk online |
| `src/app/provider/error.tsx` | Leverantörs-specifik error boundary |

**Viktigt**: Importera ALDRIG layout-komponenter i error.tsx (kraschar error boundary:n).

---

## Dataflöde

### Markera bokning klar offline

```
1. Leverantör klickar "Markera klar"
2. useOfflineGuard: navigator.onLine === false
3. -> Spara PendingMutation i IndexedDB (FIFO-kö)
4. -> Uppdatera lokal SWR-cache (optimistisk UI)
5. -> Visa PendingSyncBadge på bokningen
6. Användaren ser bokningen som "klar" direkt
```

### Återanslutning + sync

```
1. useOnlineStatus detekterar nätverksåtergång
2. useMutationSync triggas (modul-nivå guard förhindrar dubbel-sync)
3. resetStaleSyncingMutations() -- rensa stuck mutations
4. Bearbeta kö sekventiellt:
   a. Mutation -> syncing
   b. fetch(endpoint, { method, body })
   c. 200 -> synced, 429 -> pending (retry med backoff), 5xx -> failed
5. globalMutate() -- SWR refreshar all data från servern
6. OfflineBanner visar "Återansluten -- X ändringar synkade"
```

---

## Stödda operationer (offline-mutations)

| Operation | Endpoint | Metod | Status |
|-----------|----------|-------|--------|
| Markera bokning genomförd | `/api/bookings/:id` | PATCH | Implementerad |
| Uppdatera bokningsanteckning | `/api/provider/bookings/:id/notes` | PUT | Implementerad |
| Uppdatera ruttstopp-status | `/api/routes/:id/stops` | PATCH | Implementerad |
| Skapa manuell bokning | `/api/bookings/manual` | POST | Implementerad |
| Avboka bokning | `/api/bookings/:id` | PUT | Implementerad |
| Skapa/ändra tillgänglighetsundantag | `/api/availability-exceptions` | POST/PUT | Implementerad |
| Ändra öppettider | `/api/providers/:id/availability-schedule` | PUT | Implementerad |
| Spara häst-intervall | `/api/provider/horses/:id/interval` | PUT | Implementerad |
| Ta bort häst-intervall | `/api/provider/horses/:id/interval` | DELETE | Implementerad |

### Blocking mode (vänlig offline-toast, köas ej)

| Operation | Hook/Sida |
|-----------|-----------|
| Alla kundmutationer (8 st) | `useProviderCustomers.ts` |

---

## Testning

### Lokalt

```bash
# Bygg med service worker + offline feature flag
npm run build:pwa

# Starta prod-build på port 3001
npm run start:pwa

# Kör offline E2E-tester (bygger + startar automatiskt)
npm run test:e2e:offline
```

### Manuellt i browser

```bash
npm run build:pwa && npm run start:pwa
# Öppna http://localhost:3001
# DevTools > Application > Service Workers > Offline
```

### Testfiler

| Typ | Fil |
|-----|-----|
| Cache-manager | `src/lib/offline/cache-manager.test.ts` |
| Mutation queue | `src/lib/offline/mutation-queue.test.ts` |
| Sync engine | `src/lib/offline/sync-engine.test.ts` |
| Offline fetcher | `src/lib/offline/offline-fetcher.test.ts` |
| Online-status hook | `src/hooks/useOnlineStatus.test.ts` |
| Mutation sync hook | `src/hooks/useMutationSync.test.ts` |
| Offline guard hook | `src/hooks/useOfflineGuard.test.ts` |
| E2E: PWA + offline | `e2e/offline-pwa.spec.ts` |
| E2E: Mutations | `e2e/offline-mutations.spec.ts` |

---

## Kända begränsningar

- **Bara leverantörer**: Kunder har inget offline-stöd ännu (se roadmap fas 4)
- **Inga betalningar/meddelanden offline**: Betalningar och meddelanden fungerar inte offline
- **4h cache-staleness**: Data äldre än 4 timmar visas inte
- **Last-write-wins**: Ingen konfliktdetektering -- om annan användare ändrar samma bokning vinner den sista skrivningen
- **Safari Background Sync**: Stöds inte -- sync sker vid app-focus/manuell refresh
- **Kartdata**: Leaflet-tiles cachas inte offline (se roadmap fas 6)

---

## Roadmap

Se [docs/plans/offline-pwa-roadmap.md](plans/offline-pwa-roadmap.md) för framtida faser:
- Fas 3: Background Sync + Konflikthantering
- Fas 4: Kund-offline
- Fas 5: Smart Pre-fetching
- Fas 6: Offline-kartdata

---

## Relaterade dokument

- [ANVANDARDOKUMENTATION.md](ANVANDARDOKUMENTATION.md) -- Användarguide (offline-sektionen)
- [GOTCHAS.md](GOTCHAS.md) -- Gotcha #26 (lokal offline-testning), #27 (sync race conditions)
- [Retrospektiver](retrospectives/) -- Session 47-52

---

**Senast uppdaterad**: 2026-03-01
