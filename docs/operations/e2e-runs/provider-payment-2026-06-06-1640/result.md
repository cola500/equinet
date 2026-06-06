# Provider E2E Payment — Körningsresultat

- **Datum/tid:** 2026-06-06 16:40 (CEST)
- **Körd av:** Claude / Playwright MCP (automatiserad)
- **Miljö:** equinet-staging.johanlindengard.com (staging, deploy verifierad READY)
- **Payment-läge:** mock (PAYMENT_PROVIDER=mock, FEATURE_STRIPE_PAYMENTS=true, stripe_payments=true)
- **Personor:** Lisa Andersson (kund), Erik Järnfot / Järnfots Hovslageri (leverantör)
- **bookingId:** 5cb2bcf6-719b-4540-81b4-77d8a8d8c221
- **Tjänst/häst/tid:** Helskoning (1450 kr) · Storm · torsdag 11 juni 2026 kl. 14:30
- **paymentId / invoiceNumber:** EQ-202606-V3ARFI (payment.status = succeeded)

## Preflight (F1–F8)

| # | Krav | Resultat |
|---|------|----------|
| F1 | Rätt miljö (staging, ej prod) | ✅ location.host = equinet-staging.johanlindengard.com |
| F2 | Mock-gateway aktiv | ✅ PAYMENT_PROVIDER=mock (env pull) |
| F3 | stripe_payments=true | ✅ /api/feature-flags |
| F4 | demo_mode=true | ✅ /api/feature-flags |
| F5 | Deploy READY | ✅ vercel ls (Production Ready) |
| F6 | Lisa loginbar | ✅ demo-knapp |
| F7 | Erik loginbar | ✅ demo-knapp |
| F8 | Inga riktiga betalningar | ✅ mock |

## Steg-resultat

| Steg | Pass/Fail | Notering |
|------|-----------|----------|
| S0 readiness | ✅ | F1–F5 gröna |
| S1 login Lisa | ✅ | demo-knapp → /hem |
| S2 hitta Erik | ✅ | /providers → Järnfots Hovslageri (d1c96d05-...) |
| S3 skapa bokning | ✅ | Helskoning/Storm/11 juni 14:30, skickad |
| S4 fånga bookingId | ✅ | 5cb2bcf6-... status pending (API 200) |
| S5 pending (kund) | ✅ | badge "Väntar på svar" |
| S6 login Erik | ✅ | demo-knapp → /provider/calendar |
| S7 väntande (leverantör) | ✅ | "Väntar (3)", bokningen listad |
| S8 acceptera | ✅ | status → confirmed (API) |
| S9 confirmed (leverantör) | ✅ | flik Bekräftade, badge "Bekräftad" |
| S10 markera genomförd | ✅ | status → completed (API) |
| S11 login Lisa | ✅ | demo-knapp → /hem |
| S12 completed (kund) | ✅ | badge "Genomförd" + "Betala 1450 kr" |
| S13 initiera betalning | ✅ | knapp "Betala 1450 kr" → notis "Betalning genomförd!" |
| S14 mock succeeded | ✅ | payment.status=succeeded, 1450 kr, invoice EQ-202606-V3ARFI |
| S15 kvitto | ✅ | GET /receipt → 200 text/html, "KVITTO" + invoiceNumber |
| S16 status båda håll | ✅ | kund: Genomförd+betald · leverantör: completed (API) |

## Observationer

- **UI-status:** svenska termer konsekvent hos båda (Väntar på svar / Bekräftad / Genomförd). Status-maskinen följd.
- **Notiser:** in-app-toast "Betalning genomförd!" hos kund. Leverantör fick väntande bokning direkt (Väntar-räknaren 2→3).
- **E-post:** N/A (DISABLE_EMAILS=true på staging) — ej testat, förväntat.
- **PaymentDialog i mock-läge:** **lyckades direkt utan kortinmatning.** Klick på "Betala 1450 kr" → mock-betalning succeeded serverside → toast. Den S13-risk som runbooken flaggade (Stripe Elements skulle kunna fastna) **realiserades inte** — flödet är icke-blockerande i mock.
- **Console/server errors:** Stripe.js (`js.stripe.com`) misslyckas ladda (ERR_FAILED) i Playwright-browsern men blockerade inte mock-betalningen. 401 på /api/auth/session vid utloggat läge är benignt. Inga 404/500 på payment/receipt. Se console-errors.log.

## Acceptanskriterier

- [x] Inga 404/500 (payment POST + receipt GET båda OK)
- [x] Inga riktiga Stripe-anrop (mock; ingen checkout.stripe.com-redirect, ingen pk_live)
- [x] Mock succeeded (payment.status = succeeded)
- [x] Receipt OK (200, KVITTO + invoiceNumber EQ-202606-V3ARFI)
- [x] Status korrekt hos båda

## Abort-kriterier

Inga triggade. Domän alltid staging, inga live/test-Stripe-UI öppnades, ingen prod-domän, inga okända 500, ingen auth-loop.

## Fynd / watch

- **Stripe.js ERR_FAILED:** Stripe-biblioteket laddas på kundsidor men failar i körmiljön. Påverkar inte mock men måste fungera för riktig Stripe test-mode (kortformulär). Sannolikt miljö/nätverk i Playwright-browsern — verifiera i vanlig webbläsare innan Stripe-test-mode-slicen.

## Nästa åtgärd

- E2E-värdeflödet är **bevisat på staging med mock-gateway**. Demoklart.
- Vid önskan om realistisk betalning: kör den separata Stripe test-mode-slicen (STRIPE_WEBHOOK_SECRET + webhook-registrering + verifiera Stripe.js laddar + testkort 4242).
