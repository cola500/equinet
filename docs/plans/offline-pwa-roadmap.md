# Plan: Offline PWA -- Roadmap

## Kontext

Fas 1 (installbar PWA + lasbara offline-data for leverantorer) ar implementerad och mergad.
Denna plan beskriver framtida faser for att bygga ut offline-stodet.

**Implementerat (fas 1 -- session 47, 2026-02-19):**
- Installbar PWA (manifest, service worker, offline-fallback)
- IndexedDB-cache for bokningar, rutter och profil (4h staleness)
- Network-first SWR-fetcher med cache-fallback
- Offline-banner + install-prompt
- Feature flag: `offline_mode`

**Implementerat (fas 2 -- session 47-52, 2026-02-19 till 2026-02-21):**
- Mutation queue (FIFO i IndexedDB via Dexie.js) med deduplicering
- Sync engine med exponentiell backoff (1s/2s/4s), Retry-After-parsing, 429->pending
- Optimistisk UI med PendingSyncBadge
- Sekventiell sync-strategi: `revalidateOnReconnect: false` + manuell `globalMutate()` efter sync
- Modul-niva sync guard (overlever React-ommountering)
- Stale syncing recovery (`resetStaleSyncingMutations`)
- Error boundaries for offline-navigering
- Offline-navigeringsskydd i BottomTabBar + ProviderNav
- 9 E2E-tester (offline-mutations.spec.ts)

> Se [docs/architecture/offline-pwa.md](../architecture/offline-pwa.md) for fullstandig teknisk guide.

---

## Fas 2: Offline-mutations -- KLAR

**Implementerad:** Session 47-52 (2026-02-19 till 2026-02-21)

### Implementerade operationer
| Operation | Endpoint | Status |
|-----------|----------|--------|
| Markera bokning genomford | `PATCH /api/bookings/:id` | Klar |
| Uppdatera bokningsanteckning | `PATCH /api/bookings/:id` | Klar |
| Uppdatera ruttstopp-status | `PATCH /api/routes/:id/stops` | Klar |
| Logga arbete (text) | `POST /api/voice-log` | Ej implementerad |

### Tekniska val (avvikelser fran ursprunglig plan)
- **Ingen Background Sync API** -- anvander istallet `useOnlineStatus` + manuell sync vid ateranslutning (fungerar pa alla plattformar inkl. Safari)
- **Last-write-wins** -- ingen manuell merge (for enkel MVP, konfliktdetektering planerad i fas 3)
- **Rate-limit-medvetenhet** -- 429-svar atergar till pending (inte failed), exponentiell backoff med Retry-After-stod
- **Stale recovery** -- stuck "syncing"-mutations aterstalls till "pending" vid varje sync-runda

---

## Fas 3: Konflikthantering + Sync-status

**Mal:** Robust konfliktdetektering och synkroniseringsoverblick.

> **OBS:** PendingMutation-modellen ar redan implementerad i fas 2. Background Sync (Chrome API) valdes bort till formån for manuell sync via `useOnlineStatus` som fungerar pa alla plattformar.

### Kvar att implementera
- **Versionsstamplar**: Lagg till `updatedAt` + `version` pa Booking/RouteStop
- **Optimistic concurrency**: Skicka version med mutation, servern avvisar om stale
- **Konflikt-UI**: Toast med "Denna bokning har andrats av nagon annan. Vill du skriva over?"
- **Sync-status-sida**: Visa alla pending/failed mutations for leverantoren med retry/discard-knappar

### Befintlig datamodell (implementerad i fas 2)
```
PendingMutation {
  id: string (auto-increment)
  endpoint: string
  method: string
  body: JSON
  createdAt: timestamp
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount: number
  errorMessage?: string
}
```

---

## Fas 4: Kund-offline (visa bokningar, annonser)

**Mal:** Kunder kan se sina bokningar och annonserade rutter offline.

### Approach
- Ateranvand samma Dexie.js-infrastruktur
- Cachebara kund-endpoints: `/api/customer/bookings`, `/api/announcements`
- Kund-specifik `useOnlineStatus`-banner i `CustomerLayout`
- Samma 4h cache-staleness

### Risker
- Kunder har generellt battre natatkomst an leverantorer (larre behov)
- Annonskrav: annonsdata kan bli inaktuell snabbt (platser fylls)

---

## Fas 5: Smart Pre-fetching

**Mal:** Proaktivt cacha data som leverantoren sannolikt behover.

### Approach
- **Ruttbaserad pre-fetch**: Nar leverantoren oppnar ruttplanering, cacha alla bokningar + kunddata for den ruttens stopp
- **Schemabaserad pre-fetch**: Cacha morgondagens bokningar automatiskt pa kvallen (om WiFi)
- **Selective sync**: Bara synka data som andrats sedan senaste sync (delta-sync med `updatedAt`)

### Tekniska krav
- Service worker `periodicsync` event (Chrome only)
- Fallback: synka vid app-start om senaste sync > X timmar
- Batterihansyn: bara synka pa WiFi eller vid laddning

---

## Fas 6: Offline-kartdata (Leaflet tiles)

**Mal:** Kartvy i ruttplanering fungerar offline.

### Approach
- **Tile caching**: Cache Leaflet tiles i service worker for besokta omraden
- **Bounded pre-fetch**: Ladda ner tiles for leverantorens vanliga arbetsomrade (definierat av tidigare rutter)
- **Storage budget**: Max 50 MB tile-cache, LRU eviction

### Risker
- Tile-storlek: ett kommun-omrade ~ 5-20 MB beroende pa zoom
- CORS: tile-servrar maste tillata caching
- OpenStreetMap usage policy: respektera rate limits vid bulk-download

---

## Prioritering

| Fas | Vardefull for anvandare | Teknisk komplexitet | Status |
|-----|------------------------|---------------------|--------|
| 1: Installbar PWA + cache | HOG | MEDEL | KLAR (2026-02-19) |
| 2: Offline-mutations | HOG | MEDEL | KLAR (2026-02-21) |
| 3: Konflikthantering | MEDEL | HOG | Nasta steg |
| 4: Kund-offline | LAG-MEDEL | LAG | Snabb win |
| 5: Smart Pre-fetching | HOG | HOG | Stor UX-forbattring |
| 6: Offline-kartor | MEDEL | HOG | Nice-to-have |

**Rekommenderad ordning:** 4 -> 3 -> 5 -> 6

Fas 4 (kund-offline) ar enkel att bygga med befintlig infrastruktur och kan goras parallellt med fas 3.
Fas 5 (smart pre-fetching) ar den storsta UX-forbattringen men kraver stabil sync forst.

---

## Framtida utforskningsideer

### Peer-to-peer sync (stall-LAN)
Manga stall har lokalt natverk men ingen internet. WebRTC eller mDNS-baserad sync mellan leverantorens telefon och stallkunders enheter. Hog komplexitet, parkerad.

### Rostloggning offline
Spela in rosten lokalt, transkribera med on-device Whisper (WebAssembly), synka text nar online. Kraver ~40 MB modell-download. Medel komplexitet.

### Push-notifikationer offline
Service worker kan visa notifikationer for lokala paminnelser (t.ex. "Nasta stopp om 15 min") aven utan natverk. Lag komplexitet, bra UX.
