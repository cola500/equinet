---
title: Dagens Rutt — Discovery Slice
description: Minsta möjliga version av "Dagens rutt" genom återbruk av befintliga route planning-komponenter. Read-only discovery, ingen implementation.
category: research
status: draft
last_updated: 2026-06-07
sections:
  - Mål & avgränsning
  - 1. Återanvändbara komponenter
  - 2. Minsta användarresa
  - 3. Minsta implementation
  - 4. User stories
  - 5. Wireframe
  - Nästa steg
tags:
  - route-planning
  - dagens-rutt
  - discovery
  - provider
related:
  - docs/discovery/route-planning-audit-2026-06.md
depends_on:
  - docs/discovery/route-planning-audit-2026-06.md
---

# Dagens Rutt — Discovery Slice (2026-06)

> **Typ:** Read-only discovery. Ingen kod, ingen commit, ingen implementation.
> **Mål:** Skapa minsta möjliga version av "Dagens rutt" genom att återanvända befintliga route planning-komponenter.
> **Ursprung:** Slice A (MVP) från [route-planning-audit-2026-06.md](route-planning-audit-2026-06.md).

## Mål & avgränsning

Bygg den minsta vy som binder ihop dagens bokningar med karta och ordning — så leverantören ser sin arbetsdag geografiskt utan att själv pussla.

**Hårda constraints (från uppdraget):**

- Använd befintlig `RouteMapVisualization`.
- Använd befintliga routing/distance-helpers.
- Inga nya databastabeller.
- Ingen ny route optimizer.
- Ingen AI.
- Ingen ny feature flag.

---

## 1. Återanvändbara komponenter (verifierat mot koden)

| Byggsten | Fil | Status för återbruk |
|----------|-----|---------------------|
| **Kartvisualisering** | `src/components/RouteMapVisualization.tsx` | ✅ Drop-in. Tar `orders[]` + `selectedOrderIds[]` + `startLocation`. Ritar numrerade markörer + rutt-linje (OSRM-väg, fallback rak linje) när ≥2 valda. Hanterar redan saknade koordinater grafiskt. |
| **Väg-routing** | `src/lib/routing.ts` (`getRouteWithFallback`) | ✅ Anropas redan internt av kartan. Inget eget anrop behövs. |
| **Avståndsberäkning** | `src/lib/geo/distance.ts` (`calculateDistance`) | ✅ Haversine, km mellan två punkter. Klient-säker. |
| **Dagens bokningar + koordinater** | `PrismaBookingRepository.ts:224` `findByProviderAndDateWithLocation(providerId, date)` | ⚠️ **Finns redan men används ingenstans** (grep tomt). Returnerar pending+confirmed för ett datum, sorterat på `startTime`, med `customer.latitude/longitude/address`. **Saknar** `serviceType` + kundnamn som kartan vill ha. |
| **Provider-position som startpunkt** | `Provider.latitude/longitude` (`schema.prisma:79`) | ✅ Finns. Ersätter kartans default (Göteborg centrum). |
| **Feature flag** | `route_planning` (default på) | ✅ Återanvänds — ingen ny flagga. |

**Viktigaste fyndet:** repository-metoden `findByProviderAndDateWithLocation` byggdes för restidsvalidering men är **oanvänd** — den är nästan exakt rätt datakälla för Dagens rutt. Enda gapet: den selekterar inte `serviceType`/kundnamn. Det löses med ett litet tillägg i select-blocket (inget nytt bord, ingen ny optimizer).

**Ärlig begränsning:** koordinaterna kommer från **kundens** adress (`customer.latitude`), inte hästens stall. För MVP räcker kundposition; stall-fallback (`Horse.stableId → Stable.lat/lng`) är en framtida förfining. Kunder utan geokodad adress → markör utelämnas (kartan visar redan ett "saknar koordinater"-tillstånd).

### Kartans förväntade dataform

`RouteMapVisualization` vill ha `orders` på formen (från `RouteMapVisualization.tsx:22-35`):

```ts
{
  id: string
  address: string
  latitude: number | null
  longitude: number | null
  serviceType: string
  customer: { firstName: string; lastName: string } | null
}
```

Varje dagens bokning mappas till denna form. `selectedOrderIds` = alla id:n (alla stopp visas). `startLocation` = providerns position.

---

## 2. Minsta användarresa

```
Provider Kalender ──[knapp "Dagens rutt"]──▶ /provider/today
                                                  │
                                                  ├─ Karta: dagens stopp i tidsordning + rutt-linje
                                                  └─ Lista: stopp 1..N (tid, kund, adress, tjänst)
```

Ingen optimering, inget val — **tidsordning = ruttordning**. Leverantören ser sin redan bokade dag geografiskt. Poängen med MVP:n är att göra befintlig data synlig på karta, inte räkna om något.

---

## 3. Minsta implementation som ger användartestvärde

1. **En tunn GET-route** `/api/provider/today-route` (auth → `providerId` från session → `findByProviderAndDateWithLocation` med utökat select för `serviceType` + kundnamn). Inget nytt bord.
2. **En ny sida** `/provider/today/page.tsx` (klient): hämtar via SWR, mappar bokning → kartans `RouteOrder`-form, skickar `selectedOrderIds = alla id:n` och `startLocation = providerposition`.
3. **Listvy** under kartan: stoppen i `startTime`-ordning (tid, kund, adress, tjänst).
4. **Ingångspunkt**: en knapp i `/provider/calendar`.

Det är allt. Kartan sköter routing/fallback/bounds själv. Ingen ny optimizer, ingen AI, ingen ny flagga, ingen migration.

---

## 4. User stories (3 st, MVP först)

### Story 1 (MVP) — Dagens rutt på karta

> Som leverantör vill jag se dagens bekräftade bokningar i tidsordning på en karta med en sammanhållande rutt-linje, så att jag ser min arbetsdag geografiskt utan att pussla själv.

*Återanvänder: `RouteMapVisualization`, `routing.ts`, `findByProviderAndDateWithLocation`. Levererar ~70 % av värdet.*

### Story 2 — Avstånd & total körsträcka

> Som leverantör vill jag se avstånd mellan stoppen och dagens totala körsträcka, så att jag förstår reseomfånget.

*Återanvänder: `calculateDistance` mellan konsekutiva stopp. Liten påbyggnad ovanpå Story 1.*

### Story 3 — Ingång från kalendern

> Som leverantör vill jag nå "Dagens rutt" direkt från kalendern, så att planeringen finns där jag redan tittar på min dag.

*Ren UI: knapp/länk i `calendar/page.tsx`. Kan slås ihop med Story 1.*

**Rekommendation:** bygg **Story 1 + 3 ihop** (vyn är värdelös utan ingång), lägg **Story 2** som omedelbar uppföljning i samma slice om tid finns.

---

## 5. Wireframe (text)

```
┌─────────────────────────────────────────────┐
│  ← Kalender        Dagens rutt      [Idag ▾] │   ← datumväljare (default idag)
├─────────────────────────────────────────────┤
│                                             │
│         ╔═══════════════════════╗           │
│         ║   [KARTA]             ║           │
│         ║    ● start (du)       ║           │
│         ║     ╲                 ║           │
│         ║      ①────②           ║           │   ← RouteMapVisualization
│         ║           ╲           ║           │     numrerade stopp + rutt-linje
│         ║            ③          ║           │
│         ║              Legend ▢ ║           │
│         ╚═══════════════════════╝           │
│                                             │
│  Story 2:  Total: ~42 km · 3 stopp          │   ← calculateDistance-summa
├─────────────────────────────────────────────┤
│  DAGENS STOPP                               │
│  ┌─────────────────────────────────────┐    │
│  │ ① 08:00  Anna Svensson              │    │
│  │          Storgatan 1, Alingsås      │    │
│  │          Hovslagning                │    │
│  │                       (Story 2: 12 km)│   │
│  ├─────────────────────────────────────┤    │
│  │ ② 10:00  Erik Berg                  │    │
│  │          Ekvägen 4, Vårgårda        │    │
│  │          Hovslagning                │    │
│  │                       (Story 2: 18 km)│   │
│  ├─────────────────────────────────────┤    │
│  │ ③ 13:00  Maria Lind                 │    │
│  │          Hagvägen 9, Herrljunga     │    │
│  │          Tandvård                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Tomt läge: "Inga bokningar idag 🐴"        │   ← när dagens lista är tom
└─────────────────────────────────────────────┘
```

Mobil-först (`useIsMobile`): kartan överst, lista scrollbar under — samma vertikala layout fungerar på desktop.

---

## Nästa steg

Beslut kvarstår (ingen implementation påbörjad):

- **(a)** Seven-Dimensions-refinement + lägg Story 1+3 som backlog-rad i `status.md`, eller
- **(b)** Bygg slicen direkt (Story 1+3, ev. Story 2), eller
- **(c)** Vänta.

> **Stoppar före implementation** — detta dokument är beslutsunderlag.
</content>
