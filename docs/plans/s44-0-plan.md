---
title: "S44-0 Plan: TA BORT-batch — radera 3 döda E2E-specs"
description: "Verifiera ersättar-täckning och radera announcements, exploratory-baseline, payment specs"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Per-spec verifiering
  - Commit-strategi
---

# S44-0 Plan: TA BORT-batch

## Aktualitet verifierad

**Kommandon körda:** `ls e2e/`, verifierat att alla 3 specs finns, läst ersättar-filer
**Resultat:** Alla 3 specs existerar. Integration-tester för payment verifierade (380r). Route-announcement-notification täcker notifieringsflöde. Exploratory-baseline har inbyggd coverage-mapping.
**Beslut:** Fortsätt

## Approach

Radera 3 specs som Discovery klassat som TA BORT. Verifiera ersättar-täckning per spec, notera gap, radera.

## Per-spec verifiering

### 1. payment.spec.ts (337 rader)
**Ersättare:** `src/app/api/bookings/[id]/payment/route.integration.test.ts` (182r) + `src/app/api/webhooks/stripe/route.integration.test.ts` (198r)
**Coverage verifierad:** Ja — integration-testerna täcker payment processing, 404, 400, webhook succeeded/failed, dedup
**Gap:** Stripe iframe UI-interaktion saknas — men detta är medvetet (Stripe E2E fundamentalt brutet via iframe-sandbox, feedback från S35+)
**Beslut:** RADERA

### 2. exploratory-baseline.spec.ts (302 rader)
**Ersättare:** provider.spec.ts, admin.spec.ts, calendar.spec.ts (per filens egna coverage-mapping)
**Coverage verifierad:** Filens egna kommentarer kartlägger täckning mot andra specs
**Gap:**
- 1.14.2 (admin system page feature flags-lista) — inte i admin.spec.ts
- 1.2.4 (dashboard stat card navigation) — oklart täckt, låg prioritet
- Smoke tests (pages load) — täcks implicit av alla andra specs
**Beslut:** RADERA. Backlog-rad för 1.14.2-gap.

### 3. announcements.spec.ts (456 rader)
**Ersättare:** route-announcement-notification.spec.ts (notifieringar), booking.spec.ts, provider.spec.ts
**Coverage verifierad:** route-announcement-notification täcker notification-flödet. Booking och provider täcker respektive flöden.
**Gap:**
- Skapa annons-formulär UI (skapande via /provider/announcements/new) — inte täckt
- Confirm booking på annons UI — inte täckt
- Discovery noterade "50% skip" vilket innebär instabil spec
**Beslut:** RADERA. Announs-management API täcks av integration-tester (se route-announcement-notification). UI-kritiska flöden dokumenteras som backlog-gap.

## Commit-strategi

En commit per spec-radering:
1. `git rm e2e/payment.spec.ts` + `npm run check:all`
2. `git rm e2e/exploratory-baseline.spec.ts` + `npm run check:all`
3. `git rm e2e/announcements.spec.ts` + `npm run check:all`
4. Skapa `docs/metrics/testpyramid/removed-2026-04-19.md` med gap-rapport
5. Skapa done-fil + uppdatera sessionsfil
