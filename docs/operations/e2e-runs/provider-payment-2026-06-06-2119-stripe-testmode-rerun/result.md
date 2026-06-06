# Provider E2E Payment — Stripe test-mode OMKÖRNING (efter SW-fix)

- **Datum/tid:** 2026-06-06 21:19 (CEST)
- **Körd av:** Claude / Playwright MCP
- **Miljö:** equinet-staging.johanlindengard.com (deploy `4rr6eeet2`, merge `a26d5071` — SW-fix #362)
- **Payment-läge:** Stripe test-mode (sandbox `acct_1THNsECZlHYlebEc`)
- **SW verifierad:** `/sw.js` innehåller `stripe.network` (fixen deployad); SW `activated` + kontrollerar sidan

## VERDIKT: SW-fix ✅ effektiv — kort-E2E ⏸️ blockerad av Playwright-miljön (js.stripe.com onåbart där)

### SW-fixen fungerar (bevisat)
- Gamla felet **`FetchEvent.respondWith received an error: no-response :: js.stripe.com`** är **BORTA**. SW intercepterar inte längre Stripe.
- Direkt fetch-prob från sidan (går via SW NetworkOnly-passthrough):
  | Mål | Resultat |
  |-----|----------|
  | `api.stripe.com/v1` | ✅ **OK (nåddes)** |
  | `/api/feature-flags` (same-origin) | ✅ OK |
  | `js.stripe.com/dahlia/stripe.js` | ❌ **FAIL: TypeError "Failed to fetch"** |

`api.stripe.com` når igenom → passthrough-regeln funkar. Endast `js.stripe.com` failar.

### Kvarvarande blocker = Playwright-miljö (EJ app/SW)
- **Exakt error:** `GET https://js.stripe.com/dahlia/stripe.js => [FAILED] net::ERR_FAILED` + console `Error: Failed to load Stripe.js (chunk 5825-…js)`.
- `js.stripe.com` är **specifikt onåbart** från Playwright MCP-browsern (host-nivå nätverksblock i testsandboxen) — `api.stripe.com` och same-origin funkar, bara `js.stripe.com` failar.
- Följd: `window.Stripe` = undefined → Stripe Elements iframe renderas inte (0 iframes) → testkort `4242` kan inte matas in **i denna browser**.

### Analys (ingen ny fix — per instruktion)
Två separata orsaker har separerats:
1. **Service Worker** intercepterade js.stripe.com → fixat (#362), bevisat borta.
2. **Playwright MCP-browserns nätverk** når inte js.stripe.com (men når api.stripe.com) → miljöbegränsning, inte appen.

En **riktig webbläsare** (med js.stripe.com-åtkomst) bör nu rendera Elements korrekt tack vare SW-fixen — det går inte att verifiera i den sandboxade testbrowsern.

## Steg-status
| Steg | Resultat |
|------|----------|
| Domän staging, ej prod | ✅ |
| SW-fix deployad + aktiv | ✅ |
| SW intercepterar ej js.stripe.com längre | ✅ (no-response-felet borta) |
| api.stripe.com nåbart via SW | ✅ |
| js.stripe.com laddas i Playwright | ❌ (env-block, `Failed to fetch`) |
| Stripe Elements kortform | ❌ (renderas ej här) |
| 4242 → webhook → succeeded → kvitto | ⏸️ ej körbart i denna browser |

## Nästa steg
Verifiera i **riktig webbläsare** (Alt A): logga in som Lisa → betala en Genomförd Helskoning → `4242 4242 4242 4242`, `12/34`, CVC `123`. Med SW-fixen deployad bör Elements nu rendera. Säg till så bekräftar jag via API (succeeded + kvitto).

## Artefakter
`screenshots/rerun-elements-jsstripe-blocked.png`, `network-stripe.log`, `console-errors.log`. Inga secrets. Inga 404/500.
