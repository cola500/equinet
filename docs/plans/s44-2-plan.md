---
title: "S44-2 Plan: horses-CRUD coverage-gap + filter=upcoming-fix"
description: "Täpp två coverage-gap från S43-review: horses page.test.tsx (component) + filter=upcoming i due-for-service integration-test."
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Gap 1 — horses page.test.tsx
  - Gap 2 — filter=upcoming
  - Commit-strategi
---

# S44-2 Plan: horses-CRUD coverage-gap + filter=upcoming-fix

## Aktualitet verifierad

**Kommandon körda:** Läst `src/app/customer/horses/page.tsx`, `src/app/api/provider/due-for-service/route.integration.test.ts`, `src/app/api/provider/due-for-service/route.ts`, `src/domain/due-for-service/DueForServiceCalculator.ts`

**Resultat:**
- horses/page.tsx finns. Inga tester i `src/app/customer/horses/`. Gap verifierat.
- due-for-service integration-test har `filter=overdue` och `filter=all` men saknar `filter=upcoming`. Gap verifierat.
- `UPCOMING_THRESHOLD_DAYS = 14` — en häst med senaste service 50 dagar sedan + 8-veckorinterval (56 dagar) → daysUntilDue = 6 → `upcoming`.

**Beslut:** Fortsätt. Båda gap verifierade.

---

## Gap 1 — horses page.test.tsx (component-test)

**Fil:** `src/app/customer/horses/page.test.tsx`

**Mock-strategi:** vi.mock() för alla externa beroenden
- `@/hooks/useAuth` → `{ isLoading: false, isCustomer: true }`
- `@/hooks/useHorses` → `{ horses, isLoading, mutate }`
- `@/hooks/useDueForService` → `{ items: [] }`
- `next/navigation` → `{ useRouter: () => { push: vi.fn() } }`
- `@/components/layout/CustomerLayout` → passthrough
- `global.fetch` → `vi.fn()` för add/delete-operationer
- Testa INTE ImageUpload, HorseForm i detalj — mocka dem

**Tester att skriva (≥5):**
1. Renderar empty state när inga hästar
2. Renderar häst-lista när hästar finns
3. Delete-dialog öppnas när "Ta bort" klickas
4. Delete-dialog: confirm anropar DELETE /api/horses/[id]
5. Delete-dialog: cancel stänger dialogen utan fetch
6. Felhantering: fetch misslyckas vid delete → toast.error

**Verktyg:** `@testing-library/react` + `userEvent` (eller `fireEvent`)

---

## Gap 2 — filter=upcoming (integration-test-utökning)

**Fil:** `src/app/api/provider/due-for-service/route.integration.test.ts`

**Nytt hjälpfunktion:**
```typescript
function makeUpcomingBooking() {
  const fiftyDaysAgo = new Date()
  fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50)
  return {
    horseId: 'a0000000-0000-4000-a000-000000000011',
    serviceId: SERVICE_ID,
    bookingDate: fiftyDaysAgo,
    horse: { id: 'a0000000-0000-4000-a000-000000000011', name: 'Snöboll' },
    customer: { firstName: 'Test', lastName: 'Testsson' },
    service: { id: SERVICE_ID, name: 'Hovslagning Standard', recommendedIntervalWeeks: 8 },
  }
}
```

**Tester att lägga till:**
1. `filter=upcoming` returnerar bara upcoming-hästar (50 dagar sedan, 8 veckor = 6 dagar kvar)
2. `filter=upcoming` exkluderar overdue och ok

---

## Commit-strategi

1. Plan-commit (denna fil)
2. `fix(tests): S44-2 add filter=upcoming test to due-for-service integration`
3. `fix(tests): S44-2 add horses page.test.tsx (component test, 6 tester)`
4. Done-fil + sessionsfil
