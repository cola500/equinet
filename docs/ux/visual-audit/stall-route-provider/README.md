---
title: Visuell verifiering — stall i bokningar och Dagens rutt (leverantör)
description: Staging-verifiering av RLS-migrationen horse_provider_booking_read — leverantören ser stallnamn på egna bokningar och Dagens rutt använder stallets adress/koordinater.
category: visual-audit
status: active
last_updated: 2026-06-09
sections:
  - Sammanfattning
  - Testkontext
  - Vad som verifierades
  - Filer
  - Noterad avvikelse (separat)
---

# Visuell verifiering — stall i bokningar och Dagens rutt (leverantör)

## Sammanfattning

Verifiering av att RLS-migrationen `20260608120000_horse_provider_booking_read` på staging
gör att leverantören faktiskt kan se hästdata och stallinformation på sina egna bokningar.

**Resultat: GRÖNT.** Både hästdata och stallnamn resolvar nu via den RLS-scopade
Supabase-klienten, och Dagens rutt använder stallets adress och koordinater som besöksplats.

## Testkontext

- **Datum:** 2026-06-09
- **Miljö:** staging (`https://equinet-staging.johanlindengard.com`)
- **Supabase-projekt:** `zzdamokfeenencuggjjp` (staging)
- **Testkonto/persona:** demo-leverantör `erik.jarnfot@demo.equinet.se` ("Erik Järnfot"),
  inloggad via "Demo som leverantör" → routad via `/dashboard` → `/provider/calendar`
- **Appens datum vid testet:** tisdag 9 juni 2026

## Vad som verifierades

### A — Stallnamn i bokningslistan (`/provider/bookings`)

- 18 bokningar laddades; **alla** visar häst + ras (RLS på `Horse` fungerar).
- **"Stall: Stall Hagaby"** visas på Mollys bokningar (kund Lisa Andersson): 9 juni, 12 april,
  15 februari. Hästar utan tilldelat stall visar ingen stall-rad (dataförhållande, inte bugg).

### B — Stall som besöksplats i Dagens rutt (`/provider/today`)

- Dagens rutt (9 juni) visar 3 stopp.
- Stopp 1 (Lisa Andersson / Molly) visar **"Stall: Stall Hagaby"** med adress
  "Hagaby Gård 2, Örebro" och navigeringskoordinater `59.252,15.26`.
- Exakt matchning mot `Stable`-raden i DB (`address: Hagaby Gård 2`, `city: Örebro`,
  `lat: 59.252`, `lng: 15.26`) — rutten använder stallets adress/koordinater, inte kundens.
- Stopp 2 & 3 (hästar utan stall) visar ingen stall-rad och använder kundadressen.

### Skillnad data / RLS / UI

- **RLS — löst.** Bokningslistan/Dagens rutt använder RLS-scopad klient med nästlad join
  `horse → stable`. Före migrationen blockerades `Horse`, så häst och stall resolvade till null.
  `Stable` har RLS avslaget, så när hästen blev läsbar följde stallet med.
- **Data — förväntat.** Endast Molly har `stableId` satt i demo-seeden.
- **UI — separat avvikelse.** Se nedan.

## Filer

- `staging-booking-stall-hagaby.png` — bokningskort i `/provider/bookings` med "Stall: Stall Hagaby"
- `staging-dagens-rutt-stall.png` — Dagens rutt (`/provider/today`), stopp 1 med stall + adress + navigering

## Noterad avvikelse (separat)

Dagens rutt loggar ett konsolfel **React #418 (hydration mismatch)**, sannolikt från
datumsträngen "tisdag 9 juni" som renderas olika på server/klient. Påverkar inte
stall-visningen och är orelaterad till RLS-migrationen. Loggad som separat backlog-rad i
`docs/sprints/status.md` — fixas inte i samband med denna verifiering.
