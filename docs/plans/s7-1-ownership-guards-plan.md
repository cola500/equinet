---
title: "S7-1: Ownership Guards -- Plan"
description: "Ersatt findById() med ownership-scoped metoder i alla karndomaners repositories"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Oversikt
  - Analys
  - Faser
  - Risker
  - Filer som andras
---

# S7-1: Ownership Guards -- Plan

## Översikt

Ersatt generiska `findById()` med ownership-scoped metoder i repositories.
Migrera routes fran manuella ownership-checks till atomiska WHERE-villkor.

## Analys

Utforskning av alla 7 karndoman-repositories visar:

| Repository | findById? | Auth-aware metoder? | Status |
|-----------|----------|--------------------|----|
| Booking | Ja (osaker) | Delvis (update/delete har auth) | BEHOVER FIXAS |
| Service | Ja (osaker) | Ja (findByIdForProvider) | OK, routes korrekt |
| Horse | Nej | Ja (findByIdForOwner) | OK |
| Provider | Ja (men publik OK) | Ja (findByIdForOwner) | OK |
| CustomerReview | Ja (osaker) | Nej | BEHOVER FIXAS |
| Follow | Nej (composite key) | N/A | SAKERT BY DESIGN |
| Subscription | Nej | update/delete saknar auth | BEHOVER FIXAS |

**Routes med manuell ownership-check (bor migreras):**
1. `/api/voice-log/confirm/route.ts` -- prisma.booking.findUnique + manuell check
2. `/api/provider/bookings/[id]/quick-note/route.ts` -- prisma.booking.findUnique + manuell check
3. `/api/reviews/route.ts` -- prisma.booking.findUnique + manuell check
4. `/api/customer-reviews/route.ts` -- prisma.booking.findUnique + manuell check

## Faser

### Fas 1: BookingRepository (TDD)

**RED**: Skriv tester for `findByIdForProvider(id, providerId)` och `findByIdForCustomer(id, customerId)`.
Testa att de returnerar null nar ownership inte matchar.

**GREEN**: Implementera i IBookingRepository + PrismaBookingRepository.
Använd `findFirst` med `where: { id, providerId }` (atomisk WHERE).
Markera `findById()` som `@deprecated`.

**REFACTOR**: Migrera anropare:
- `/api/voice-log/confirm/route.ts` -> använd `findByIdForProvider()`
- `/api/provider/bookings/[id]/quick-note/route.ts` -> använd `findByIdForProvider()`
- `/api/reviews/route.ts` -> använd `findByIdForCustomer()`
- `/api/customer-reviews/route.ts` -> använd `findByIdForProvider()`
- Uppdatera MockBookingRepository i tester

### Fas 2: CustomerReviewRepository + SubscriptionRepository (TDD)

**CustomerReviewRepository:**
- Lagg till `findByIdForProvider(id, providerId)` i interface + implementation
- Immutabel modell, sa inga update/delete-metoder behovs

**SubscriptionRepository:**
- Lagg till `updateWithAuth(id, data, providerId)` och `deleteWithAuth(id, providerId)`
- Dessa anropas bara fran Stripe webhooks idag, men skyddar mot framtida routes

### Fas 3: ESLint-regel

Lagg till `no-restricted-syntax` i `.eslintrc.json` som varnar vid:
- `prisma.booking.findUnique` i filer utanfor `src/infrastructure/`
- `prisma.booking.findFirst` i filer utanfor `src/infrastructure/`

### Fas 4: Dokumentation

Uppdatera code review-checklistan med:
- "Ny query pa karndoman? Använd repository med ownership i WHERE"
- "Direkt prisma.X.find* i route? Flytta till repository"

## Risker

1. **Tester med MockBookingRepository** -- maste uppdateras med nya metoder.
   Manga testfiler. Liten risk men mangden arbete kan vara storre an forvantat.
2. **Admin-routes** -- admin behover `findById()` utan ownership.
   Lösning: behall `findById()` som `@deprecated` med kommentar "admin only".
3. **Booking-receipt route** -- använder OR-villkor (provider ELLER customer).
   Lösning: separat `findByIdForReceipt(id, providerId?, customerId?)`.

## Filer som andras

**Repository-interfaces:**
- `src/infrastructure/persistence/booking/IBookingRepository.ts`
- `src/infrastructure/persistence/customer-review/ICustomerReviewRepository.ts`
- `src/infrastructure/persistence/subscription/ISubscriptionRepository.ts`

**Repository-implementationer:**
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts`
- `src/infrastructure/persistence/customer-review/CustomerReviewRepository.ts`
- `src/infrastructure/persistence/subscription/SubscriptionRepository.ts`

**Routes att migrera:**
- `src/app/api/voice-log/confirm/route.ts`
- `src/app/api/provider/bookings/[id]/quick-note/route.ts`
- `src/app/api/reviews/route.ts`
- `src/app/api/customer-reviews/route.ts`

**Tester att uppdatera:**
- Alla filer med MockBookingRepository
- Nya tester for findByIdForProvider/findByIdForCustomer

**Config:**
- `.eslintrc.json` (ny regel)
- `.claude/rules/code-review-checklist.md`
