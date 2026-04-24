---
title: "S54-1: Snabb bekräfta/avvisa i 'bokningar väntar'"
description: "Plan för inline-åtgärder direkt i PendingBookingsBanner utan navigering till detaljvy"
category: plan
status: active
last_updated: 2026-04-24
sections:
  - User Story
  - Påverkade filer
  - Approach
  - TDD-strategi
  - Risker
---

# S54-1: Snabb bekräfta/avvisa i "bokningar väntar"

## Aktualitet verifierad

**Kommandon körda:** Läst `PendingBookingsBanner.tsx` — inga inline-åtgärder finns idag.
**Resultat:** Problemet verifierat — komponenten saknar Bekräfta/Avvisa-knappar.
**Beslut:** Fortsätt

## User Story

Som leverantör vill jag kunna bekräfta eller avvisa en väntande bokning direkt i "bokningar väntar"-sektionen utan att klicka in i detaljvyn, så att jag snabbt kan hantera inkomna förfrågningar.

## Påverkade filer

- `src/components/calendar/PendingBookingsBanner.tsx` — lägg till Bekräfta/Avvisa-knappar + avvisnings-dialog
- `src/components/calendar/PendingBookingsBanner.test.tsx` — tester för quick actions
- `src/app/provider/calendar/page.tsx` — lägg till `handleQuickAction`-callback

Inga nya filer. Inga nya API-routes (återanvänder `PUT /api/bookings/[id]`).

## Approach

### Station 2 (RED)

Tester som skrivs FÖRE implementation:

1. **Bekräfta-knapp visas per väntande bokning** (expanderat läge)
2. **Avvisa-knapp visas per väntande bokning** (expanderat läge)
3. **Klick på Bekräfta → anropar onQuickAction("confirmed")** direkt
4. **Klick på Avvisa → öppnar bekräftelsedialog** (ej anropar direkt)
5. **Dialog: Avbryt → stänger dialog, inget anrop**
6. **Dialog: Avvisa → anropar onQuickAction("rejected")**
7. **Inga knappar visas om onQuickAction ej skickas** (bakåtkompatibelt)

### Station 3 (GREEN)

`PendingBookingsBanner.tsx`:
- Ny prop: `onQuickAction?: (bookingId: string, action: "confirmed" | "rejected") => void`
- State: `[rejectingBooking, setRejectingBooking]` — håller bokningen som ska avvisas
- Per rad: `<Button size="sm">Bekräfta</Button>` och `<Button size="sm" variant="outline">Avvisa</Button>`
- AlertDialog (shadcn) för avvisningsbekräftelse — titel, text med tjänstnamn+kundnamn, Avbryt/Avvisa

`page.tsx`:
- Lägg till `handleQuickAction(bookingId, action)` som anropar `PUT /api/bookings/${bookingId}` med `{ status: action }`
- Kör `router.refresh()` eller SWR-revalidering efter lyckad åtgärd
- Skicka `onQuickAction={handleQuickAction}` till `PendingBookingsBanner`

## TDD-strategi

Enkel TDD (ej BDD dual-loop — detta är en UI-komponent utan ny affärslogik).

Tests i `PendingBookingsBanner.test.tsx` med `@testing-library/react`.

## Risker

- **Touch-targets på mobil:** Knappar i en trång lista — säkerställ minst 44pt höjd.
- **Dubbelklick:** Knappen bör disablas efter klick (pending-state) för att undvika dubbla anrop.
