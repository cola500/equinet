---
title: Route Planning Discovery Audit
description: Read-only inventering av befintliga ruttplanerings-capabilities i Equinet inför ett möjligt nytt produktspår kring leverantörers ruttplanering.
category: research
status: draft
last_updated: 2026-06-07
sections:
  - Sammanfattning (TL;DR)
  - 1. Data
  - 2. UI
  - 3. Integrationer
  - 4. Gruppfunktioner
  - 5. Gap Analysis
  - 6. Roadmap
  - Återanvändbara byggstenar (referens)
tags:
  - route-planning
  - discovery
  - provider
related:
  - docs/architecture/booking-flow.md
---

# Route Planning Discovery Audit (2026-06)

> **Typ:** Read-only inventering. Ingen kod, ingen commit, ingen implementation.
> **Syfte:** Inventera vad som redan finns innan vi bygger ett nytt produktspår kring leverantörers ruttplanering.
> **Metod:** Källkodsgranskning av `prisma/schema.prisma`, `src/lib/`, `src/app/provider/`, `src/app/api/`, feature-flag-definitioner. Påståenden verifierade mot faktiska filer (`file:line`).

---

## Sammanfattning (TL;DR)

**Viktigaste insikten:** Ruttplanering är **inte greenfield** — en fungerande PoC-/MVP-nivå finns redan byggd och ligger bakom feature-flaggorna `route_planning` och `route_announcements` (båda `defaultEnabled: true`). Det finns datamodeller, API-routes, optimering, kartvisning och flera UI-sidor.

Det betyder att frågan inte är *"ska vi bygga ruttplanering?"* utan **"ska vi härda och integrera den befintliga PoC:n i leverantörens dagliga arbetsflöde, och i så fall vilka beroenden måste göras robusta först?"**

| Område | Status | Kommentar |
|--------|--------|-----------|
| **Data** (koordinater, adresser, tidsfönster, arbetsområde) | ✅ Finns | Bra geo-fält + index på User, Provider, Stable, RouteOrder, RouteStop |
| **UI** (kalender, bokningar, kundlista, dashboard, insights) | ✅ Finns | Plus dedikerade rutt-sidor: `/provider/route-planning`, `/provider/routes` |
| **Karta + avstånd + resväg** | ✅ Finns | Leaflet + OSRM + Haversine + Modal-optimerare |
| **Integrationer** (geocoding, routing) | ⚠️ Finns men skört | Nominatim, OSRM och **Modal.com personlig endpoint** — gratis publika tjänster utan SLA |
| **Gruppfunktioner** | ✅ Mestadels | Gruppbokningar (GA), due-for-service (GA), seriebokningar |
| **Daglig planeringsvy ("min arbetsdag idag")** | ❌ Saknas | Ingen sammanhållen "dagens rutt"-vy som binder ihop bokningar + ordning + restid |

**Största risken i nuläget:** ruttoptimeringen anropar en **personlig Modal.com-URL** (`johanlin--route-optimizer-...modal.run`) från Experiment 001. Det är en single point of failure utanför projektets kontroll.

---

## 1. Data

Vilken data finns redan för ruttplanering? **Svar: nästan all grunddata finns, med geo-index.**

### Koordinater & adresser (verifierat)

| Modell | Geo-fält | Adressfält | Källa |
|--------|----------|------------|-------|
| **User** (kund) | `latitude`, `longitude`, `municipality` | `address`, `city` | `schema.prisma:26-30`, index `:60-61` |
| **Provider** (leverantör) | `latitude`, `longitude` | `address`, `city`, `postalCode` | `schema.prisma:79-94` |
| **Stable** (stall) | `latitude`, `longitude`, `municipality` | `address`, `city`, `postalCode` | `schema.prisma:914-940`, index `:937-938` |
| **RouteOrder** (beställning/annons) | `latitude`, `longitude`, `municipality` | `address` | `schema.prisma:391-431` |
| **RouteStop** (stopp i rutt) | `latitude`, `longitude` | `address`, `locationName` | `schema.prisma:452-475` |
| **AvailabilityException** | `latitude`, `longitude` | `location` | `schema.prisma:183-196` |
| **GroupBookingRequest** | `latitude`, `longitude`, `municipality` | `address`, `locationName` | `schema.prisma:630-640` |

### Kunder, hästar, stall

- **Kund → position:** `User.latitude/longitude` + `municipality`.
- **Häst → position:** `Horse.stableId` → `Stable.latitude/longitude` (`schema.prisma:283-284`). Hästen har **inga egna** koordinater — positionen ärvs från stall (eller fallback till ägarens adress).
- **Stall:** fullständig adress + geo + kommun + index. Hästar länkas via `Stable.horses`.

### Bokningar & tidsfönster

| Fält | Modell | Betydelse |
|------|--------|-----------|
| `bookingDate` | Booking | Datum för tjänsten |
| `startTime`, `endTime` | Booking | `"HH:MM"`-strängar |
| `timezone` | Booking | DST-hantering (Europe/Stockholm) |
| **`travelTimeMinutes`** | Booking (`schema.prisma:236`) | **Restid från föregående stopp** (fält finns redan) |
| `dateFrom`, `dateTo`, `priority` | RouteOrder | Tidsfönster + `normal`/`urgent` |
| `estimatedArrival`, `estimatedDurationMin` | RouteStop | Beräknad ankomst + arbetstid |
| `actualArrival`, `actualDeparture` | RouteStop | Faktiska tider (uppföljning) |

### Leverantörens arbetsområde

- `Provider.serviceAreaKm` (`schema.prisma:92`, default **50 km**) — radie kring leverantörens hemposition.
- `Provider.serviceArea` (`schema.prisma:94`) — **DEPRECATED** JSON-array, behållen för bakåtkompatibilitet.
- Veckoschema: `Availability` (dayOfWeek + start/end + isClosed). Dagsundantag: `AvailabilityException`.

**Datanivå-slutsats:** Allt som behövs för en rutt finns — punkter (lat/lng), tidsfönster, arbetsområde, restidsfält. **Luckor:** hästen positioneras indirekt via stall/ägare (inget eget koordinatfält); ingen färdig distansmatris-cache (avstånd beräknas on-demand).

---

## 2. UI

### Befintliga leverantörsvyer som berör planering

| Vy | Fil | Vad den visar |
|----|-----|---------------|
| **Kalender** | `src/app/provider/calendar/page.tsx` (623 rader) | Dag/3-dagar/vecka/månad, färgkodade bokningar per status, öppettider, undantag |
| **Bokningar** | `src/app/provider/bookings/page.tsx` (628 rader) | Filterbar lista per status, accept/avvisa/genomför, noteringar |
| **Kundlista** | `src/app/provider/customers/page.tsx` | Kunder + kopplade hästar, sök/filter |
| **Dashboard** | `src/app/provider/dashboard/page.tsx` (487 rader) | KPI-kort, "din nästa åtgärd", **aktiva rutter med framsteg**, snabblänk "Planera rutter" |
| **Insights** | `src/app/provider/insights/page.tsx` | Tjänstefördelning, tidsheatmap, kundretention, KPI:er |

### Dedikerade rutt-vyer (finns redan!)

| Vy | Fil | Vad den gör |
|----|-----|-------------|
| **Ruttplanering** | `src/app/provider/route-planning/page.tsx` (~24 kB) | Lista tillgängliga beställningar sorterade på avstånd, filter (tjänst/prioritet), **Leaflet-karta**, välj ≥2 → **optimera rutt** (Modal), skapa rutt (namn/datum/starttid) |
| **Ruttöversikt** | `src/app/provider/routes/page.tsx` (242 rader) | Lista alla rutter (planerad/aktiv/klar/avbruten), framsteg X/Y stopp, sträcka, tid |
| **Ruttdetalj** | `src/app/provider/routes/[id]/page.tsx` | Stoppordning, status per stopp, markera pågående/klar/problem, offline-stöd |

### Visar något redan karta / avstånd / resväg / område / dagens bokningar?

| Fråga | Svar | Var |
|-------|------|-----|
| **Karta** | ✅ Ja | `RouteMapVisualization.tsx` (Leaflet, markörer + original- vs optimerad rutt) |
| **Avstånd** | ✅ Ja | `route-planning` sorterar beställningar på avstånd; `geo/distance.ts` Haversine |
| **Resväg** | ✅ Ja | OSRM ger faktisk väggeometri (inte fågelväg) via `routing.ts` |
| **Område** | ✅ Delvis | `UpcomingRoutes.tsx` (kommun + datumintervall på providerprofil), `NearbyRoutesBanner.tsx` (rutter inom 50 km för kund) |
| **Dagens bokningar** | ❌ Saknas dedikerat | Kalendern visar dag/vecka men ingen sammanhållen "min arbetsdag idag = ordnad rutt + restid"-vy |

**UI-slutsats:** Ovanligt mycket finns redan. Den tydligaste UI-luckan är en **daglig planeringsvy** som binder ihop dagens bekräftade bokningar i geografisk ordning med restid och karta — i dag är "rutt" och "kalender/bokningar" två separata världar.

---

## 3. Integrationer

| Tjänst | Status | Detaljer |
|--------|--------|----------|
| **Google Maps** | ❌ Ej använd | Endast en övergiven referens i `prisma/migrate-geocode-providers.ts:27` (`GOOGLE_MAPS_API_KEY`). Ersatt av Nominatim. |
| **Apple Maps / MapKit** | ❌ Ej implementerad | Ingen träff. |
| **Geocoding** | ✅ Nominatim (OSM) | `src/lib/geocoding.ts` + `/api/geocode`. Redis-cache 30 dagar (`geocoding-cache.ts`). Rate limit 1 req/s mot Nominatim. Svensk koordinatvalidering. |
| **Distance Matrix** | ⚠️ Eget | Ingen Google Distance Matrix. Avstånd via Haversine (`geo/distance.ts`) + OSRM för väg. |
| **Routing / Directions** | ✅ OSRM | `src/lib/routing.ts` + `/api/routing`. Publik instans `router.project-osrm.org`. Fallback till raka linjer. |
| **Ruttoptimering** | ⚠️ Modal.com | `src/lib/route-optimizer.ts` → `/api/optimize-route` → **personlig Modal-endpoint** (`johanlin--route-optimizer-...modal.run`) från "Experiment 001". |
| **Kartbibliotek** | ✅ Leaflet | `leaflet@^1.9.4` + `react-leaflet@^4.2.1`. Inga Mapbox/Google-kartor. |

### Riskflagga (integrationer)

Alla tre kärnberoenden är **gratis publika tjänster utan SLA**, och ett är en **personlig endpoint**:

1. **Modal.com personlig URL** — single point of failure utanför projektets kontroll. Om kontot/endpointen försvinner slutar optimering fungera.
2. **OSRM publik instans** — rate-limitad (100 req/min lokalt), ingen drifts­garanti.
3. **Nominatim publik** — 1 req/s, kräver "fair use".

Dessutom finns kvarlämnad PoC-kod: `generateMockCoordinates()` i `route-optimizer.ts` ("I framtiden: ersätt med riktig geocoding"). Själva `route-planning`-sidan använder dock **riktig** `order.latitude/longitude`-data (`route-planning/page.tsx:128-165`), inte mock.

---

## 4. Gruppfunktioner

| Funktion | Status | Detaljer |
|----------|--------|----------|
| **Gruppbokningar** | ✅ GA (flagga borttagen) | `GroupBookingService.ts` + repo + 6 API-routes. Skapa förfrågan → kunder ansluter via inbjudningskod → leverantör matchar och skapar N sekventiella bokningar. |
| **Flera hästar på samma besök** | ⚠️ Delvis | `Booking` = 1 häst (`horseId`). `GroupBookingParticipant.numberOfHorses` finns men lagrar bara **en** `horseId`/`horseName`. Multi-häst kräver schemautökning. |
| **Återbesök (due-for-service)** | ✅ GA (flagga borttagen) | `DueForServiceService.ts`. Intervall: kund-override → häst-override → tjänststandard. Klassar overdue/upcoming/ok. |
| **Seriebokningar (recurring)** | ✅ Implementerad | `BookingSeriesService.ts`. `intervalWeeks`, hoppar över överlapp/stängt/otillräcklig restid. Flagga `recurring_bookings` finns kvar. |

**Koppling till ruttplanering:** due-for-service + seriebokningar är naturliga *källor* till ruttbeställningar ("dessa 8 hästar är overdue i kommun X → bygg en rutt"). Den kopplingen finns **inte** byggd i dag.

---

## 5. Gap Analysis

**Mål:** *"Leverantören ska kunna planera sin arbetsdag effektivt."*

### Vad finns redan

- ✅ All grunddata: koordinater, adresser, tidsfönster, arbetsområde, restidsfält, geo-index.
- ✅ Geocoding (Nominatim), väg-routing (OSRM), avstånd (Haversine), karta (Leaflet).
- ✅ Ruttoptimering (Modal) med procentuell förbättring.
- ✅ Datamodeller: `RouteOrder`, `Route`, `RouteStop` med ordning, ankomsttid, status, faktiska tider.
- ✅ UI: ruttplanering, ruttöversikt, ruttdetalj, aktiva rutter på dashboard.
- ✅ Bokningar, kalender, kundlista, insights.
- ✅ Närliggande gruppfunktioner (grupp, återbesök, serier).

### Vad saknas / är skört

| Lucka | Typ | Påverkan |
|-------|-----|----------|
| **Daglig planeringsvy** ("min arbetsdag idag" = ordnade bokningar + restid + karta) | UI | Hög — det är kärnan i löftet "planera arbetsdagen" |
| **Koppling bokningar → rutt** | Logik | Hög — i dag är rutter och bokningar separata; en dags bekräftade bokningar blir inte automatiskt en optimerbar rutt |
| **Robusta integrationer** (Modal personlig endpoint, OSRM/Nominatim utan SLA) | Drift | Hög — produktrisk om PoC-beroenden inte härdas |
| **Häst utan egna koordinater** | Data | Medel — kräver fallback-kedja stall→ägare; orphan om varken stall eller ägaradress finns |
| **Källkoppling due-for-service / serier → ruttförslag** | Logik | Medel — stort värde men beroende av basflödet först |
| **Realtids-tracking under körning** | Feature | Låg (MVP) — `actualArrival/Departure` finns men ingen live-position/push |
| **Distansmatris-cache** | Performance | Låg — on-demand räcker initialt |
| **Multi-häst per besök** | Data | Låg (separat behov) |
| **Kvarlämnad mock-kod** (`generateMockCoordinates`) | Städning | Låg |

**Slutsats:** Gapet är **inte "bygg ruttplanering"** — det är **"härda PoC:n + bygg den sammanhållna dagliga vyn som binder ihop bokningar, ordning och restid"**.

---

## 6. Roadmap

### A. Minsta möjliga slice (MVP) — "Dagens rutt"

> **Som leverantör vill jag se dagens bekräftade bokningar i geografisk ordning med restid mellan stopp, så att jag kan köra dem i effektiv följd utan att själv pussla.**

- Ny vy `/provider/today` (eller flik i kalendern): hämta dagens `confirmed` bokningar → härled koordinater (kund/stall) → sortera/optimera ordning → visa lista + befintlig `RouteMapVisualization`.
- **Återanvänder:** `route-optimizer.ts`, `routing.ts`, `RouteMapVisualization.tsx`, `geo/distance.ts`, befintliga Booking-queries.
- **Levererar ~70% av värdet:** leverantören ser sin dag som en körbar rutt utan att lära sig ett separat "rutt"-koncept.
- **Förutsättning före lansering:** ersätt eller härda **Modal-endpointen** (egen hosting eller fallback till nearest-neighbour lokalt) — annars introduceras en personlig single-point-of-failure i kärnflödet. (Kan startas bakom befintlig `route_planning`-flagga.)

### B. Nästa slice — "Bygg rutt från behov"

> **Som leverantör vill jag att overdue-hästar och kommande seriebokningar i ett område föreslås som en rutt, så att jag fyller en körning effektivt.**

- Koppla `DueForServiceService` + `BookingSeries` som **källor** till ruttförslag, filtrerat på kommun/avstånd.
- Persistens av planerad rutt via befintliga `Route`/`RouteStop` (finns redan).
- Härda OSRM/Nominatim (egen instans eller betald provider + caching) för driftsäkerhet vid volym.
- Lös häst-positionsfallback (stall → ägare → geocode-adress) explicit.

### C. Full route planning vision

- Multi-dag/veckoplanering med kapacitet (arbetstidsfönster, `serviceAreaKm`, pauser).
- Realtids-tracking under körning (live-position, push vid nästa stopp, kund-ETA-notis).
- Multi-häst per besök (schemautökning) + distansmatris-cache för snabb omoptimering.
- Automatiska ruttförslag (smart scheduling: gruppera overdue + serier + nya förfrågningar till föreslagna kördagar).
- Robust integrationslager med leverantörsabstraktion (byt OSRM/Modal/Nominatim utan att röra UI).

---

## Återanvändbara byggstenar (referens)

**Bibliotek**
- `src/lib/geo/distance.ts` — Haversine, `calculateDistance`, `filterByDistance` (kanonisk distansmodul — duplicera ALDRIG, jfr CLAUDE.md).
- `src/lib/geocoding.ts` — Nominatim-klient (adress → lat/lng).
- `src/lib/cache/geocoding-cache.ts` — Redis-cache 30 dagar.
- `src/lib/routing.ts` — OSRM väg-geometri + fallback.
- `src/lib/route-optimizer.ts` — Modal-optimerare (⚠️ personlig endpoint + kvarlämnad `generateMockCoordinates`).

**Komponenter**
- `src/components/RouteMapVisualization.tsx` — Leaflet-karta, original- vs optimerad rutt.
- `src/components/UpcomingRoutes.tsx` — kommande besök per område.
- `src/components/NearbyRoutesBanner.tsx` — rutter inom 50 km (kundvy).

**API-routes**
- `/api/geocode`, `/api/routing`, `/api/optimize-route`
- `/api/routes`, `/api/routes/my-routes`, `/api/routes/[id]`, `/api/routes/[id]/stops/[stopId]`
- `/api/route-orders`, `/api/route-orders/available`, `/api/route-orders/announcements`

**Datamodeller** (`prisma/schema.prisma`)
- `RouteOrder` (`:391`), `Route` (`:433`), `RouteStop` (`:452`), `Stable` (`:914`), `Booking.travelTimeMinutes` (`:236`), `Provider.serviceAreaKm` (`:92`).

**Feature flags**
- `route_planning` (`defaultEnabled: true`), `route_announcements` (`defaultEnabled: true`), `recurring_bookings`.

---

> **Stoppar efter analys** — ingen implementation gjord. Detta dokument är beslutsunderlag för om/hur spåret ska tas vidare.
</content>
</invoke>
