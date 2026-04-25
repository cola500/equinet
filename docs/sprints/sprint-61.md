---
title: "Sprint 61: Återkommande bokningar release-klar"
description: "Täpper de fem luckor teateranalysen hittade. DoD: ta bort recurring_bookings feature flag."
category: sprint
status: planned
last_updated: 2026-04-25
tags: [sprint, recurring-bookings, ux, transactions]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 61: Återkommande bokningar release-klar

## Sprint Overview

**Mål:** Täppa de fem luckor teateranalysen identifierade och släpp `recurring_bookings` utan feature flag.

**Källa:** Teateranalys 2026-04-25 — leverantör + kund i samspel med koden.

**Nuläge:** Serie-skapande och cancel fungerar för leverantören men saknar transaktionsskydd — halvt skapade/avbrutna serier är möjligt vid konflikt eller nätverksavbrott. Kunden ser ingen serie-vy alls: tre bokningar syns som tre separata poster utan koppling. Email-mallen finns men triggas aldrig.

**DoD:** `recurring_bookings` feature flag borttagen. Funktionen alltid aktiv.

| Story | Gap | Effort |
|-------|-----|--------|
| S61-1 | GAP 1 — Serie-skapande utan transaktion | 30 min |
| S61-2 | GAP 2 — Startdatum i det förflutna tillåts | 15 min |
| S61-3 | GAP 3 — Ingen kund-vy för seriebokningar | 90 min |
| S61-4 | GAP 4 — Cancel utan transaktion | 30 min |
| S61-5 | GAP 5 — Email-mall triggas aldrig | 30 min |
| S61-6 | DoD — Ta bort recurring_bookings feature flag | 15 min |

---

## Stories

### S61-1: Atomisk serie-skapande (GAP 1)

**Prioritet:** 1
**Effort:** 30 min
**Domän:** webb

**Problem:** `BookingSeriesService` skapar N bokningar sekventiellt. Vid `unique_booking_slot`-konflikt mitt i sekvensen kastas ett 500-fel — delar av serien är skapad, resten inte, och serien saknar sin `BookingSeries`-post. Ingen rollback.

**Fix:** Wrap hela skapandelogiken i `prisma.$transaction()` — `BookingSeries.create` + alla `Booking.create` i ett atomärt block. Om ett steg failar rullas allt tillbaka.

**OBS:** Sekventiell skapande med skippa-logik (hoppa över konflikterande datum) kan behöva lyftas ut ur transaktionen för datum-konfliktkollen och sedan köra inserts atomärt. Läs `BookingSeriesService` noggrant innan implementation.

**Filer:**
- `src/domain/booking/BookingSeriesService.ts` — wrap create-loop i `$transaction`

**Acceptanskriterier:**
- [ ] Om en bokning i serien inte kan skapas rullas hela serien tillbaka (inga halvfärdiga serier i DB)
- [ ] Test: simulera konflikt på bokning 3 av 5 — verifiera att 0 bokningar och 0 serier skapas

---

### S61-2: Validera att startdatum inte är i det förflutna (GAP 2)

**Prioritet:** 2
**Effort:** 15 min
**Domän:** webb

**Problem:** POST `/api/booking-series` accepterar startdatum i det förflutna utan felmeddelande. Systemet skapar bokningar bakåt i tiden.

**Fix:** Lägg till Zod-refinement i POST-routens schema: `startDate` måste vara >= idag (UTC). Returnera 400 med "Startdatum kan inte vara i det förflutna."

**Filer:**
- `src/app/api/booking-series/route.ts` — lägg till `.refine()` på startDate i Zod-schema

**Acceptanskriterier:**
- [ ] POST med `startDate` = igår returnerar 400
- [ ] POST med `startDate` = idag returnerar 201
- [ ] Test: täcker båda fallen

---

### S61-3: Kund-vy för seriebokningar (GAP 3)

**Prioritet:** 3
**Effort:** 90 min
**Domän:** webb

**Problem:** Kunden ser individuella bokningar utan koppling till varandra. Det finns ingen vy, komponent eller indikation att bokningarna tillhör en serie. `GET /api/booking-series/[id]` finns men inget UI konsumerar den.

**Fix:** Lägg till serie-indikation i kundens bokningslista:
1. I `/customer/bookings`: gruppera bokningar med samma `bookingSeriesId` och visa en "Del av serie"-badge med länk till serie-vyn
2. Skapa `/customer/booking-series/[id]` — en enkel sida som visar: tjänst, intervall, alla datum i serien med status per bokning, och en "Avbryt hela serien"-knapp

**Filer:**
- `src/app/customer/bookings/page.tsx` — badge + länk vid serie-bokningar
- `src/app/customer/booking-series/[id]/page.tsx` — ny sida (serie-detaljer + cancel)

**Acceptanskriterier:**
- [ ] Bokningar med `bookingSeriesId` visar "Del av serie (X av Y)" i listan
- [ ] Länk leder till serie-sidan med alla tillfällen och deras status
- [ ] "Avbryt hela serien"-knapp anropar POST `/api/booking-series/[id]/cancel` och visar bekräftelse
- [ ] Befintliga individuella bokningar (utan serie) ser exakt likadana ut som innan

---

### S61-4: Atomisk serie-cancel (GAP 4)

**Prioritet:** 4
**Effort:** 30 min
**Domän:** webb

**Problem:** `cancelSeries` uppdaterar framtida bokningar sekventiellt. Om requesten avbryts mitt i (nätverksfel, timeout) är delar av serien avbruten och resten aktiv — men `BookingSeries.status` sätts till `cancelled` oavsett.

**Fix:** Wrap cancel-logiken i `prisma.$transaction()`: uppdatera alla framtida bokningars status + serie-status i ett atomärt block.

**Filer:**
- `src/domain/booking/BookingSeriesService.ts` — wrap cancelSeries i `$transaction`

**Acceptanskriterier:**
- [ ] Om en bokning-uppdatering misslyckas rullas hela cancel tillbaka (serie förblir `active`, inga bokningar ändras)
- [ ] Test: simulera fel vid bokning 2 av 4 — verifiera att serie-status och alla bokningar är oförändrade

---

### S61-5: Trigga email-bekräftelse vid serie-skapande (GAP 5)

**Prioritet:** 5
**Effort:** 30 min
**Domän:** webb

**Problem:** `src/lib/email/templates/booking-series-created.ts` finns men anropas aldrig. Varken kund eller leverantör får mejl när en serie skapas.

**Fix:** Anropa email-mallen i `BookingSeriesService.createSeries()` efter lyckat skapande. Fire-and-forget (`.catch(logger.error)`) — mejl-fel ska inte blockera svar till klienten. Skicka till kundens mejl med serie-sammanfattning (intervall, datum, tjänst).

**Kontrollera:** Hur ser befintlig email-mall ut och vad behöver den för data? Anpassa om nödvändigt.

**Filer:**
- `src/domain/booking/BookingSeriesService.ts` — lägg till email-anrop efter `$transaction`
- `src/lib/email/templates/booking-series-created.ts` — verifiera/justera mall om nödvändigt

**Acceptanskriterier:**
- [ ] Email skickas till kunden efter lyckat serie-skapande
- [ ] Email-fel stoppar inte svar till klienten (fire-and-forget)
- [ ] Mail innehåller: tjänst, antal tillfällen, intervall, första datum

---

### S61-6: Ta bort recurring_bookings feature flag (DoD)

**Prioritet:** 6
**Effort:** 15 min
**Domän:** webb

**Fix:** Ta bort `recurring_bookings`-flaggan från alla platser:
- `src/lib/feature-flag-definitions.ts`
- `src/app/api/booking-series/route.ts`
- `src/app/api/booking-series/[id]/route.ts`
- `src/app/api/booking-series/[id]/cancel/route.ts`
- `src/components/booking/RecurringSection.tsx`
- `src/components/calendar/ManualBookingDialog.tsx`
- `src/app/provider/profile/page.tsx`

**Acceptanskriterier:**
- [ ] Sökning på `recurring_bookings` ger noll träffar i `src/`
- [ ] Återkommande-väljaren syns i manuell bokningsdialog utan feature flag-toggle
- [ ] `npm run check:all` grön

---

## Förväntat resultat

| Vad | Före | Efter |
|-----|------|-------|
| Halvt skapade serier | Möjligt vid konflikt | Omöjligt — atomisk transaktion |
| Startdatum i förflutna | Tillåts | 400-fel med tydligt meddelande |
| Kund-vy för serie | Finns inte | Sida med alla tillfällen + avbryt-knapp |
| Badge i bokningslistan | Ingen koppling synlig | "Del av serie (X av Y)" med länk |
| Halvt avbrutna serier | Möjligt vid nätverksavbrott | Omöjligt — atomisk transaktion |
| Email vid serie-skapande | Triggas aldrig | Skickas fire-and-forget till kund |
| Feature flag | På | Borttagen |
