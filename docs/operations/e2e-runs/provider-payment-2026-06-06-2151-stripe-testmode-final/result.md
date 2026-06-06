# Provider E2E Payment — Stripe test-mode FULLT GRÖN

- **Datum/tid:** 2026-06-06 21:51→22:18 (CEST)
- **Körd av:** Claude / Playwright MCP + Stripe MCP
- **Miljö:** equinet-staging.johanlindengard.com (deploy `kvc8bu299`)
- **Konto:** Stripe sandbox `acct_1THNsECZlHYlebEc` (TEST), ingen live
- **bookingId:** fb2ec6a0-44ef-42bd-bf12-4838d4606f60 (Molly, Helskoning)
- **invoiceNumber:** EQ-202606-1QEBBB

## VERDIKT: ✅ PASS — hela Stripe test-mode-flödet verifierat end-to-end

| Steg | Resultat |
|------|----------|
| Domän staging, ej prod, ingen pk_live | ✅ |
| Stripe Elements renderar kortformulär | ✅ `window.Stripe` def., 7 iframes |
| js.stripe.com laddas via SW | ✅ `OK type=opaque` |
| Testkort `4242 4242 4242 4242` (12/34, 123, Sverige) | ✅ ifyllt i Elements |
| `confirmPayment` (klient) | ✅ utan fel, dialog stängdes |
| PaymentIntent succeeded hos Stripe | ✅ test-mode |
| Webhook `payment_intent.succeeded` processad | ✅ |
| `Payment.status=succeeded` | ✅ **inom ~3s** efter betalning |
| Kvitto | ✅ `GET /receipt` → 200, "KVITTO" + invoiceNumber EQ-202606-1QEBBB |
| Inga secrets i logg | ✅ |

## Tre fixar krävdes (alla nu deployade)
1. **SW NetworkOnly-passthrough för Stripe** (PR #362) — Service Workern intercepterade `js.stripe.com` (CacheFirst → "no-response").
2. **CSP `connect-src` += `js.stripe.com`** (PR #363) — SW:ns re-fetch av Stripe.js-scriptet styrs av `connect-src`, som saknade js.stripe.com → "Refused to connect".
3. **`SUBSCRIPTION_PROVIDER=stripe`** (config) — webhook-routen verifierar via `getSubscriptionGateway()`. Utan denna returnerades `MockSubscriptionGateway`, som (a) ej verifierar signatur och (b) returnerar `data: parsed.data` (Stripe-wrappern) ist.f. `parsed.data.object` → `event.data.id` undefined → betalning markerades aldrig succeeded.

## Återprocessning vs ny betalning (svar på frågan)
Den **befintliga** succeeded PaymentIntent:en (pi_3TfQGk…, från körningen före SUBSCRIPTION_PROVIDER-fixen) kunde **inte** återprocessas autonomt: dess webhook-event hade redan kvitterats med 200 (no-op pga mock-buggen), så Stripe retry:ar inte. Återsändning kräver Stripe dashboard/CLI ("Resend"), vilket inte var tillgängligt (MCP saknar webhook-ops, CLI ej funktionell). → **En ny betalning krävdes.** Den nya (efter fixen) processades korrekt på ~3s.

## Follow-up (loggat i status.md backlog, hardening före production readiness)
**Decouple Stripe webhook verification from subscription provider config.** `webhooks/stripe/route.ts` verifierar ALLA webhooks (även `payment_intent.*`) via subscription-gatewayen. Betalnings-webhooks ska inte bero på `SUBSCRIPTION_PROVIDER`. Rätt fix: egen Stripe-webhook-verifierare (eller via payment-gatewayen) som alltid använder Stripe när `STRIPE_WEBHOOK_SECRET` är satt — och MockSubscriptionGateway returnerar fel `data`-form (latent bugg).

## Artefakter
`screenshots/`: 01-elements-rendered, 02-card-filled, 03-after-pay, 04-kvitto-stripe. `network-stripe.log`, `console-errors.log`.
