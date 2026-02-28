# Sprint D: Booking Flow Refactoring -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate 22-prop drilling and ~400 lines of duplicated markup between MobileBookingFlow and DesktopBookingDialog by introducing a context provider and shared subcomponents.

**Architecture:** Create `BookingFlowContext` to expose `useBookingFlow` state to all booking subcomponents without prop-drilling. Extract 4 shared form sections (HorseSelector, RecurringSection, FlexibleBookingForm, BookingSummaryCard) used identically by both Mobile and Desktop. The hook `useBookingFlow` (302 lines) stays unchanged.

**Tech Stack:** React Context, existing useBookingFlow hook, shadcn/ui components, useFeatureFlag

---

## Phase 1: Context Provider + Verification

### Task 1: Create BookingFlowContext

**Files:**
- Create: `src/components/booking/BookingFlowContext.tsx`

**Step 1: Create the context and provider**

```tsx
"use client"

import { createContext, useContext } from "react"
import type {
  BookingStep,
  BookingFormState,
  FlexibleFormState,
  CustomerHorse,
  SelectedService,
} from "@/hooks/useBookingFlow"

interface NearbyRoute {
  id: string
  dateFrom: string
  dateTo: string
}

export interface BookingFlowContextValue {
  // From useBookingFlow
  isOpen: boolean
  selectedService: SelectedService | null
  isFlexibleBooking: boolean
  step: BookingStep
  bookingForm: BookingFormState
  flexibleForm: FlexibleFormState
  canSubmit: boolean
  isRecurring: boolean
  intervalWeeks: number
  totalOccurrences: number

  // Setters
  setIsFlexibleBooking: (v: boolean) => void
  setStep: (step: BookingStep) => void
  setBookingForm: (fn: BookingFormState | ((prev: BookingFormState) => BookingFormState)) => void
  setFlexibleForm: (fn: FlexibleFormState | ((prev: FlexibleFormState) => FlexibleFormState)) => void
  setIsRecurring: (v: boolean) => void
  setIntervalWeeks: (v: number) => void
  setTotalOccurrences: (v: number) => void

  // Actions
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  onSubmit: (e?: React.FormEvent) => void
  onOpenChange: (open: boolean) => void

  // Extra context (not from hook)
  customerHorses: CustomerHorse[]
  providerId: string
  customerLocation?: { latitude: number; longitude: number }
  nearbyRoute: NearbyRoute | null
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null)

export function BookingFlowProvider({
  value,
  children,
}: {
  value: BookingFlowContextValue
  children: React.ReactNode
}) {
  return (
    <BookingFlowContext.Provider value={value}>
      {children}
    </BookingFlowContext.Provider>
  )
}

export function useBookingFlowContext() {
  const ctx = useContext(BookingFlowContext)
  if (!ctx) {
    throw new Error("useBookingFlowContext must be used within BookingFlowProvider")
  }
  return ctx
}
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `npm run test:run`
Expected: All ~2575 tests pass (no changes to existing code yet)

**Step 3: Commit**

```
feat: add BookingFlowContext for booking flow state
```

---

## Phase 2: Extract Shared Subcomponents

### Task 2: Extract BookingSummaryCard

**Files:**
- Create: `src/components/booking/BookingSummaryCard.tsx`

**Why this first:** Simplest component, used in both Mobile (confirm step) and Desktop (showSummary view). Identical markup in both.

**Step 1: Create BookingSummaryCard**

Extract the `<div className="rounded-lg border bg-gray-50 p-4 space-y-3">` block that appears identically in:
- `MobileBookingFlow.tsx:551-604` (confirm step)
- `DesktopBookingDialog.tsx:115-168` (summary view)

The component reads all state from context. No props needed.

```tsx
"use client"

import { useBookingFlowContext } from "./BookingFlowContext"

export function BookingSummaryCard() {
  const {
    selectedService,
    isFlexibleBooking,
    bookingForm,
    flexibleForm,
    customerHorses,
    isRecurring,
    intervalWeeks,
    totalOccurrences,
  } = useBookingFlowContext()

  if (!selectedService) return null

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      {/* Copy the exact JSX from MobileBookingFlow lines 552-604 */}
      {/* Service info */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">Tjänst</p>
        <p className="font-medium">{selectedService.name}</p>
        <p className="text-sm text-gray-600">{selectedService.price} kr ({selectedService.durationMinutes} min)</p>
      </div>
      {/* Date/time or period */}
      {/* Horse */}
      {/* Recurring */}
      {/* Notes */}
    </div>
  )
}
```

NOTE: Copy the EXACT markup from MobileBookingFlow lines 551-604. Both files have identical markup here.

**Step 2: Run tests**

Run: `npm run test:run`
Expected: All tests pass (new file, nothing wired up yet)

**Step 3: Commit**

```
refactor: extract BookingSummaryCard from booking flow
```

---

### Task 3: Extract HorseSelector

**Files:**
- Create: `src/components/booking/HorseSelector.tsx`

**Step 1: Create HorseSelector**

Extract the horse select + manual input block that appears in:
- `MobileBookingFlow.tsx:400-467` (selectHorse step)
- `DesktopBookingDialog.tsx:316-382` (form section)

Both are identical. The component reads `bookingForm`, `setBookingForm`, `customerHorses` from context.

Also include the "Övriga kommentarer" textarea (MobileBookingFlow:470-483, DesktopBookingDialog:384-397) since it always appears with the horse selector.

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookingFlowContext } from "./BookingFlowContext"

interface HorseSelectorProps {
  idSuffix?: string  // "-mobile" for mobile, "" for desktop -- for unique HTML ids
}

export function HorseSelector({ idSuffix = "" }: HorseSelectorProps) {
  const { bookingForm, setBookingForm, customerHorses } = useBookingFlowContext()
  // Copy exact horse select logic + notes textarea
  // ...
}
```

NOTE: The only difference between Mobile and Desktop horse selectors is the `id` suffix (`-mobile` vs none). Pass `idSuffix` prop.

**Step 2: Run tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 3: Commit**

```
refactor: extract HorseSelector from booking flow
```

---

### Task 4: Extract RecurringSection

**Files:**
- Create: `src/components/booking/RecurringSection.tsx`

**Step 1: Create RecurringSection**

Extract the recurring booking toggle + interval/occurrences selects from:
- `MobileBookingFlow.tsx:486-545`
- `DesktopBookingDialog.tsx:399-459`

Identical markup. Reads `isRecurring`, `setIsRecurring`, `intervalWeeks`, `setIntervalWeeks`, `totalOccurrences`, `setTotalOccurrences` from context. Also calls `useFeatureFlag("recurring_bookings")` internally.

```tsx
"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useBookingFlowContext } from "./BookingFlowContext"

interface RecurringSectionProps {
  idSuffix?: string
}

export function RecurringSection({ idSuffix = "" }: RecurringSectionProps) {
  const recurringEnabled = useFeatureFlag("recurring_bookings")
  const { isRecurring, setIsRecurring, intervalWeeks, setIntervalWeeks, totalOccurrences, setTotalOccurrences } = useBookingFlowContext()

  if (!recurringEnabled) return null

  // Copy exact markup
}
```

**Step 2: Run tests, commit**

```
refactor: extract RecurringSection from booking flow
```

---

### Task 5: Extract FlexibleBookingForm

**Files:**
- Create: `src/components/booking/FlexibleBookingForm.tsx`

**Step 1: Create FlexibleBookingForm**

Extract the flexible booking form fields from:
- `MobileBookingFlow.tsx:284-380`
- `DesktopBookingDialog.tsx:464-563`

Reads `flexibleForm`, `setFlexibleForm` from context.

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { format } from "date-fns"
import { useBookingFlowContext } from "./BookingFlowContext"

interface FlexibleBookingFormProps {
  idSuffix?: string
}

export function FlexibleBookingForm({ idSuffix = "" }: FlexibleBookingFormProps) {
  const { flexibleForm, setFlexibleForm } = useBookingFlowContext()
  // Copy exact form fields
}
```

**Step 2: Run tests, commit**

```
refactor: extract FlexibleBookingForm from booking flow
```

---

## Phase 3: Wire Up Components

### Task 6: Refactor MobileBookingFlow to use context + subcomponents

**Files:**
- Modify: `src/components/booking/MobileBookingFlow.tsx`

**Step 1: Replace props with context consumption**

1. Remove `MobileBookingFlowProps` interface (all 22+ props)
2. Change props to just `{ children?: React.ReactNode }` -- or actually keep NO props since it reads from context
3. Replace `useFeatureFlag` call (moved to RecurringSection)
4. Replace inline horse selector with `<HorseSelector idSuffix="-mobile" />`
5. Replace inline recurring section with `<RecurringSection idSuffix="-mobile" />`
6. Replace inline flexible form with `<FlexibleBookingForm idSuffix="-mobile" />`
7. Replace inline confirm summary with `<BookingSummaryCard />`
8. Read remaining state (`isOpen`, `step`, `selectedService`, etc.) from `useBookingFlowContext()`

The component should keep:
- Drawer container (Mobile-specific)
- Step navigation logic (handleNext, handleBack, canGoNext)
- Step indicator UI
- Step titles/descriptions
- Footer buttons
- Calendar rendering (step === "selectTime" && !isFlexibleBooking) since it uses `CustomerBookingCalendar` which is only in the time step

Expected result: ~180 lines (down from 680)

**Step 2: Run tests**

Run: `npm run test:run`
Expected: All existing tests pass. No behavior change.

**Step 3: Commit**

```
refactor: MobileBookingFlow uses context + shared subcomponents
```

---

### Task 7: Refactor DesktopBookingDialog to use context + subcomponents

**Files:**
- Modify: `src/components/booking/DesktopBookingDialog.tsx`

**Step 1: Replace props with context consumption**

Same pattern as Task 6:
1. Remove `DesktopBookingDialogProps` interface
2. Read state from `useBookingFlowContext()`
3. Replace inline sections with shared subcomponents
4. Keep: Dialog container, showSummary toggle, form layout, booking type toggle, calendar

Expected result: ~120 lines (down from 585)

**Step 2: Run tests, commit**

```
refactor: DesktopBookingDialog uses context + shared subcomponents
```

---

### Task 8: Wire up BookingFlowProvider in providers/[id]/page.tsx

**Files:**
- Modify: `src/app/providers/[id]/page.tsx:240-263,522-531`

**Step 1: Replace bookingDialogProps with BookingFlowProvider**

Before:
```tsx
const bookingDialogProps = {
  isOpen: booking.isOpen,
  onOpenChange: ...,
  // ... 22 more props
}
// ...
{isMobile ? (
  <MobileBookingFlow {...bookingDialogProps} step={booking.step} setStep={booking.setStep} />
) : (
  <DesktopBookingDialog {...bookingDialogProps} />
)}
```

After:
```tsx
const bookingFlowValue: BookingFlowContextValue = {
  ...booking,  // spread useBookingFlow return value
  onSlotSelect: booking.handleSlotSelect,
  onSubmit: booking.handleSubmitBooking,
  onOpenChange: (open: boolean) => { if (!open) booking.close() },
  customerHorses,
  providerId: provider.id,
  customerLocation: customerLocation || undefined,
  nearbyRoute,
}
// ...
<BookingFlowProvider value={bookingFlowValue}>
  {isMobile ? <MobileBookingFlow /> : <DesktopBookingDialog />}
</BookingFlowProvider>
```

**Step 2: Run ALL tests**

Run: `npm run test:run`
Expected: All ~2575 tests pass

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```
refactor: wire BookingFlowProvider in provider detail page
```

---

## Phase 4: Cleanup + Verification

### Task 9: Remove dead code and verify

**Step 1: Clean up unused imports/types in MobileBookingFlow and DesktopBookingDialog**

Remove any imports that are no longer needed (e.g., direct shadcn imports that moved to subcomponents).

**Step 2: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 5: Verify line counts**

Run: `wc -l` on all modified/created files. Compare to before:
- MobileBookingFlow: 680 -> ~180
- DesktopBookingDialog: 585 -> ~120
- providers/[id]/page.tsx: props section shrinks ~20 lines

**Step 6: Commit**

```
refactor: clean up unused imports after booking flow extraction
```

---

## E2E Verification

### Task 10: Run E2E tests

**Step 1: Run booking-related E2E tests**

Run: `npx playwright test e2e/booking.spec.ts e2e/flexible-booking.spec.ts e2e/recurring-bookings.spec.ts`
Expected: All pass (pure refactoring, no behavior change)

**Step 2: If any E2E fails, debug and fix**

Most likely cause: missing data-testid attributes that weren't carried over to subcomponents. Fix by ensuring all `data-testid` attributes from original components are preserved in extracted subcomponents.

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| 1 | Task 1 | Create BookingFlowContext |
| 2 | Tasks 2-5 | Extract 4 shared subcomponents |
| 3 | Tasks 6-8 | Wire up: refactor Mobile, Desktop, and parent page |
| 4 | Tasks 9-10 | Cleanup + E2E verification |

**Total: 10 tasks, 5 new files, 3 modified files**
