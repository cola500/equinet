---
title: "S27-3: Email templates refactoring"
description: "Bryt ut 1012-raders templates.ts till separata filer per template"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Bakgrund
  - Approach
  - Filer som skapas
  - Risker
---

# S27-3: Email templates refactoring

## Bakgrund

`src/lib/email/templates.ts` ar 1012 rader med 12 template-funktioner som inline HTML. Svart att underhalla.

## Approach

1. Skapa `src/lib/email/templates/` katalog
2. Skapa `base-styles.ts` med delade CSS-styles och `e` (escapeHtml) alias
3. Skapa en fil per template (12 filer), varje med sin interface + funktion
4. Ersatt `templates.ts` med barrel-fil som re-exporterar allt
5. Befintliga tester ska passera utan andringar

## Filer som skapas

- `src/lib/email/templates/base-styles.ts`
- `src/lib/email/templates/email-verification.ts`
- `src/lib/email/templates/password-reset.ts`
- `src/lib/email/templates/booking-confirmation.ts`
- `src/lib/email/templates/payment-confirmation.ts`
- `src/lib/email/templates/booking-status-change.ts`
- `src/lib/email/templates/rebooking-reminder.ts`
- `src/lib/email/templates/booking-reminder.ts`
- `src/lib/email/templates/booking-reschedule.ts`
- `src/lib/email/templates/booking-series-created.ts`
- `src/lib/email/templates/account-deletion.ts`
- `src/lib/email/templates/customer-invite.ts`
- `src/lib/email/templates/stable-invite.ts`

## Filer som andras

- `src/lib/email/templates.ts` -> barrel-fil (re-exports, < 20 rader)

## Risker

- Lag risk. Ren kodflyttning, inget beteende andras.
- Import-sokvagar i notifications.ts, email-service.ts och index.ts pekar pa `./templates` som fortfarande existerar som barrel.
