---
title: "BDD Dual-Loop täckningsaudit"
description: "Stickprov på integrationstesternas täckning för kärndomänernas API-routes"
category: research
status: active
last_updated: 2026-04-25
tags: [testing, bdd, integration-tests, coverage]
sections:
  - Metod
  - Resultat
  - Röda luckor
  - Mönstret
  - Nästa steg
---

# BDD Dual-Loop täckningsaudit

**Datum:** 2026-04-25  
**Genomfört av:** Tech lead (teateranalyssession)

## Metod

Stickprov på kärndomänernas API-routes. Sökte efter `.integration.test.ts`-filer per domän och jämförde mot antalet `route.ts`-filer.

**Totalt:** 18 integrationstester på 181 routes (10%).

## Resultat

### Grönt — integration finns

| Domän / Route | Integration |
|---------------|-------------|
| `POST /api/auth/register` | ✓ |
| `POST /api/auth/forgot-password` | ✓ |
| `POST /api/auth/reset-password` | ✓ |
| `POST /api/webhooks/stripe` | ✓ |
| `GET+POST /api/reviews` | ✓ |
| `GET+PATCH+DELETE /api/bookings/[id]` | ✓ |
| `POST /api/bookings/[id]/payment` | ✓ |
| `GET+POST /api/group-bookings` | ✓ |
| `GET /api/provider/customers` | ✓ |
| `GET+POST /api/provider/customers/[id]/notes` | ✓ |
| `POST /api/provider/customers/[id]/invite` | ✓ |
| `GET /api/provider/customers/[id]/insights` | ✓ |
| `GET /api/provider/due-for-service` | ✓ |
| `GET /api/customer/due-for-service` | ✓ |
| `GET+POST /api/routes` | ✓ |
| `GET+POST /api/provider/bookings/[id]/quick-note` | ✓ |
| `POST /api/provider/insights` | ✓ |
| `POST /api/email/unsubscribe` | ✓ |

### Röda luckor — kärndomäner utan integration

| Domän | Routes | Situation |
|-------|--------|-----------|
| **Horses** | 8 routes | Unit-testat, noll integration. Kärndomän (repository obligatoriskt) med ägarskapslogik. |
| **Booking-series** | 3 routes | Precis releasad (S61). Unit-testat, noll integration. Transaktionslogiken otestad via route→service-kedjan. |
| `POST /api/bookings` | 1 route | Viktigaste skapanderouten saknar integration. `[id]`-routen har det men inte CREATE. |
| `POST /api/group-bookings/join` | 1 route | Atomisk join med Serializable-transaktion (S59-4). Kritisk flöde utan integration. |

## Mönstret

Integrationstester finns primärt på "första routen" i en domän (LIST/CREATE GET). Saknas på sub-routes och specialoperationer — vilket är tvärtom mot vad som ger mest värde. JOIN, CANCEL och CREATE är de kritiska flödena.

Auth har bra täckning på kärncyklerna (register, forgot, reset) men saknar integration på `accept-invite`, `verify-email` och `native-session-exchange`.

## Nästa steg

Se backlog-rad: "BDD integrationstester — horses, booking-series, bookings POST, group-bookings join"

Prioriteringsordning om en sprint dedikeras:
1. `POST /api/bookings` (CREATE) — högst affärsvärde
2. `POST /api/group-bookings/join` — atomisk transaktion, kritisk korrekthet
3. `POST /api/booking-series` + `[id]/cancel` — nyligen releasad
4. Horses (minst 2 routes: `POST /api/horses` + `GET+PUT+DELETE /api/horses/[id]`)
