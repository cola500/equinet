---
title: "S6-1: BDD integrationstest-audit"
description: "Plan för att audita och komplettera integrationstester i API routes"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Inventering
  - Prioriterade luckor
  - Approach
  - Risker
  - Filer som ändras/skapas
---

# S6-1: BDD integrationstest-audit -- Plan

## Bakgrund

Sprint 5 levererade Stripe-betalning men avvek från BDD dual-loop -- integrationstester
saknades för payment routes. Sprint 6 börjar med att audita resten av kodbasen.

## Inventering

Explore-agent har kartlagt alla 161 route-testfiler (1 775 testfall):

| Domän | Filer | Integration | Unit-only | Lucka? |
|-------|-------|-------------|-----------|--------|
| Booking | 21 | 11 | 10 | Ja -- group-bookings, booking CRUD |
| Payment | 2 | 1 | 1 | Ja -- minimal coverage |
| Auth | 10 | 1 | 9 | Ja -- nästan allt unit-only |
| Review | 8 | 7 | 1 | Nej -- bra täckning |
| Service | 8 | 6 | 2 | Nej -- OK |
| Customer | 28 | 20 | 8 | Mindre -- horses unit-only |
| Övriga | 84 | 54 | 30 | Blandat |

**Totalt: 100 integration (62%), 61 unit-only (38%)**

## Prioriterade luckor (topp 8)

Dessa routes har **bara unit-tester** och tillhör **kärndomäner**:

| # | Route | Varför prioriterad |
|---|-------|--------------------|
| 1 | `bookings/[id]/payment/route.ts` | Betalningsflöde -- kritiskt |
| 2 | `auth/register/route.ts` | Användarregistrering -- kärnflöde |
| 3 | `auth/native-login/route.ts` | iOS-inloggning -- kritiskt för app |
| 4 | `auth/forgot-password/route.ts` | Lösenordsåterställning |
| 5 | `auth/reset-password/route.ts` | Lösenordsåterställning del 2 |
| 6 | `bookings/[id]/route.ts` | Booking CRUD (GET/PATCH/DELETE) |
| 7 | `group-bookings/route.ts` | Gruppbokning skapande |
| 8 | `reviews/route.ts` | Review-listning |

**OBS:** `bookings/[id]/payment` har redan en `route.integration.test.ts` -- den behöver
utökas, inte skapas från scratch. Auth-domänen har störst gap (9/10 unit-only).

## Approach

### Fas 1: Inventering + plan (denna fil)
- Kartlägga alla routes, klassificera tester
- Prioritera luckor

### Fas 2: RED -- Skriv integrationstester (5-8 nya filer)
- Fokus: auth-routes (register, native-login, forgot/reset-password)
- Fokus: booking CRUD, group-bookings
- Varje test skapar NextRequest, anropar route handler, mockar bara DB (Prisma)
- Feature flag-test: "returns 404 when flag disabled" där relevant

### Fas 3: GREEN -- Verifiera att alla passerar
- Alla nya tester ska vara gröna direkt (vi testar befintlig kod)
- Fixa eventuella buggar som testerna avslöjar

### Fas 4: Dokumentation
- Uppdatera `.claude/rules/testing.md` med BDD dual-loop guide
- Tydlig skillnad: integration vs unit, när använda vad

## Risker

| Risk | Mitigation |
|------|-----------|
| Befintlig kod har buggar som testerna avslöjar | Bra! Fixa dem direkt. |
| Integrationstester kräver komplex setup | Återanvänd mock-patterns från befintliga integration-tester |
| Scope creep -- för många routes | Begränsa till 5-8 nya integrationstester |

## Filer som ändras/skapas

**Nya testfiler (5-8 st):**
- `src/app/api/auth/register/route.integration.test.ts`
- `src/app/api/auth/native-login/route.integration.test.ts`
- `src/app/api/auth/forgot-password/route.integration.test.ts`
- `src/app/api/auth/reset-password/route.integration.test.ts`
- `src/app/api/bookings/[id]/route.integration.test.ts`
- `src/app/api/group-bookings/route.integration.test.ts`
- (eventuellt: `reviews/route.integration.test.ts`, `auth/verify-email/route.integration.test.ts`)

**Befintliga filer som uppdateras:**
- `.claude/rules/testing.md` -- BDD dual-loop guide
- `docs/sprints/status.md` -- statusppdatering
