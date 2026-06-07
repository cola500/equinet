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

## Kvarstående luckor (watch, ej i denna slice)

- **Geokoda demo-kunder** i `seed-demo-provider.ts` + ge minst en dag ≥2 stopp, annars är kartan tom/ointressant i standard-demon.
- **Häst-/stall-position som fallback** när kundadress saknar koordinater (i dag används kundposition; stopp utan koordinater listas men visas inte på kartan, med en amber-notis).
- **Riktig körsträcka** (OSRM) i sammanfattningen i stället för Haversine-fågelväg — kartan ritar redan OSRM-väg, men km-siffran är luftlinje.
- Ruttoptimering är medvetet **utanför** denna slice.

> DoD uppfylld: Kalender → Dagens rutt fungerar, karta + lista + tomt-läge, desktop + mobil, inga nya tabeller/flaggor, `check:all` 4/4 grön, inga console errors från egen kod.
</content>
