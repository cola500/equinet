---
title: "Sprint 54: Kalenderåtgärder (demo-feedback)"
description: "Inline bekräfta/avvisa i 'bokningar väntar' + redigera bokningsdatum/-tid. Demo-feedback 2026-04-24."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, demo, provider, calendar, booking]
sections:
  - Sprint Overview
  - Stories
  - Definition of Done
---

# Sprint 54: Kalenderåtgärder (demo-feedback)

## Sprint Overview

**Mål:** Implementera två UX-förbättringar från demo-feedback 2026-04-24.

1. Leverantören ska kunna bekräfta/avvisa bokningar direkt i "bokningar väntar"-sektionen utan att klicka in i detaljvyn.
2. Leverantören ska kunna redigera datum och tid på en bokning direkt från detaljpopupen i kalendern.

**Effort-mål:** ≤ 1 arbetsdag totalt.

---

## Stories

### S54-1: Snabb bekräfta/avvisa i "bokningar väntar"

**Prioritet:** 1
**Effort:** 2-3h
**Domän:** `src/components/calendar/PendingBookingsBanner.tsx` + `src/app/provider/calendar/page.tsx`

**Kontext:** `PendingBookingsBanner` visar pending bokningar men kräver klick till detaljvyn för att bekräfta/avvisa. Demo-feedback: för många steg för det vanligaste leverantörs-arbetet.

**Vad:**
- Lägg till Bekräfta/Avvisa-knappar per rad i PendingBookingsBanner (expanderat läge)
- Avvisning öppnar en AlertDialog: "Är du säker på att du vill avvisa [tjänst] med [kund]?" med Avbryt/Avvisa-knappar
- Vid bekräftelse/avvisning: anropa befintligt `PUT /api/bookings/[id]` (som redan hanterar status-uppdatering)
- Bokningen försvinner från väntar-listan efter lyckad åtgärd

**Teknisk approach:**
- `PendingBookingsBanner` får ny prop: `onQuickAction?: (bookingId: string, action: "confirmed" | "rejected") => void`
- Avvisnings-dialog hanteras internt i komponenten (lokal state)
- `page.tsx` implementerar `handleQuickAction` med samma PUT-anrop som `handleStatusUpdate`
- Inga nya API-routes behövs

**Acceptanskriterier:**
- [ ] Bekräfta-knapp per rad, klick bekräftar direkt (optimistisk UI-uppdatering)
- [ ] Avvisa-knapp per rad, klick öppnar bekräftelsedialog
- [ ] Dialog: "Vill du avvisa [tjänstnamn] med [kundnamn]?" + Avbryt/Avvisa
- [ ] Efter bekräfta/avvisa: bokning försvinner från listan (revalidering)
- [ ] Touch-targets ≥44pt (knappar på mobil)
- [ ] Svenska texter (Bekräfta, Avvisa, Avbryt)
- [ ] `PendingBookingsBanner.test.tsx` uppdaterat med test för quick actions

**Reviews:** code-reviewer (UI-komponent-ändring + kalender-page-ändring)

---

### S54-2: Redigera bokningsdatum och tid (leverantör)

**Prioritet:** 2
**Effort:** 4-5h
**Domän:**
- Ny: `src/app/api/provider/bookings/[id]/reschedule/route.ts` (+ test)
- Ny: `src/components/calendar/ProviderRescheduleDialog.tsx`
- Ändrad: `src/components/calendar/BookingDetailDialog.tsx`

**Kontext:** `BookingDetailDialog` visar bokningsdetaljer men saknar redigeringsmöjlighet. Det finns en `RescheduleDialog` för kund-sidan (`/api/bookings/[id]/reschedule`) men den är kund-only och kräver `self_reschedule`-feature flag. Leverantören behöver en enklare variant utan approval-flow.

**Vad:**
- Ny provider-reschedule-route: `PATCH /api/provider/bookings/[id]/reschedule`
  - Auth: kräver provider-session
  - IDOR: bokning måste tillhöra leverantörens providerId
  - Body: `{ bookingDate: string, startTime: string }` (endTime beräknas från service.durationMinutes)
  - Dubbelbokningsskydd via `BookingService.reschedule()` (återanvänd befintlig logik)
  - Notifiering till kund via `sendBookingRescheduleNotification`
- Ny `ProviderRescheduleDialog.tsx` (enkel variant):
  - Datumväljare (kalender) + tids-input
  - Visar ny sluttid (startTime + durationMinutes)
  - Varning om den nya tiden krockar med annan bokning
- `BookingDetailDialog` får nytt Redigera-knapp (synlig för pending + confirmed bokningar)

**Acceptanskriterier:**
- [ ] "Redigera datum/tid"-knapp visas i BookingDetailDialog för pending och confirmed bokningar
- [ ] Dialog visar datum-väljare och starttid-input
- [ ] Ny sluttid beräknas och visas automatiskt
- [ ] Vid spara: PATCH-anrop till `/api/provider/bookings/[id]/reschedule`
- [ ] IDOR-skydd: leverantör kan bara redigera sina egna bokningar
- [ ] Dubbelboknings-fel → tydligt felmeddelande på svenska
- [ ] Kund notifieras via e-post vid ombokning
- [ ] Route-test täcker: happy path, auth-krav, IDOR-skydd, dubbelbokningskollision

**Reviews:** code-reviewer + security-reviewer (ny API-route)

---

## Definition of Done (sprintnivå)

- [ ] S54-1 done: inline bekräfta/avvisa fungerar i demo-miljö
- [ ] S54-2 done: redigera datum/tid fungerar för provider
- [ ] `npm run check:all` 4/4 grön
- [ ] Visuell verifiering (Playwright MCP) av båda flödena
- [ ] Sprint-avslut via feature branch + PR

**Inte i scope:**
- Redigera tjänst, kund, häst eller pris på bokning
- Avvisnings-meddelande till kund (S54-1) — kan läggas till i Slice 2
- Kundvy av ombokning (kund kan se sin RescheduleDialog redan)
