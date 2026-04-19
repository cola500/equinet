---
title: "S44-1 Plan: Batch 2 — 5 specs till integration"
description: "SPIKE security-headers + migrera 4 E2E-specs till integration-tester. E2E: 26 → 22 specs."
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - SPIKE-resultat
  - Approach per spec
  - Mål-filer
  - Commit-strategi
---

# S44-1 Plan: Batch 2

## Aktualitet verifierad

**Kommandon körda:** `ls e2e/*.spec.ts`, läst alla 5 specs, läst API-routes och befintliga integration-tester
**Resultat:** Alla 5 specs existerar. Befintlig integration-test för group-bookings (294r). Inga integration-tester för customer-invite, provider-notes, routes.
**Beslut:** Fortsätt. 4 specs migreras, security-headers STANNA.

## SPIKE-resultat: security-headers.spec.ts

**Slutsats: STANNA.**

Security headers sätts i `next.config.ts` via `headers()`. NextRequest/NextResponse-mönstret applicerar INTE `next.config.ts` headers — de sätts av Next.js-serverns infrastruktur, inte av route-handlers. Alternativ (starta Next.js test-server) kräver komplex setup som ger fragila tester.

Beslut: security-headers.spec.ts klassas om från FLYTTA till STANNA. Specen förblir som E2E och ger unik värde: verifierar att headers faktiskt levereras av servern i sin helhet.

## Approach per spec

### 1. customer-invite.spec.ts (98r) → MIGRERAS

**API:** `POST /api/provider/customers/[customerId]/invite`
**Ny fil:** `src/app/api/provider/customers/[customerId]/invite/route.integration.test.ts`

**Tester att skriva:**
- 401 när ej inloggad
- 404 när feature flag `customer_invite` av
- 404 när kund inte finns i providers register (IDOR-check)
- 409 när kunden redan har aktivt konto (`isManualCustomer: false`)
- 400 när kunden har sentinel-email (`@ghost.equinet.se`)
- 200 happy path — token skapas, old token invalideras, email skickas (fire-and-forget)

**Mock-strategi:** auth, prisma (ProviderCustomer, User, Provider, CustomerInviteToken), rate-limit, feature-flags, email, logger

**Coverage-gap:** UI-flöde (knapptext ändras till "Inbjudan skickad") — acceptabel gap, UI-state testas ej på integration-nivå

### 2. group-bookings.spec.ts (220r) → MIGRERAS

**E2E-scope:** Provider-sidan för geo-filtrering av group booking requests (UI-interaktion)
**API:** `GET /api/group-bookings/available`
**Befintlig integration-test:** `src/app/api/group-bookings/route.integration.test.ts` (294r) — täcker POST + GET för `/api/group-bookings`
**Befintlig unit-test:** `src/app/api/group-bookings/available/route.test.ts` — unit-test med mocks

**Ny fil:** Utöka befintlig `route.integration.test.ts` med `/available`-integration-tester

**Tester att lägga till:**
- 404 när feature flag av
- 401 när ej inloggad
- 403 när kund försöker (bara leverantörer)
- 200 happy path — returnerar öppna requests

**Coverage-gap:** Geo-filtrering i UI (client-side) — acceptabel gap, det är UI-state

### 3. provider-notes.spec.ts (336r) → MIGRERAS

**API:** `GET` + `POST /api/provider/customers/[customerId]/notes`, `DELETE /api/provider/customers/[customerId]/notes/[noteId]`
**Ny fil:** `src/app/api/provider/customers/[customerId]/notes/route.integration.test.ts`

**Tester att skriva:**
- GET: 401, 403 (ingen kundrelation), 200 med anteckningslista
- POST: 401, 403, 400 (tom innehåll/för lång), 201 happy path
- DELETE: 401, 403, 404 (anteckning tillhör annan), 200 happy path

**Coverage-gap:** Inline-redigering i UI (customer registry), mobil-skip — acceptabel gap

### 4. route-planning.spec.ts (235r) → MIGRERAS

**API:** `GET /api/route-orders/available`, `POST /api/routes`, `GET /api/routes/my-routes`, `PATCH /api/routes/[id]/stops/[stopId]`
**Ny fil:** `src/app/api/routes/route.integration.test.ts`

**Tester att skriva:**
- POST routes: 401, 400 (valideringsfel), 201 happy path (skapar rutt med stopp)
- GET my-routes: 401, 200 happy path
- PATCH stop: 401, 404 (stop not found), 200 pending→in_progress, 200 in_progress→completed

**Coverage-gap:** UI-selektion av orders, geo-summering, ruttnamn-input — acceptabel gap (UI-state)

### 5. security-headers.spec.ts (100r) → STANNA

Se SPIKE-resultat ovan. Ingen migration — specen behålls som E2E.

## Mål-filer

| Ny fil | Typ |
|--------|-----|
| `src/app/api/provider/customers/[customerId]/invite/route.integration.test.ts` | Ny |
| `src/app/api/group-bookings/route.integration.test.ts` (utökas) | Utökning |
| `src/app/api/provider/customers/[customerId]/notes/route.integration.test.ts` | Ny |
| `src/app/api/routes/route.integration.test.ts` | Ny |

## Commit-strategi

En commit per migrerad spec (S43-2-mönster):
1. Plan-commit (denna fil)
2. `feat(tests): S44-1 migrate customer-invite.spec.ts → integration (N tests)`
3. `feat(tests): S44-1 migrate group-bookings.spec.ts → integration (N tests)`
4. `feat(tests): S44-1 migrate provider-notes.spec.ts → integration (N tests)`
5. `feat(tests): S44-1 migrate route-planning.spec.ts → integration (N tests)`
6. Batch-rapport + done-fil
