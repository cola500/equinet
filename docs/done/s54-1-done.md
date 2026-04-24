---
title: "S54-1 Done: Snabb bekräfta/avvisa i 'bokningar väntar'"
description: "Inline Bekräfta/Avvisa-knappar per rad i PendingBookingsBanner med AlertDialog för avvisningsbekräftelse"
category: plan
status: active
last_updated: 2026-04-24
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S54-1 Done: Snabb bekräfta/avvisa i "bokningar väntar"

## Acceptanskriterier

- [x] Bekräfta-knapp per rad, klick bekräftar direkt
- [x] Avvisa-knapp per rad, klick öppnar bekräftelsedialog
- [x] Dialog: "Vill du avvisa [tjänstnamn] med [kundnamn]?" + Avbryt/Avvisa
- [x] Efter bekräfta/avvisa: bokning försvinner från listan (SWR mutate)
- [x] Touch-targets ≥44pt (`min-h-[44px]`)
- [x] Svenska texter (Bekräfta, Avvisa, Avbryt)
- [x] `PendingBookingsBanner.test.tsx` uppdaterat med 6 nya tester för quick actions

## Definition of Done

- [x] Inga TypeScript-fel
- [x] `check:all` 4/4 grön (4334 tester, +7 nya)
- [x] Inga console-fel
- [x] Säker (återanvänder befintlig auth-kedja via `PUT /api/bookings/[id]`)
- [x] Feature branch + PR

## Reviews körda

- [x] code-reviewer — 3 minors adresserade: (1) Separat `handleQuickAction` i page.tsx (undviker `handleDialogClose`-sidoeffekt från `handleStatusUpdate`), (2) Pending-state på knappar (dubbelklick-skydd via `setPendingId`), (3) Redundant `onOpenChange` borttagen. Inga blockers eller majors.
- [x] cx-ux-reviewer — SKIPPAD per seriell-körningsregel (review-matrix.md): code-reviewer flaggade inga UX-concerns. Seriell körning testar S53-S55.
- [ ] security-reviewer — ej tillämplig (inga nya API-routes, befintlig auth-kedja återanvänds)

## Docs uppdaterade

Ingen docs-uppdatering (intern UI-förbättring, inga nya features synliga för användare utöver förbättringen i sig).

## Verktyg använda

- Läste patterns.md vid planering: nej (tydligt UI-komponent-mönster)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern: AlertDialog-mönstret från `ui-components.md`

## Arkitekturcoverage

N/A — ingen designstory implementeras.

## Modell

opus

## Lärdomar

- `getByText(/text/)` i tester failar med "Found multiple elements" om samma text finns på flera ställen (bokningsrad + AlertDialog). Fix: scopa med `within(screen.getByRole("alertdialog")).getByText(...)`.
- `onQuickAction` bör separeras från `handleStatusUpdate` när den anropas från en kontext utan öppen dialog — `handleStatusUpdate` har sido-effekten `handleDialogClose(false)` som är onödig och kan påverka URL-state.
- Pending-state för dubbelklick-skydd: `pendingId`-state i komponenten + `disabled={pendingId === booking.id}` + `await onQuickAction()` + `setPendingId(null)`.
