---
title: "Spårbarhetsmatris – bokning och betalning"
description: "Kopplar affärsreglerna för bokning och betalning till beslut, scenarier, befintliga tester, implementation och kända avvikelser (pilot)"
category: architecture
status: draft
last_updated: 2026-10-23
tags: [specification, traceability, booking, payment, pilot]
depends_on:
  - docs/specifications/business-rules/booking-payment.md
  - docs/specifications/contracts/booking-payment-scenarios.md
sections:
  - Sammanfattning
  - BR-BOOK-001
  - BR-PAY-001
  - BR-PAY-002
  - BR-PAY-003
  - Granskningsgap
---

# Spårbarhetsmatris – bokning och betalning

Underlag: `main` vid `2ccfb541` (2026-10-23). Alla kod- och testuppgifter är
`[läst]`: granskade i källkod, inte körda i denna pilot. R2-uppgifter kommer
från sprintdokumentet och kördes 2026-10-16 i staging med Stripe test mode.

Kedja per regel: **beslut → regel → scenario → test → implementation**.

## Sammanfattning

| Regel | Beslut | Scenarier | Test som verifierar regeln | Implementation följer? |
|---|---|---|---|---|
| BR-BOOK-001 | Ja (2026-10-16, tidsbestämning 2026-10-23) | SC-BOOK-001–008 | Saknas | **Nej** – ingen tidskontroll |
| BR-PAY-001 | Ja (2026-10-16) | SC-PAY-001–006 | Delvis; ett test bekräftar det gamla beteendet | **Nej** – bekräftad bokning är betalningsbar |
| BR-PAY-002 | Ja (2026-10-23) | SC-PAY-010–013 | Delvis (enhetstest av anropet) | Ja, enligt kod och R2 |
| BR-PAY-003 | Ja (2026-10-16, formulering 2026-10-23) | SC-PAY-020–026 | Saknas för flera försök | **Nej** – nytt försök vid varje start |

## BR-BOOK-001

| Länk | Innehåll |
|---|---|
| Beslut | Retro 2026-10-16, Beslut 3–4; sprintdokumentet C3; Johans beslut 2026-10-23 om serverklocka, bokningens tidszon, mottagningstid vid offline-synk och tillåten markering exakt vid sluttid |
| Scenarier | SC-BOOK-001 – SC-BOOK-008 |
| Befintliga tester | `BookingStatus.test.ts` (tillåtna statusbyten, ingen tid). `BookingService.test.ts` › `updateStatus` › "should allow full lifecycle: pending -> confirmed -> completed" (ingen tidskontroll). `src/app/api/bookings/[id]/route.test.ts` (statusbyten via API, ingen tid). |
| Implementation | `BookingService.updateStatus` kontrollerar statusbyte och roll men inte tid. `BookingStatus` är en ren tillståndsmaskin. Vägar som sätter `completed`: `PUT /api/bookings/[id]` (webbkalendern) och `POST /api/voice-log/confirm`; båda går via `updateStatus`. Andra skrivningar av `completed` i koden gäller rutter och ruttstopp, inte bokningar. |
| Tidsdata | Bokningen har datum, start- och sluttid som text (`HH:mm`) samt fältet `timezone` (standard `Europe/Stockholm`). Fältet `timezone` läses inte av någon domänlogik i dag. |
| Avvikelse | Koden tillåter `completed` när som helst efter `confirmed`. Observerat i R2: cirka tre timmar före bokad tid. |
| Testlucka | Inga tester för före, vid eller efter sluttid, tidszon, sommartid eller offline-synk. |
| Planeringsnotis (C3) | `[tolkning]` Livscykeltestet ovan kan behöva en bokning med passerad sluttid när regeln införs. |
| Status | **Avviker** |

## BR-PAY-001

| Länk | Innehåll |
|---|---|
| Beslut | Sprintdokumentet, "Beslutade affärsregler" och C2 |
| Scenarier | SC-PAY-001 – SC-PAY-006 |
| Befintliga tester | `PaymentService.test.ts`: "returns INVALID_STATUS for pending booking", "… for cancelled booking", "succeeds for completed booking" och **"succeeds for confirmed booking" – bekräftar beteendet som strider mot regeln**. `payment/route.test.ts`: "returns 400 when booking status is not confirmed or completed". `payment/route.integration.test.ts`: "returns 400 when booking status is pending". |
| Implementation | `PaymentService.processPayment` tillåter `confirmed` och `completed`. `BookingCard.tsx` visar "Betala" för båda. Felmeddelandet i `mapPaymentErrorToStatus.ts` lyder "Bokningen måste vara bekräftad innan betalning kan göras". `PaymentWebhookService` kontrollerar inte bokningens status när en betalning slutförs. |
| Avvikelse | Bekräftad bokning är betalningsbar i API och UI. Observerat i R2 (skärmbild 02). `docs/architecture/booking-flow.md` beskriver det gamla beteendet. |
| Testlucka | Inget test för `no_show`. Inget test som avvisar `confirmed`. |
| Status | **Avviker** |

## BR-PAY-002

| Länk | Innehåll |
|---|---|
| Beslut | Johans beslut 2026-10-23: bara kunden, inga ombud. Tidigare säkerhetskrav i `booking-flow.md` |
| Scenarier | SC-PAY-010 – SC-PAY-013 |
| Befintliga tester | `PaymentService.test.ts` › "passes customerId to findBookingForPayment for ownership filtering" (verifierar att kund-ID skickas vidare, inte själva filtreringen). `payment/route.test.ts`: 401 utan inloggning, 404 när bokning saknas. |
| Implementation | Kund-ID tas från sessionen. `createPaymentService` hämtar bokningen med både boknings-ID och kund-ID i samma villkor; annan användares bokning ger "Bokning hittades inte" (404). |
| Avvikelse | Ingen känd. R2 verifierade att API:t avvisar annan kunds bokning. |
| Testlucka | Inget test mot riktig databas eller integrationstest som visar att kund B avvisas för kund A:s bokning; integrationstestet mockar databasen. Inget test för leverantör som betalar. Ombud (SC-PAY-013) har ingen egen funktion i dag och täcks av samma kontroll `[läst]`. |
| Status | **Följer** |

## BR-PAY-003

| Länk | Innehåll |
|---|---|
| Beslut | Sprintdokumentet, C1 i R4-beslutet; backloggraden "Stripe Idempotency Keys" ersatt av C1; teknikoberoende formulering godkänd av Johan 2026-10-23 |
| Scenarier | SC-PAY-020 – SC-PAY-026 |
| Befintliga tester | `PaymentService.test.ts` › "returns ALREADY_PAID when payment status is succeeded". `payment/route.integration.test.ts` › "returns 400 when booking already paid". `StripePaymentGateway.test.ts` › "creates a PaymentIntent with correct parameters" (utan idempotensnyckel). `PaymentWebhookService.test.ts`: dubbla webhook-händelser hanteras säkert. |
| Implementation | Varje betalningsstart skapar ett nytt försök hos Stripe utan idempotensnyckel. Bokningen har högst en betalningspost; den skrivs över med det senaste försökets ID. Tidigare försök annulleras inte. |
| Avvikelse | R2: tre försök för samma bokning, två fortfarande slutförbara. |
| Kodobservation 1 | `[läst]` Webhooken hittar betalningsposten via det **senaste** försökets ID. Slutförs ett äldre försök hittas ingen post: händelsen loggas som varning och bokningen registreras inte som betald, trots att kunden debiterats. Inte kört. Relevant för SC-PAY-026. |
| Kodobservation 2 | `[läst]` `[tolkning]` Webhooken behandlar `failed` som slutstatus. Om C1/C7 väljer att återanvända samma försök efter ett nekat kort, kan en senare lyckad betalning på samma försök ignoreras. Ska prövas när C1 planeras. |
| Testlucka | Inga tester för dubbelklick, samtidiga starter, ny start efter avbrott eller nekat kort, eller annullering av tidigare försök. |
| Status | **Avviker** |

## Granskningsgap

Följande har inte granskats i piloten och kan påverka matrisen:

- iOS-appen: om den kan markera bokningar som utförda eller starta betalning
  via andra vägar än de som listas ovan.
- Offline-synk: webbkalendern skickar statusbyten via offlinekön när
  `offline_mode` är på `[läst]`. Ett "utförd" som görs offline når alltså
  servern först vid synk, och servern ser då synktiden – inte när
  leverantören tryckte. Hur en avvisning vid synk visas för leverantören är
  inte granskat. Beslutet 2026-10-23 bekräftar att mottagningstiden gäller
  (SC-BOOK-008). iOS-appens motsvarighet är inte granskad.
- E2E-tester: `booking-flow.md` hänvisar till `e2e/payment.spec.ts`, som inte
  finns i repot.
- Inga tester kördes i piloten.
