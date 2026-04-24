---
title: "Plan: S54-2 — Redigera bokningsdatum och tid (leverantör)"
description: "PATCH /api/provider/bookings/[id]/reschedule + ProviderRescheduleDialog + BookingDetailDialog-knapp"
category: plan
status: active
last_updated: 2026-04-24
sections:
  - Aktualitet verifierad
  - Filer som ändras/skapas
  - Approach
  - Risker
---

# Plan: S54-2 — Redigera bokningsdatum och tid (leverantör)

## Aktualitet verifierad

**Kommandon körda:** `find src/app/api/provider/bookings -type f`, grep efter "reschedule" i provider-routes
**Resultat:** Ingen befintlig `/api/provider/bookings/[id]/reschedule` route. Befintlig `/api/bookings/[id]/reschedule` är kund-only med `self_reschedule` feature flag.
**Beslut:** Fortsätt — problemet finns, ny route behövs.

## Filer som ändras/skapas

### Nya filer
- `src/app/api/provider/bookings/[id]/reschedule/route.ts` — PATCH-route
- `src/app/api/provider/bookings/[id]/reschedule/route.test.ts` — tester
- `src/components/calendar/ProviderRescheduleDialog.tsx` — UI-dialog

### Ändrade filer
- `src/infrastructure/persistence/booking/IBookingRepository.ts` — ny metod `providerRescheduleWithOverlapCheck`
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` — implementera ny metod
- `src/infrastructure/persistence/booking/MockBookingRepository.ts` — mock-implementation
- `src/components/calendar/BookingDetailDialog.tsx` — lägg till Redigera-knapp + prop
- `src/app/provider/calendar/page.tsx` — handleReschedule-funktion + prop till BookingDetailDialog

## Approach

### Steg 1: Repository (IBookingRepository + PrismaBookingRepository + MockBookingRepository)

Lägg till ny metod till `IBookingRepository`:
```typescript
providerRescheduleWithOverlapCheck(
  bookingId: string,
  providerId: string,
  data: {
    bookingDate: Date
    startTime: string
    endTime: string
  }
): Promise<BookingWithRelations | null>
```

Implementera i `PrismaBookingRepository`:
- Atomisk transaktion: overlap-check + update med `where: { id: bookingId, providerId }` (IDOR)
- Kasta `BOOKING_OVERLAP` om överlapp, returnera `null` om bokning ej hittad/unauthorized

Implementera i `MockBookingRepository`:
- Enkel mock-implementation för tester

### Steg 2: Route (TDD — tester FÖRE implementation)

`PATCH /api/provider/bookings/[id]/reschedule`:

```
1. Auth → requireProvider → get session.user.id
2. Get provider via ProviderRepository.findByUserId(userId)
3. Rate limit (booking-rate-limiter)
4. Parse JSON (try-catch → 400)
5. Zod validate { bookingDate: dateSchema, startTime: timeSchema }.strict()
6. prisma.booking.findUnique({ where: { id, providerId: provider.id } }) — IDOR + status
7. Check status ∈ { pending, confirmed } → 400 annars
8. prisma.service.findUnique({ where: { id: booking.serviceId }, select: { durationMinutes: true } })
9. TimeSlot.fromDuration(startTime, durationMinutes) → Result<TimeSlot, string>
10. bookingRepo.providerRescheduleWithOverlapCheck(id, provider.id, { bookingDate, startTime, endTime })
    → null = dubbelbokningskollision → 409
11. sendBookingRescheduleNotification(bookingId, oldDate, oldTime, false) — fire-and-forget
12. Return 200 { id, bookingDate, startTime, endTime }
```

### Steg 3: ProviderRescheduleDialog.tsx

Enkel dialog med:
- DatePicker (shadcn Calendar)
- Starttid-input (text, HH:MM)
- Computed sluttid visas (readonly)
- Varning vid invalid tidsformat
- Spara-knapp → PATCH-anrop

### Steg 4: BookingDetailDialog.tsx

Lägg till:
- Ny prop: `onReschedule?: (bookingId: string, bookingDate: string, startTime: string) => Promise<void>`
- "Redigera datum/tid"-knapp i action-sektionen (pending + confirmed)
- Lokal state: `showRescheduleDialog`

### Steg 5: calendar/page.tsx

Lägg till:
- `handleReschedule(bookingId, bookingDate, startTime)` — PATCH-anrop till ny route
- Koppla till `BookingDetailDialog` via `onReschedule` prop

## Risker

1. **`BookingWithRelations` i PrismaBookingRepository** — metoden behöver returnera full `BookingWithRelations`. Återanvänd `BookingMapper.toBookingWithRelations()` eller inline select.
2. **Kalender-komponent** — shadcn Calendar kan saknas, kontrollera om den är installerad.
3. **Dubbelt IDOR-check** — `prisma.booking.findUnique` + `providerRescheduleWithOverlapCheck` gör var sin WHERE på `providerId`. Det är intentionellt och bra (defense in depth).
