---
title: "Spårbarhetsmatris – bokning och betalning"
description: "Kopplar affärsreglerna för bokning och betalning till beslut, scenarier, befintliga tester, implementation och kända avvikelser (pilot)"
category: architecture
status: draft
last_updated: 2026-10-24
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

**Uppdatering 2026-10-24 (vertikal slice C3 + C2):** BR-BOOK-001 och BR-PAY-001
är implementerade på branchen `feature/c3-c2-booking-completion-payment` enligt
[implementationskontraktet](../implementation/booking-completion-payment.md).
Testerna nedan är `[körd]` lokalt (Vitest, XCTest, Playwright). Status gäller
branchen tills den är mergad.

Kedja per regel: **beslut → regel → scenario → test → implementation**.

## Sammanfattning

| Regel | Beslut | Scenarier | Test som verifierar regeln | Implementation följer? |
|---|---|---|---|---|
| BR-BOOK-001 | Ja (2026-10-16, tidsbestämning 2026-10-23) | SC-BOOK-001–008 | Ja (domän, API, klienter, E2E) | Ja (branch, 2026-10-24) |
| BR-PAY-001 | Ja (2026-10-16) | SC-PAY-001–006 | Ja för SC-PAY-001–005; SC-PAY-006 obeslutat | Ja (branch, 2026-10-24) |
| BR-PAY-002 | Ja (2026-10-23) | SC-PAY-010–013 | Delvis (enhetstest av anropet) | Ja, enligt kod och R2 |
| BR-PAY-003 | Ja (2026-10-16, formulering 2026-10-23) | SC-PAY-020–026 | Saknas för flera försök | **Nej** – nytt försök vid varje start |

## BR-BOOK-001

| Länk | Innehåll |
|---|---|
| Beslut | Retro 2026-10-16, Beslut 3–4; sprintdokumentet C3; Johans beslut 2026-10-23 om serverklocka, bokningens tidszon, mottagningstid vid offline-synk och tillåten markering exakt vid sluttid; UX-beslut 1–4 godkända 2026-10-24 |
| Scenarier | SC-BOOK-001 – SC-BOOK-008 |
| Tester `[körd]` | `BookingTime.test.ts` (SC-BOOK-004–007, lagringsvarianter, ogiltig tidszon). `BookingService.test.ts` › "updateStatus – BR-BOOK-001" (SC-BOOK-001–007, konkurrens med ombokning, ägarskap före tidskontroll). `PrismaBookingRepository.test.ts` (villkorad `UPDATE`, ombokningens statusvillkor). `mapBookingErrorToStatus.test.ts`. `bookings/[id]/route.integration.test.ts` (SC-BOOK-001, -002, -008, 409). `voice-log/confirm/route.test.ts` och `useVoiceWorkLog.test.ts`. `sync-engine.test.ts` (SC-BOOK-008). `MarkCompletedButton.test.tsx`. iOS: `BookingCompletionRulesTests`, `PendingActionStoreTests`, `BookingsViewModelTests`, `CalendarViewModelTests`, `BookingsModelsTests`, `CalendarModelsTests`. E2E: `e2e/payment.spec.ts`, `e2e/offline-mutations.spec.ts` (seed flyttad till passerad tid). |
| Implementation | `BookingService.updateStatus` kontrollerar sluttiden med serverns klocka (`now`-beroende) i bokningens tidszon (`BookingTime.getBookingEndInstant`) och skriver `completed` med en villkorad `UPDATE` mot de kontrollerade värdena. Båda vägarna (`PUT /api/bookings/[id]`, `POST /api/voice-log/confirm`) går dit. Klienterna (webb, iOS) får `timezone` och inaktiverar knappen före sluttid som vägledning. |
| Avvikelse | Ingen känd mot regeln. Kvar: iOS-köns tysta kastning av 4xx vid senare synk (befintligt gap, nu ovanligt eftersom 4xx inte köas); iOS visar lokal text per statuskod i stället för serverns text. |
| Status | **Följer** (branch) |

## BR-PAY-001

| Länk | Innehåll |
|---|---|
| Beslut | Sprintdokumentet, "Beslutade affärsregler" och C2 |
| Scenarier | SC-PAY-001 – SC-PAY-006 |
| Tester `[körd]` | `PaymentService.test.ts` (SC-PAY-001–005; "succeeds for confirmed booking" ersatt av SC-PAY-003 som avvisar). `mapPaymentErrorToStatus.test.ts`. `payment/route.test.ts`. `payment/route.integration.test.ts` (SC-PAY-002, -003, -005). `BookingCard.test.tsx` (SC-PAY-001–003, -005). E2E: `e2e/payment.spec.ts`. |
| Implementation | `PaymentService.processPayment` tillåter bara `completed`. Felmeddelandet lyder "Bokningen kan betalas först när tjänsten är utförd.". `BookingCard.tsx` visar "Betala" bara för `completed` och "Betalning öppnas när besöket är genomfört" för `confirmed`. `PaymentWebhookService` kontrollerar fortfarande inte bokningens status när en betalning slutförs (utanför slicen, C1/Q-PAY-004). |
| Avvikelse | `docs/architecture/booking-flow.md` uppdaterad 2026-10-24. Öppna betalningsförsök skapade vid `confirmed` före C2 kan fortfarande slutföras hos Stripe (staging/sandbox), se C1. |
| Testlucka | SC-PAY-006 (Q-PAY-002). |
| Status | **Följer** (branch) |

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

- iOS-appen: granskad i slicen 2026-10-24. Den markerar utförd via
  `PUT /api/bookings/[id]` (lista, detalj, kalender, `PendingActionStore`) och
  har inget betalflöde.
- Offline-synk: webbkalendern skickar statusbyten via offlinekön när
  `offline_mode` är på `[läst]`. Ett "utförd" som görs offline når alltså
  servern först vid synk, och servern ser då synktiden – inte när
  leverantören tryckte. Hur en avvisning vid synk visas för leverantören är
  granskat i slicen: avvisningen blir en konflikt med serverns besked och
  "Försök igen" lyckas efter sluttiden (SC-BOOK-008). iOS köar bara
  transienta fel.
- E2E-tester: `e2e/payment.spec.ts` skapad i slicen 2026-10-24.
- Inga tester kördes i piloten; slicens tester är körda lokalt.
