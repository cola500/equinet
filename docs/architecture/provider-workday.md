---
title: "Provider Workday -- ruttplanering och leverantörens arbetsdag"
description: "Sammanhängande arkitekturöversikt: hur bokningar, rutter, geo-integrationer och stall-som-besöksplats bildar leverantörens arbetsdag. Mognadsklassning per del och kända risker."
category: architecture
status: active
last_updated: 2026-06-11
tags: [routes, provider, workday, geo, osrm, stable]
depends_on:
  - prisma/schema.prisma
related:
  - ../discovery/route-planning-audit-2026-06.md
  - ../discovery/dagens-rutt-slice-2026-06.md
  - ../discovery/dagens-rutt-verifiering-2026-06.md
  - ../api/routes.md
sections:
  - Domänen i en mening
  - Dataflöde
  - Datamodeller
  - Geo-integrationer
  - API-yta
  - UI-yta
  - Stall som besöksplats
  - Feature flags
  - Mognad per del
  - Kända risker
  - Relaterade dokument
---

# Provider Workday -- ruttplanering och leverantörens arbetsdag

Detta dokument är den sammanhängande översikten över allt som bygger upp
**leverantörens arbetsdag**: bokningar i kalendern, ruttbeställningar,
ruttplanering med karta och optimering, samt "Dagens rutt". Detaljerna bor i
koden och i de relaterade dokumenten -- det här är kartan över hur delarna hänger ihop.

---

## Domänen i en mening

En leverantör (t.ex. hovslagare) har en dag full av **bokningar** på olika platser;
systemet hjälper hen att **se, ordna och köra** dagen -- från kalender till karta
till navigering.

## Dataflöde

Två parallella spår leder fram till en körbar dag:

```
SPÅR 1 -- Bokningsdriven (Dagens rutt, implementerad juni 2026):
Booking (bekräftad, datum) ──> /api/provider/today-route ──> /provider/today
        │                                                     (karta + lista + körsträcka)
        └── Booking.horseId → Horse.stableId → Stable(lat/lng)  = besöksplats
            (fallback: kundens adress)

SPÅR 2 -- Beställningsdriven (ruttplanering, PoC-nivå):
RouteOrder (kund skapar beställning ELLER leverantör annonserar)
   ──> /provider/route-planning (välj ordrar, optimera via Modal)
   ──> Route + RouteStop[] (planerad rutt med stoppordning)
   ──> /provider/routes/[id] (kör rutten, statusa stopp)
```

Spåren är idag **inte sammankopplade**: en Route byggs av RouteOrders, inte av
Bookings. `Booking.routeOrderId` (nullable) är bryggan som finns i schemat men
inte i något flöde.

## Datamodeller

Alla i `prisma/schema.prisma`:

| Modell | Roll | Nyckelfält |
|--------|------|-----------|
| `Route` | Planerad körrutt för en dag | `providerId`, `routeDate`, `startTime`, `status` (planned/active/completed/cancelled), `totalDistanceKm` |
| `RouteStop` | Stopp i en rutt | `stopOrder`, `latitude/longitude`, `estimatedArrival`, `actualArrival/Departure`, `status` (pending/in_progress/completed/problem) |
| `RouteOrder` | Tvåvägs: kundbeställning ELLER leverantörsannons | `announcementType` (customer_initiated/provider_announced), `address` + geo, `municipality`, `dateFrom/To`, `priority` |
| `Booking` | Kärndomän; bär geo-relevanta fält | `routeOrderId` (nullable brygga), `travelTimeMinutes`, `horseId` → `Horse` → `Stable` |
| `Stable` | Besöksplats-kandidat | `latitude/longitude`, `address`, `city`, `municipality` |

Geo-koordinater finns även på `User` (kund), `Provider` (+ `serviceAreaKm`) och
`AvailabilityException` (dagens arbetsplats).

## Geo-integrationer

| Modul | Tjänst | Ansvar |
|-------|--------|--------|
| `src/lib/geo/distance.ts` | -- (ren beräkning) | Haversine-avstånd. **Enda källan** -- duplicera aldrig. |
| `src/lib/geocoding.ts` | Nominatim (OpenStreetMap) | Adress → lat/lng. Redis-cache 30 dagar, rate limit 1 req/s. |
| `src/lib/routing.ts` | OSRM (publik instans) | Väg-geometri + körsträcka/tid mellan stopp. Fallback: raka linjer. |
| `src/lib/route-optimizer.ts` | Modal.com (personlig endpoint) | TSP-optimering av stoppordning. |

## API-yta

| Endpoint | Syfte |
|----------|-------|
| `GET /api/provider/today-route?date=` | Dagens bekräftade bokningar med besökskoordinater, sorterade på starttid. Bygger "Dagens rutt". |
| `POST/GET /api/routes`, `GET /api/routes/my-routes`, `GET /api/routes/[id]` | Skapa/lista/hämta rutter. |
| `PATCH /api/routes/[id]/stops/[stopId]` | Statusa stopp under körning (offline-stöd). |
| `/api/route-orders/*` | Beställningar + annonser (kund- och leverantörssida, geo-filtrerad sökning). |
| `POST /api/optimize-route` | Proxy till Modal-optimeraren. |
| `/api/geocode`, `/api/routing` | Proxy till Nominatim respektive OSRM. |

Fullständiga kontrakt: [docs/api/routes.md](../api/routes.md).

> `PrismaBookingRepository.findByProviderAndDateWithLocation()` byggdes under
> discovery men används inte -- `today-route`-endpointen fick en egen smalare query.
> Städa eller återanvänd vid nästa slice.

## UI-yta

| Sida | Vad |
|------|-----|
| `/provider/calendar` | Kalender (dag/3d/vecka/månad) med ingång till Dagens rutt. |
| `/provider/today` | **Dagens rutt**: numrerade stopp på Leaflet-karta + lista, körsträcka (OSRM, Haversine-fallback), datumväljare. |
| `/provider/route-planning` | Arbetsyta: tillgängliga beställningar, filter, karta, optimera (Modal), skapa rutt. |
| `/provider/routes` + `/routes/[id]` | Ruttöversikt + körning med stoppstatus. |

Kartkomponent: `src/components/RouteMapVisualization.tsx` (Leaflet).

## Stall som besöksplats

Besöksplatsen för en bokning bestäms i `today-route`-endpointen:

1. Har hästens stall (`Booking.horse.stable`) koordinater → **stallet** är besöksplatsen (med `stableName` som etikett).
2. Annars → **kundens hemadress**.

**Detta är en medveten MVP-förenkling** -- stallet är en proxy för besöksplats, inte
en explicit modell. Framtida stall-epic ([epic-stall.md](../ideas/epic-stall.md))
ska ersätta proxyn med en explicit besöksadress kopplad till häst eller bokning.
Se [dagens-rutt-verifiering-2026-06.md](../discovery/dagens-rutt-verifiering-2026-06.md).

## Feature flags

| Flagga | Gatar | Default |
|--------|-------|---------|
| `route_planning` | Route-API:er (404 om av), `/provider/route-planning`, `/provider/routes`, `/provider/today`, nav-länkar | På |
| `route_announcements` | Annonsdelen av route-orders | På |

## Mognad per del

| Del | Mognad | Kommentar |
|-----|--------|-----------|
| Dagens rutt (`/provider/today` + API) | **Implementerad & verifierad** (juni 2026) | Visuellt verifierad, demo-seedad. |
| Kalender | **GA** | Kärnfunktion. |
| Ruttplanering + optimering | **PoC** | Fungerar men skör: personlig Modal-endpoint, ingen koppling till bokningar. |
| Route-körning (stoppstatus) | **PoC** | Offline-stöd finns. |
| Stall som besöksplats | **Temporär proxy** | Ersätts av explicit modell i stall-epicen. |
| Booking ↔ Route-koppling | **Saknas** | `routeOrderId` finns i schemat men inget flöde använder bryggan. |

## Kända risker

1. **Modal.com-optimeraren är en personlig endpoint** (`johanlin--route-optimizer-...`) -- single point of failure utan SLA. Migrationsväg behövs före bredare användning.
2. **OSRM och Nominatim är publika instanser** utan SLA. Caching och fallbacks mildrar (raka linjer, Haversine), men kör-kritiska flöden bör inte hårt bero på dem.
3. **Två frikopplade spår** (bokningar vs ruttbeställningar) kan förvirra både användare och utvecklare -- en framtida slice bör antingen koppla ihop dem eller medvetet pensionera RouteOrder-spåret.

## Relaterade dokument

- [route-planning-audit-2026-06.md](../discovery/route-planning-audit-2026-06.md) -- discovery: vad som fanns före Dagens rutt
- [dagens-rutt-slice-2026-06.md](../discovery/dagens-rutt-slice-2026-06.md) -- discovery: MVP-slicen
- [dagens-rutt-verifiering-2026-06.md](../discovery/dagens-rutt-verifiering-2026-06.md) -- implementation + verifiering
- [docs/api/routes.md](../api/routes.md) -- API-referens
- [epic-stall.md](../ideas/epic-stall.md) -- framtida besöksplats-modell
