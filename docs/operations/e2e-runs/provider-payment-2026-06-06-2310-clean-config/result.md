# Stripe test-mode E2E — städad config (utan SUBSCRIPTION_PROVIDER)

- Datum: 2026-06-06 23:10 (CEST)
- Miljö: equinet-staging.johanlindengard.com (deploy pp7wc26ne)
- Config: PAYMENT_PROVIDER=stripe, STRIPE_WEBHOOK_SECRET satt, stripe_payments=true
  — **SUBSCRIPTION_PROVIDER BORTTAGEN** (workaround städad)
- Konto: Stripe sandbox (TEST), ingen live

## VERDIKT: ✅ PASS — betalning succeeded UTAN SUBSCRIPTION_PROVIDER

| Steg | Resultat |
|------|----------|
| Domän staging, ej prod | ✅ |
| Stripe Elements renderar | ✅ window.Stripe def., kortformulär |
| Testkort 4242 ifyllt | ✅ |
| Betala klickad med vanligt browser_click (ej evaluate) | ✅ (scroll-fix håller) |
| confirmPayment + dialog stängdes | ✅ |
| Webhook payment_intent.succeeded processad | ✅ UTAN SUBSCRIPTION_PROVIDER |
| Payment.status=succeeded | ✅ ~3s — booking c0b42515, invoice EQ-202606-MFJ14M |
| Kvitto | ✅ GET /receipt → 200, KVITTO + invoiceNumber |

## Slutsats
Den decouplade webhook-verifieraren (verifyStripeWebhook, PR #365) markerar betalningar
succeeded korrekt även när SUBSCRIPTION_PROVIDER inte är satt. Workarounden var alltså
genuint onödig — config-cleanup bekräftad end-to-end.

## Artefakter
screenshots/: clean-card-filled, clean-kvitto
