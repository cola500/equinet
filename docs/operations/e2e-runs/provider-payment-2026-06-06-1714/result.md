# Provider E2E Payment — Verifieringskörning (PR #360 fix)

- **Datum/tid:** 2026-06-06 17:14 (CEST)
- **Körd av:** Claude / Playwright MCP
- **Miljö:** equinet-staging.johanlindengard.com (deploy `qngx6wuar`, merge a8c7ccce, READY)
- **Payment-läge:** mock (PAYMENT_PROVIDER=mock, stripe_payments=true)
- **Syfte:** Verifiera att PR #360 tar bort js.stripe.com-laddning i mock-läge.

## VERDIKT: ❌ Fixen i PR #360 var OTILLRÄCKLIG

Stripe.js laddas **fortfarande** på `/customer/bookings` i mock-läge, även efter merge + deploy och i en **helt färsk browser-context utan cache**.

## Bevis

| Kontroll | Resultat |
|----------|----------|
| Deploy serverar ny kod | ✅ custom-domän → `qngx6wuar` (merge med fix, verifierat via `vercel inspect`) |
| Lazy-kod på origin/staging | ✅ `getStripePromise`/`stripePromiseCache` finns i `PaymentDialog.tsx` |
| js.stripe.com injicerat i DOM (mock, ingen dialog) | ❌ `<script src="https://js.stripe.com/dahlia/stripe.js">` finns |
| Console | ❌ `net::ERR_FAILED @ js.stripe.com/dahlia/stripe.js` (oförändrat från körning 1640) |
| Browser-cache uteslutet | ✅ `browser_close` + färsk context → samma resultat |

## Rotorsak (5 Whys)

1. Varför laddas js.stripe.com? → `<script>` injiceras vid sidladdning.
2. Varför injiceras det i mock? → `loadStripe()`-laddningen triggas.
3. Varför, min lazy-fix kör ju bara `loadStripe()` när dialogen renderas? → Laddningen triggas **inte** av anropet utan av **importen**.
4. Varför av importen? → `import { loadStripe } from "@stripe/stripe-js"` laddar Stripe.js **som side-effect av modul-evalueringen** (dokumenterat Stripe-beteende). `/customer/bookings` importerar `PaymentDialog` statiskt → @stripe-modulen evalueras → script injiceras.
5. Varför hjälpte inte PR #360? → Fixen gjorde *anropet* lazy, men problemet är *importen*. Fel angreppspunkt.

**Grundorsak:** Att flytta `loadStripe()`-anropet räcker inte. Det är `import ... from "@stripe/stripe-js"` som laddar scriptet.

## Korrekt fix (förslag, EJ implementerad)

`@stripe/stripe-js` (v9.0.1, installerad) tillhandahåller subpathen **`@stripe/stripe-js/pure`** — verifierad finns (`node_modules/@stripe/stripe-js/pure/index.js`). `/pure` laddar **inte** Stripe.js vid import; scriptet laddas först när `loadStripe()` faktiskt anropas.

Minimal ändring i `PaymentDialog.tsx`:
```diff
- import { loadStripe } from "@stripe/stripe-js"
+ import { loadStripe } from "@stripe/stripe-js/pure"
```
Kombinerat med den redan mergade lazy-`getStripePromise()` (som bara anropas vid dialog-render) → Stripe.js laddas först i stripe-flödet med clientSecret. Mock laddar aldrig scriptet. `@stripe/react-stripe-js` (Elements) är oförändrad. Stripe test-mode intakt.

## Mock-payment / kvitto

Inte omkört i denna körning (fokus var fix-verifieringen, som föll). Mock-betalning + kvitto bevisades fungera i körning `provider-payment-2026-06-06-1640` och PR #360 rörde inte den koden — funktionellt oförändrat. Full omkörning görs efter att `/pure`-fixen är på plats.

## Abort/Stopp

Ingen abort-trigger (domän staging, ingen pk_live, ingen prod, inga 500). Stoppade E2E:n medvetet eftersom fixen behöver rework (kräver kodändring → utanför denna runs "inga kodändringar").

## Nästa åtgärd

1. Ny liten fix: byt import till `@stripe/stripe-js/pure` (1 rad) på feature branch.
2. Deploy till staging, kör om denna verifiering: 0 js.stripe.com-requests + 0 ERR_FAILED i mock.
3. Då även full mock-payment + kvitto-omkörning för komplett grönt.
