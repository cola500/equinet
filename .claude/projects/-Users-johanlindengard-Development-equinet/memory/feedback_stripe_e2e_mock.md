---
name: Stripe E2E -- mocka, inte riktig iframe
description: Stripe rekommenderar officiellt att inte E2E-testa PaymentElement -- mocka istället
type: feedback
---

Stripe PaymentElement ska INTE E2E-testas med riktiga iframe-interaktioner.

**Why:** Stripe har security measures som förhindrar automatiserad testning av PaymentElement. Stripe Link visar dynamiska fält (e-post, telefon, namn) med interna fältnamn (search-linkEmail, linkMobilePhone, linkLegalName) som kan ändras utan förvarning. Resulterar i flaky tester.

**How to apply:** Verifiera att PaymentElement renderas (iframe laddas), inte att kort fylls i. Faktisk betalningslogik testas av unit/integration-tester (StripePaymentGateway.test.ts, route.integration.test.ts). Mock-E2E (payment.spec.ts) testar UI-flödet med instant success.

Källa: https://docs.stripe.com/automated-testing
