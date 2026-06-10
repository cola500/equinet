# Provider E2E Payment — Stripe test-mode (Slice C)

- **Datum/tid:** 2026-06-06 20:31 (CEST)
- **Körd av:** Claude / Playwright MCP + Stripe MCP
- **Miljö:** equinet-staging.johanlindengard.com (deploy `k4awyckz3`, `PAYMENT_PROVIDER=stripe`)
- **Stripe-konto:** sandbox `acct_1THNsECZlHYlebEc` (TEST), ingen live
- **bookingId:** fb2ec6a0-44ef-42bd-bf12-4838d4606f60 (Molly, Helskoning, completed)
- **paymentIntentId:** `pi_3TfP2MCZlHYlebEc0CaQVDWI`

## VERDIKT: ⏸️ DELVIS — initiering grön, kort-bekräftelse blockerad av miljö/verktyg

### Verifierat ✅
| Punkt | Resultat |
|------|----------|
| Domän staging, ej prod | ✅ |
| Kund kan **initiera** Stripe test-payment | ✅ Betala → `POST /payment` skapade PaymentIntent |
| PaymentIntent finns i sandbox (test-mode) | ✅ `pi_3TfP2M…`, dashboard `/test/payments/`, ingen live |
| Belopp server-styrt och korrekt | ✅ 145000 öre = 1450 SEK = booking-pris |
| Payment-rad skapad | ✅ status=`pending`, amount=1450 |
| `/pure`-fix i stripe-flödet | ✅ js.stripe.com laddas **on-demand** (när dialogen öppnas), ej vid sidladdning |
| Inga live-keys / pk_live / prod-domän | ✅ |

### Blockerat ❌ (miljö/verktyg — INTE app-bugg)
- **Stripe Elements kortformulär kan inte renderas i Playwright MCP-browsern:** `js.stripe.com/dahlia/stripe.js` → `net::ERR_FAILED` (scriptet är blockerat i denna sandboxade testbrowser, som i alla tidigare körningar). Därför kan testkort `4242` inte matas in här.
- **Stripe MCP `stripe_api_write`** exponerar inte PaymentIntent-confirm (operation ej tillgänglig).
- **Stripe CLI** ej funktionell i miljön.

→ Stegen **kort-bekräftelse → webhook `payment_intent.succeeded` → `Payment.status=succeeded` → kvitto** kunde inte slutföras autonomt.

## Hur flödet slutförs (kräver mänsklig/extern åtgärd)

**Alt A (rekommenderas — verifierar även "Elements UI fungerar"):** Öppna staging i en **riktig webbläsare**, logga in som Lisa, `/customer/bookings`, betala booking `fb2ec6a0` (Molly/Helskoning) → mata in `4242 4242 4242 4242`, utgång `12/34`, CVC `123` i Stripe Elements → bekräfta. Webhooken slutför → kvitto.

**Alt B (verifierar webhook-vägen, ej Elements UI):** Bekräfta den befintliga PaymentIntent:en server-side med testkort — `pi_3TfP2MCZlHYlebEc0CaQVDWI` + `pm_card_visa` (= 4242) — via fungerande Stripe CLI eller test-secret-key. Då fyrar `payment_intent.succeeded` → staging-webhook → succeeded → kvitto. Verifieras sedan via API.

## Observability
- `screenshots/stripe-elements-blocked.png`
- `network-stripe.log`, `console-errors.log`
- Inga secrets i loggar. Inga 404/500 (initiering svarade korrekt; PaymentIntent skapad).

## ROTORSAK (fastställd via användarens riktiga webbläsare)

**Offline Service Worker (Serwist) bryter Stripe Elements.** Console visade:
`FetchEvent.respondWith received an error: no-response :: js.stripe.com/dahlia/stripe.js`.

- `js.stripe.com/...stripe.js` matchar ingen `sameOrigin`-scopad custom-regel (`sw-matchers.ts`) → faller i `defaultCache` (Serwist `static-js`, CacheFirst).
- Cross-origin **opaque** `.js`-respons kan inte hanteras av CacheFirst → SW returnerar **"no-response"** → Stripe.js laddas aldrig → Elements-kortfält tomt (i ALLA browsers med SW aktiv, inkl. prod om offline_mode på).
- Samma bugg-klass som redan lösts för Supabase-bilder (`sw.ts:139-142`). Stripe saknas i passthrough.
- CSP är OK (deployad header tillåter js.stripe.com/api.stripe.com/frame-src). Inte CSP, inte tillägg, inte Playwright.

**Omtolkning:** Alla tidigare `js.stripe.com ERR_FAILED` (även i Playwright) var Service Workern, inte Playwright-nätverket. `/pure`-fixen maskerade buggen i mock (ingen Stripe.js-laddning = inget SW-fel); Slice C exponerade den.

## Föreslagen fix (nästa slice — ej implementerad)
`src/sw.ts`: prepend NetworkOnly-passthrough för Stripe-domäner före `defaultCache`:
```ts
import { ..., NetworkOnly, ... } from "serwist"
{ matcher: ({ url }) => url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com") || url.hostname.endsWith("stripe.network"),
  handler: new NetworkOnly() },
```

## Slutsats
Server-sidan av Stripe test-mode är **bevisad** (PaymentIntent skapas korrekt i sandbox, rätt belopp, test-mode). Den interaktiva kort-bekräftelsen + webhook→succeeded→kvitto är **blockerad av en äkta app-bugg**: offline-SW:n intercepterar js.stripe.com och failar ("no-response"). Detta måste fixas (SW NetworkOnly-passthrough för Stripe) innan Stripe Elements kan fungera i någon browser. Säkerhets-gaten (kod) var PASS separat. Slice C kan grönmarkeras först efter SW-fixen + omkörning.
