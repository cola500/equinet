# Plan: B2 Självservice-ombokning -- Fas 4-8

## Kontext

Fas 1-3 är klara:
- **Fas 1**: Schema + migration (rescheduleEnabled/windowHours/maxReschedules/requiresApproval på Provider, rescheduleCount på Booking, feature flag `self_reschedule`)
- **Fas 2**: `BookingService.rescheduleBooking()` + 15 tester
- **Fas 3**: `PATCH /api/bookings/[id]/reschedule` + 10 tester

Kvar: E-post, UI (kund-dialog + leverantörsinställningar), API-utökning, verifiering.

## Faser

### Fas 4: E-postmall + notifikation (TDD)

**4a. E-postmall** (`src/lib/email/templates.ts`)

Ny interface `BookingRescheduleData`:
```typescript
interface BookingRescheduleData {
  customerName: string
  serviceName: string
  businessName: string
  oldBookingDate: string
  oldStartTime: string
  newBookingDate: string
  newStartTime: string
  newEndTime: string
  bookingUrl: string
  requiresApproval: boolean
}
```

Ny funktion `bookingRescheduleEmail(data)` -> `{ html, text }`. Kopiera `bookingReminderEmail`-mönstret. Visa gamla/nya tider tydligt. Meddela om godkännande krävs.

**4b. Notifikationsfunktion** (`src/lib/email/notifications.ts`)

Ny funktion `sendBookingRescheduleNotification(bookingId, oldDate, oldStartTime, requiresApproval)`:
1. Hämta bokning med `select` (provider.user.email, customer namn/email, service namn, provider businessName)
2. Skicka e-post till kunden (bekräftelse/väntar på godkännande)
3. Skicka e-post till leverantören (info om ombokning)

**Tester**: 3-5 tester i `templates.test.ts` + `notifications.test.ts` (eller ny testfil).

**Filer**:
- `src/lib/email/templates.ts` (ändra)
- `src/lib/email/notifications.ts` (ändra)
- `src/lib/email/templates.test.ts` (ändra eller skapa)

### Fas 5: RescheduleDialog + kundvy (TDD)

**5a. Utöka Booking-interface** i `customer/bookings/page.tsx`:
```typescript
interface Booking {
  // ... befintliga fält
  rescheduleCount: number
  provider: {
    businessName: string
    rescheduleEnabled: boolean
    rescheduleWindowHours: number
    maxReschedules: number
    rescheduleRequiresApproval: boolean
    user: { firstName: string; lastName: string }
  }
}
```

**5b. RescheduleDialog** (`src/components/booking/RescheduleDialog.tsx`):
- Mobil: Drawer, Desktop: Dialog (använd `useIsMobile()`)
- Props: `booking: Booking`, `open: boolean`, `onOpenChange`, `onSuccess`
- State: `selectedDate`, `selectedTime`, `isSubmitting`
- Steg: Datum-picker (visar bokningens nuvarande datum) -> Tidväljare -> Bekräfta
- API-anrop: `PATCH /api/bookings/{id}/reschedule` med `{ bookingDate, startTime }`
- Visa varning om `requiresApproval` är true
- Error handling med toast

**5c. "Omboka"-knapp** i `customer/bookings/page.tsx`:
- Visas bredvid "Avboka"-knappen
- Villkor: `status === "pending" || status === "confirmed"` OCH `payment?.status !== "succeeded"` OCH `provider.rescheduleEnabled` OCH `rescheduleCount < provider.maxReschedules`
- State: `rescheduleBooking: Booking | null` (samma mönster som `reviewBooking`)

**Filer**:
- `src/components/booking/RescheduleDialog.tsx` (ny)
- `src/app/customer/bookings/page.tsx` (ändra)

### Fas 6: Leverantörsinställningar (TDD)

**6a. Provider profile API** (`src/app/api/provider/profile/route.ts`):
- Lägg till 4 fält i `providerProfileSchema`:
  - `rescheduleEnabled: z.boolean().optional()`
  - `rescheduleWindowHours: z.number().int().min(1).max(168).optional()`
  - `maxReschedules: z.number().int().min(1).max(10).optional()`
  - `rescheduleRequiresApproval: z.boolean().optional()`
- Lägg till i `select`-block i GET och PUT

**6b. Provider profile hook** (`src/hooks/useProviderProfile.ts`):
- Lägg till reschedule-fält i `ProviderProfileData`

**6c. Provider profile sida** (`src/app/provider/profile/page.tsx`):
- Nytt Card "Ombokningsinställningar" efter "Bokningsinställningar"
- Switch: "Tillåt ombokning" (rescheduleEnabled)
- Select/Input: Ombokningsfönster i timmar (rescheduleWindowHours): 12, 24, 48, 72, 168
- Select/Input: Max antal ombokningar (maxReschedules): 1-5
- Switch: "Kräv godkännande" (rescheduleRequiresApproval)
- Inline onCheckedChange-mönster (samma som acceptingNewCustomers)

**Tester**: Utöka `route.test.ts` med Zod-validering av reschedule-fält.

**Filer**:
- `src/app/api/provider/profile/route.ts` (ändra)
- `src/app/api/provider/profile/route.test.ts` (ändra)
- `src/hooks/useProviderProfile.ts` (ändra)
- `src/app/provider/profile/page.tsx` (ändra)

### Fas 7: GET /api/bookings returnerar reschedule-policy

**7a. PrismaBookingRepository** (`findByCustomerIdWithDetails`):
- Lägg till i provider-select:
  - `rescheduleEnabled: true`
  - `rescheduleWindowHours: true`
  - `maxReschedules: true`
  - `rescheduleRequiresApproval: true`

Notera: `rescheduleCount` läggs redan in (fas 1).

**Filer**:
- `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` (ändra)

### Fas 8: Verifiering

- `npm run test:run` -- alla tester gröna
- `npm run typecheck` -- inga TypeScript-fel
- Fixa eventuella problem

## Kvalitetsdimensioner

### API-routes
- PATCH /api/bookings/[id]/reschedule: redan klar (fas 3)
- PUT /api/provider/profile: utökas med 4 nya fält, .strict() redan på plats
- Auth: session-check redan finns, reschedule-fält = leverantörens egna inställningar

### Datamodell
- Inga nya migrations -- alla fält redan i schemat
- Uppdatera `select`-block i: provider/profile GET + PUT, findByCustomerIdWithDetails

### UI
- Mobil-först: useIsMobile() för RescheduleDialog
- Svenska strängar: "Omboka", "Välj nytt datum", "Välj ny tid", "Bekräfta ombokning", "Kräver godkännande", "Ombokningsinställningar", "Tillåt ombokning", "Ombokningsfönster", "Max antal ombokningar"
- Återanvändning: Calendar (shadcn), Switch, Card, Dialog/Drawer-pattern

## Verifiering
- Alla befintliga + nya tester gröna
- TypeScript-kompilering utan fel
- E-postmall genererar korrekt HTML/text
- Kund kan se och klicka "Omboka" -> välja datum/tid -> bekräfta
- Leverantör kan konfigurera ombokningsinställningar i profilen
