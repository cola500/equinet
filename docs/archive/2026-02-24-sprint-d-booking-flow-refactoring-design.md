# Sprint D: useBookingFlow Refactoring -- Design

> Approach B: Context provider + shared subcomponents

## Problem

1. **22-prop drilling**: `useBookingFlow` returnerar 23 värden som manuellt sprids via `bookingDialogProps` till `MobileBookingFlow` och `DesktopBookingDialog`
2. **~400 rader duplicerad markup**: Häst-select, recurring-settings, flexible-form och booking-summary är identiska i båda komponenterna
3. **MobileBookingFlow** (680 rader) och **DesktopBookingDialog** (585 rader) är för stora

## Design

### 1. BookingFlowContext

Ny context som exponerar hela `useBookingFlow`-resultatet + extra props (customerHorses, providerId, etc).

```
src/components/booking/BookingFlowContext.tsx
```

- `BookingFlowProvider` wraps Drawer/Dialog-området
- `useBookingFlowContext()` hook för subkomponenter
- Hooken `useBookingFlow` förblir oförändrad (302 rader, rimlig storlek)

### 2. Delade formulär-subkomponenter

Extrahera identisk markup till:

```
src/components/booking/HorseSelector.tsx        -- häst-select + manuell input (~80 rader)
src/components/booking/RecurringSection.tsx      -- recurring toggle + intervall/tillfällen (~60 rader)
src/components/booking/FlexibleBookingForm.tsx   -- flexibel bokning: datum, prioritet, etc (~90 rader)
src/components/booking/BookingSummaryCard.tsx    -- bekräftelse-sammanfattning (~70 rader)
```

Varje subkomponent använder `useBookingFlowContext()` direkt -- inga props.

### 3. Tunna wrappers

**MobileBookingFlow**: Drawer + step-navigation + layout. Renderar subkomponenter baserat på `step`.
**DesktopBookingDialog**: Dialog + showSummary toggle. Renderar subkomponenter i ett formulär.

### Förväntad effekt

| Fil | Före | Efter (uppskattat) |
|-----|------|---------------------|
| MobileBookingFlow | 680 rader | ~180 rader |
| DesktopBookingDialog | 585 rader | ~120 rader |
| providers/[id]/page.tsx | 22 props | ~3 props |
| useBookingFlow.ts | 302 rader | 302 rader (oförändrad) |
| Nya filer | 0 | 5 (~350 rader totalt) |
| **Netto** | **1567 rader** | **~950 rader (-40%)** |

### Filer som ändras

- `src/components/booking/BookingFlowContext.tsx` (NY)
- `src/components/booking/HorseSelector.tsx` (NY)
- `src/components/booking/RecurringSection.tsx` (NY)
- `src/components/booking/FlexibleBookingForm.tsx` (NY)
- `src/components/booking/BookingSummaryCard.tsx` (NY)
- `src/components/booking/MobileBookingFlow.tsx` (ÄNDRAS)
- `src/components/booking/DesktopBookingDialog.tsx` (ÄNDRAS)
- `src/app/providers/[id]/page.tsx` (ÄNDRAS -- minska bookingDialogProps)

### Risker

- **Befintliga tester**: `useBookingFlow.test.ts` testar hooken -- ska inte påverkas
- **E2E**: Bokningsflödet har E2E-tester -- kör efter refactoring
- **Ingen beteendeförändring**: Ren refactoring, all funktionalitet bevaras
