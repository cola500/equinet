---
title: "S19-2: Slå ihop flexible-booking i booking.spec.ts"
description: "Flytta toggle-test till booking.spec.ts, ta bort flexible-booking.spec.ts"
category: plan
status: active
last_updated: 2026-04-10
sections:
  - Analys
  - Approach
  - Filer
  - Risker
---

# S19-2: Slå ihop flexible-booking i booking.spec.ts

## Analys

flexible-booking.spec.ts har 6 tester:
1. **Toggle fixed/flexible** -- unikt, värdefullt (flytta)
2. Create flex normal priority -- 3 st waitForTimeout, conditional skip (ta bort)
3. Create flex urgent priority -- 3 st waitForTimeout, conditional skip (ta bort)
4. Display both types -- 1 st waitForTimeout, conditional skip, console.log (ta bort)
5. Filter bookings -- 3 st waitForTimeout, console.log (ta bort)
6. Show route info -- 1 st waitForTimeout, conditional skip (ta bort)

Test 2-6 har för många waitForTimeout och conditional skips för att ge verkligt förtroende.
Seed-data-setup med seedRouteOrders + flexibel bokning behövs bara för test 4-6.

## Approach

1. Flytta toggle-testet (test 1) till booking.spec.ts som ny test
2. Uppdatera booking.spec.ts seed om nödvändigt (inga extra seeds behövs för toggle)
3. Ta bort flexible-booking.spec.ts
4. Ta bort oanvänd seedRouteOrders-import om den blir oanvänd

## Filer

- **Ändra:** `e2e/booking.spec.ts` (lägg till toggle-test)
- **Ta bort:** `e2e/flexible-booking.spec.ts`

## Risker

- Toggle-testet kräver provider med services -- redan säkerställt i booking.spec.ts
