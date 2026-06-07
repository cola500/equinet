---
title: Dagens Rutt (MVP) — Verifiering & Observationer
description: Resultat av implementation och visuell verifiering av Dagens rutt-slicen (Story 1 + 3) med demoleverantören Erik. Inkluderar en date-matching-bugg som hittades och fixades under verifieringen.
category: research
status: active
last_updated: 2026-06-07
sections:
  - Vad byggdes
  - Verifieringsmetod
  - Screenshots
  - Observationer (hypotesen)
  - Bugg hittad & fixad (5 Whys)
  - Slice 2: Riktig körsträcka (2026-06-07)
  - Slice 3: Demo-seed — trovärdig kördag (2026-06-07)
  - Kvarstående luckor
tags:
  - route-planning
  - dagens-rutt
  - verifiering
  - provider
related:
  - docs/discovery/dagens-rutt-slice-2026-06.md
depends_on:
  - docs/discovery/dagens-rutt-slice-2026-06.md
---

# Dagens Rutt (MVP) — Verifiering & Observationer (2026-06)

> Resultat av sprinten "Dagens rutt (MVP)" — Story 1 (rutt på karta) + Story 3 (ingång från kalendern).
> Implementation klar, `check:all` 4/4 grön, visuellt verifierad desktop + mobil med demoleverantören Erik.

## Vad byggdes

| Del | Fil | Återanvänder |
|-----|-----|--------------|
| **API** `GET /api/provider/today-route?date=YYYY-MM-DD` | `src/app/api/provider/today-route/route.ts` | `withApiHandler`, prisma-read enligt due-for-service-precedent (ownership i WHERE) |
| **UI** `/provider/today` | `src/app/provider/today/page.tsx` | `RouteMapVisualization`, `routing.ts`, `calculateDistance` |
| **Ingång** "Dagens rutt"-knapp i kalendern | `src/app/provider/calendar/page.tsx` | — |

Innehåll i vyn: datumväljare (default idag), karta med numrerade stopp + rutt-linje + startposition, lista över stoppen (tid, kund, adress, tjänst), tomt-läge, samt stretch-målet **antal stopp + total körsträcka** (`~X km fågelväg` via Haversine).

**Designbeslut:** Routen följer due-for-service-precedenten (prisma-read i route med `providerId` från session i WHERE) i stället för att utöka den oanvända `findByProviderAndDateWithLocation` — den saknade `serviceType` + kundnamn, och att bredda den travel-time-DTO:n hade varit fel separation of concerns. Ingen ny tabell, ingen ny feature flag, ingen optimizer.

**Tester:** 9 route-tester (auth, 404, datumvalidering, mappning, sortering, range-query, tomt-läge, startLocation) + 6 sid-tester (titel, stopp-lista, karta, antal stopp, tomt-läge, offline). Alla gröna.

## Verifieringsmetod

Enligt demo-reglerna (demo-UX verifieras lokalt pre-merge): lokal demo-server `NEXT_PUBLIC_DEMO_MODE=true PORT=3100` mot lokal Supabase, inloggad som demoleverantören **Erik Järnfot** (`erik.jarnfot@demo.equinet.se`), driven via Playwright MCP.

Demo-seeden saknar kund-koordinater och har ~1 bokning/dag, så för att kunna verifiera kartans flerstopps-rutt seedades en **ephemeral, lokal-only** 3-stopps-dag (ej committad, ej i `seed-demo-provider.ts`) som städades bort efteråt.

## Screenshots

Sparade i [`dagens-rutt-screenshots/`](dagens-rutt-screenshots/):

- `01-calendar-desktop.png` — "Dagens rutt"-knappen i kalender-headern
- `02-route-desktop.png` — full rutt desktop (karta + 3 stopp + körsträcka)
- `03-route-mobile.png` — full rutt mobil (390px, vertikal layout)
- `04-datefix-0607-desktop.png` — efter date-fixen visar 2026-06-07 den riktiga seed-bokningen

## Observationer (hypotesen)

Hypotesen var att en kartvy ger mer värde än samma info i kalendern. Frågorna vi ville besvara:

- **Förstår användaren vyn direkt?** Ja — numrerade stopp på kartan matchar numrerad lista, tidsordning är tydlig, startposition utmärkt. Ingen förklaring krävs.
- **Hjälper den planera dagen?** Ja för flerstopps-dagar — den geografiska ordningen + körsträcka är det kalendern inte ger. För endags-/enstopps-dagar är värdet litet.
- **Saknas något uppenbart?** Två saker: (1) **kund-koordinater saknas i demo-seeden** → kartan blir tom utan ephemeral data; (2) demo-dagar har sällan ≥2 stopp, så "rutt"-känslan uteblir i standard-demon.
- **Karta vs lista?** Båda renderar och kompletterar varandra; kartan bär värdet, listan ger detaljerna (tid/adress/tjänst).

## Bugg hittad & fixad (5 Whys)

Under verifieringen visade 2026-06-07 "Inga bokningar idag" trots en pending bokning i DB.

1. Varför tomt? → Queryn returnerade 0 bokningar.
2. Varför 0? → `bookingDate: new Date("2026-06-07")` (UTC-midnatt) matchade inte den lagrade `2026-06-07T22:00:00Z`.
3. Varför 22:00Z? → Seed-/demobokningar lagras vid **svensk lokal midnatt**, inte UTC-midnatt.
4. Varför använde routen UTC-midnatt? → `new Date("YYYY-MM-DD")` tolkas som UTC.
5. **Rotorsak:** Exakt `bookingDate`-likhet är skört över en tidszonsgräns. Olika skapandevägar lagrar olika konvention (API: UTC-midnatt, seed: lokal midnatt).

**Fix:** Matcha hela lokala dagen via range `{ gte: startOfDay(target), lte: endOfDay(target) }` (date-fns, server-lokal tid) — samma konvention som `native/dashboard` "dagens bokningar". Regressionstest tillagt. Efter fixen visar 2026-06-07 korrekt sin bokning.

## Slice 2: Riktig körsträcka (2026-06-07)

**Mål:** visa faktisk körväg-sträcka i stället för fågelväg.

**Vad fanns redan:** `routing.ts` `getRoute()` returnerar redan `{ coordinates, distance (m), duration (s) }` från OSRM, men `RouteMapVisualization` använder `getRouteWithFallback()` som **slänger** distance — den verkliga sträckan hämtades alltså redan för kartan men användes inte. MVP:ns sammanfattning räknade fågelväg (Haversine).

**Vald approach (minimal):** Återanvänd `routing.ts` `getRoute` **klient-sida** i `/provider/today`: hämta riktig rutt för `[start → stopp i ordning → start]` och visa **"Körsträcka: X km · ~Y min"**. Vid fel/<2 punkter → fallback **"Uppskattad sträcka: ~Z km (fågelväg)"** via befintlig Haversine. Ingen API-ändring, ingen ändring i `/api/routing` eller `RouteMapVisualization`, ingen ny tabell/flagga.

> Alternativet "API returnerar `routeDistanceKm`" valdes bort: det hade krävt att duplicera OSRM-logik server-side (bryter "duplicera aldrig") eller refaktorera den delade `/api/routing`-endpointen (regressionsrisk mot route-planning) — båda scope-växt. `routing.ts` exponerar redan sträckan klient-sida.

**Tester (3 nya, alla gröna):** faktisk routing-distance används när tillgänglig; fallback till Haversine när routing kastar; routing anropas med start + stopp + retur till start i rätt ordning. Plus att labeln skiljer "Körsträcka" från "Uppskattad sträcka (fågelväg)".

**Visuell sanity (demo Erik, 2026-06-09, 3-stopps ephemeral dag):** vyn visade **"Körsträcka: 76 km · ~100 min"** (riktig OSRM-väg) mot MVP:ns fågelväg-estimat ~54 km — skillnaden ~40 % är precis det leverantörsvärde slicen syftar till. Screenshot: `dagens-rutt-screenshots/05-real-distance-desktop.png`.

> Observation: date-range-fixen från slice 1 verifierades på köpet — en riktig seed-bokning lagrad vid lokal midnatt (2026-06-08T22:00Z = lokal 2026-06-09) dök korrekt upp på 2026-06-09.

**Risker (hanterade):** OSRM-fel → fallback (testat). Saknade koordinater/<2 stopp → fallback. Dubbel OSRM-call (kartan + sammanfattningen anropar `/api/routing` med samma path) — acceptabelt vid demo-volym, noteras som watch. Latency: icke-blockerande (estimat visas direkt, uppgraderas till körsträcka).

## Slice 3: Demo-seed — trovärdig kördag (2026-06-07)

**Mål:** ge demo-leverantören Erik en trovärdig kördag så Dagens rutt visar karta + riktig körsträcka i staging/demo.

**Ändring (endast seed-data, `scripts/seed-demo-provider.ts` — ingen produktlogik):**
- **Koordinater på alla 9 demo-kunder**: `address` + `latitude`/`longitude` (realistiska punkter i Örebro-regionen, inom Eriks 50 km-område). (`User` saknar `postalCode`-kolumn → gata + ort.)
- **3-stopps demodag**: flyttade två befintliga framtida bokningar till **dag 2** (där Lisa redan låg), så dagen får en sydlig kördag:
  - Lisa Andersson — Örebro (Hagvägen 8) — 08:00 — Helskoning
  - Peter Svensson — Kumla (Skolgatan 14) — 10:30 — Verkning
  - Johan Nilsson — Hallsberg (Stationsgatan 9) — 13:00 — Helskoning (manuell)
- Ingen ny bokning (count oförändrad, 18), ingen ny tabell/flagga. `--reset` rensar gamla bokningar/kunder och återskapar med koordinater.

**Demodag:** dag **2 efter seed-körning** (i lokal verifiering 2026-06-09). Öppna Dagens rutt → välj datum 2 dagar fram.

**Lokal verifiering (demo Erik, dag 2):** **"3 stopp · Körsträcka: 63 km · ~68 min"** (riktig OSRM-väg), karta visar 3 utspridda markörer Örebro → Kumla → Hallsberg + startposition. Screenshot: `dagens-rutt-screenshots/06-seed-3stop-local.png`.

> Staging-reset körs separat via det interaktiva helper-scriptet (`npm run db:seed:staging-demo:customer:safe`) — kan inte köras autonomt (frågar efter staging-DB-URL).

### ⚠️ Demo-proxy: kundkoordinat ≠ besöksplats

Kundens **hemkoordinat** används här som proxy för **besöksplatsen**. Det är en **medveten, temporär demo-förenkling** för att Dagens rutt ska kunna ritas — **inte** en korrekt domänmodell.

Korrekt framtida modell: en **stall-/besöksadress kopplad till hästen eller bokningen** (en kund kan ha hästar på olika stall; besöket sker där hästen står, inte nödvändigtvis på kundens hemadress). Detta hör hemma i **kommande Stall-epic/discovery**, inte i Dagens rutt-slicen. Denna PR ändrar därför avsiktligt **ingen produktlogik** — bara demo-seed.

## Kvarstående luckor (watch, ej i denna slice)

- ~~**Geokoda demo-kunder** i `seed-demo-provider.ts` + ge minst en dag ≥2 stopp~~ — **klart i slice 3** (2026-06-07).
- **Besöksplats-modell (Stall-epic)**: ersätt demo-proxyn (kundens hemkoordinat) med stall-/besöksadress kopplad till häst/bokning. Hör hemma i Stall-epic/discovery — se förbehållet ovan.
- ~~**Riktig körsträcka** (OSRM) i sammanfattningen i stället för Haversine-fågelväg~~ — **klart i slice 2** (2026-06-07).
- **Dubbel OSRM-call**: kartan (`getRouteWithFallback`) och sammanfattningen (`getRoute`) anropar `/api/routing` med samma path. Kan lyftas ut via callback från `RouteMapVisualization` så distansen återanvänds — men det rör en delad komponent, så lämnat utanför denna slice.
- Ruttoptimering är medvetet **utanför** denna slice.

> DoD uppfylld: Kalender → Dagens rutt fungerar, karta + lista + tomt-läge, desktop + mobil, inga nya tabeller/flaggor, `check:all` 4/4 grön, inga console errors från egen kod.
