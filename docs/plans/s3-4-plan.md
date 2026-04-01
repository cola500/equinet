---
title: "S3-4: Seed-data för recensioner"
description: "Lägg till realistiska demo-recensioner i seed-demo.ts"
category: plan
status: active
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Approach
  - Filer som ändras
  - Risker
---

# S3-4: Seed-data för recensioner

## Bakgrund

Demo-seeden saknar recensioner (CustomerReview). Leverantören ska ha 3-4 recensioner
med varierande betyg för att demo:n ska se realistisk ut.

## Approach

1. Lägg till sektion 6.5 i `prisma/seed-demo.ts` (efter bokningar, före availability)
2. Skapa CustomerReview-poster kopplade till de completed-bokningar som redan seedas
3. Reset-funktionen behöver rensa recensioner innan bokningar (FK-constraint)

**Stationsflöde:** Green -> Verify -> Merge (mekanisk polish, inget TDD)

### Recensionsdata

| Kund | Bokning | Betyg | Kommentar |
|------|---------|-------|-----------|
| Anna Johansson | Hovslagning (-7d) | 5 | Proffsigt och lugnt |
| Johan Pettersson | Hälsokontroll (-14d) | 4 | Bra, men lite väntetid |
| Erik Svensson | Hovslagning (-21d) | 5 | Alltid lika pålitlig |

3 recensioner kopplade till 3 completed-bokningar. Betyg 4-5 (realistiskt för demo).

## Filer som ändras

- `prisma/seed-demo.ts` -- ny sektion + cleanup i resetDemoData

## Risker

- **Låg risk:** CustomerReview har `bookingId @unique` -- om seed körs utan reset kan det krocka. Hanteras med exists-check.
