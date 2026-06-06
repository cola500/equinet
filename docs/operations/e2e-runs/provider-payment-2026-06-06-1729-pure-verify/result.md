# Provider E2E Payment — Verifiering av /pure-fixen (PR #361)

- **Datum/tid:** 2026-06-06 17:29 (CEST)
- **Körd av:** Claude / Playwright MCP
- **Miljö:** equinet-staging.johanlindengard.com (deploy `eslm1cj6z`, merge 6cf0d7a8, READY — verifierat via `vercel inspect`)
- **Payment-läge:** mock (PAYMENT_PROVIDER=mock, stripe_payments=true)
- **Syfte:** Verifiera att PR #361 (`@stripe/stripe-js/pure`) tar bort Stripe.js-laddningen i mock-läge.

## VERDIKT: ✅ Fixen fungerar

| Kontroll | Resultat |
|----------|----------|
| Deploy serverar /pure-koden | ✅ custom-domän → `eslm1cj6z` |
| js.stripe.com script-tag i DOM (`/customer/bookings`, mock) | ✅ **NEJ** (var JA före fixen) |
| Network-requests mot stripe | ✅ **0** |
| Console errors (hela flödet) | ✅ **0** (inga ERR_FAILED) |
| Browser-cache uteslutet | ✅ `browser_close` + färsk context |
| `window.Stripe` | ✅ undefined (aldrig laddat) |
| Mock-betalning | ✅ succeeded — booking `417ff2ef…` (Molly), invoice **EQ-202606-DOAAD9**, 1450 kr |
| js.stripe.com efter betalning | ✅ fortfarande EJ laddat (mock öppnar aldrig dialogen) |
| Kvitto | ✅ `GET /receipt` → 200 text/html, "KVITTO" + invoiceNumber |

## Jämförelse mot körning 1714 (före fix)

| | 1714 (PR #360, lazy call) | 1729 (PR #361, /pure) |
|--|---------------------------|------------------------|
| js.stripe.com på `/customer/bookings` | ❌ laddas (ERR_FAILED) | ✅ laddas inte |
| Console-fel | ❌ ERR_FAILED | ✅ 0 |

## Slutsats

Rotorsaken (Stripe.js laddas som **import-side-effect** av `@stripe/stripe-js`) är åtgärdad genom `@stripe/stripe-js/pure`. Mock-flödet laddar aldrig Stripe.js, mock-betalning och kvitto fungerar. Stripe test-mode-vägen är teoretiskt intakt: `loadStripe(key)` anropas fortfarande via lazy `getStripePromise()` när dialogen renderas (stripe-flöde med clientSecret), och `/pure` laddar då scriptet on-demand. `@stripe/react-stripe-js` (Elements) oförändrad.

## Artefakter
- `screenshots/pure-customer-bookings-no-stripe.png` — kundvyn utan Stripe.js
- `screenshots/pure-kvitto.png` — genererat kvitto
- `network-stripe.log`, `console-errors.log`

## Abort/Stopp
Inga abort-triggers. Domän staging, mock, ingen prod, ingen pk_live, inga 4xx/5xx.
