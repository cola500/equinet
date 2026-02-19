# Plan: Offline PWA -- Roadmap

## Kontext

Fas 1 (installbar PWA + lasbara offline-data for leverantorer) ar implementerad och mergad.
Denna plan beskriver framtida faser for att bygga ut offline-stodet.

**Implementerat (fas 1):**
- Installbar PWA (manifest, service worker, offline-fallback)
- IndexedDB-cache for bokningar, rutter och profil (4h staleness)
- Network-first SWR-fetcher med cache-fallback
- Offline-banner + install-prompt
- Feature flag: `offline_mode`

---

## Fas 2: Offline-mutations (markera bokning klar, uppdatera ruttstopp)

**Mal:** Leverantorer kan utfora vanliga skrivoperationer offline. Andringar kolappar lokalt och synkas nar natverket atervandar.

### Approach
- **Optimistic UI**: Visa andringen direkt, spara i IndexedDB som "pending mutation"
- **Mutation queue**: FIFO-ko av operationer som vantar pa natverk
- **Retry med exponential backoff**: Nar online -> avarbeta kon
- **Konflikthantering**: Last-write-wins for enkla falt, manuell merge for komplexa

### Operationer att stodja
| Operation | Endpoint | Komplexitet |
|-----------|----------|-------------|
| Markera bokning genomford | `PATCH /api/bookings/:id` | Lag |
| Uppdatera bokningsanteckning | `PATCH /api/bookings/:id` | Lag |
| Uppdatera ruttstopp-status | `PATCH /api/routes/:id/stops` | Medel |
| Logga arbete (text) | `POST /api/voice-log` | Lag |

### Tekniska beslut
- **Background Sync API** for automatisk retry (Chrome/Edge, ej Safari)
- **Fallback**: Manuell sync-knapp for Safari/iOS
- **UI**: "Osparad andring"-badge pa bokningar med pending mutations

### Risker
- Safari stodjer inte Background Sync -- manuell fallback kravs
- Konflikthantering: om annan anvandare andrar samma bokning medan provider ar offline
- Mutation-ordning: beroenden mellan operationer (t.ex. markera klar -> skicka faktura)

---

## Fas 3: Background Sync + Konflikthantering

**Mal:** Robust synkronisering med konfliktdetektering.

### Approach
- **Versionsstamplar**: Lagg till `updatedAt` + `version` pa Booking/RouteStop
- **Optimistic concurrency**: Skicka version med mutation, servern avvisar om stale
- **Konflikt-UI**: Toast med "Denna bokning har andrats av nagon annan. Vill du skriva over?"
- **Sync-status-sida**: Visa alla pending/failed mutations for leverantoren

### Datamodell
```
PendingMutation {
  id: string (UUID)
  endpoint: string
  method: string
  body: JSON
  createdAt: timestamp
  status: 'pending' | 'syncing' | 'failed' | 'resolved'
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

| Fas | Vardefull for anvandare | Teknisk komplexitet | Rekommendation |
|-----|------------------------|---------------------|----------------|
| 2: Offline-mutations | HOG | MEDEL | Nasta steg |
| 3: Background Sync | MEDEL | HOG | Nar fas 2 ar stabil |
| 4: Kund-offline | LAG-MEDEL | LAG | Snabb win nar fas 2 ar klar |
| 5: Smart Pre-fetching | HOG | HOG | Stor UX-forbattring |
| 6: Offline-kartor | MEDEL | HOG | Nice-to-have |

**Rekommenderad ordning:** 2 -> 4 -> 3 -> 5 -> 6

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
