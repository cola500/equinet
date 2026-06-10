# Payment Dialog scroll-fix — verifiering

- Datum: 2026-06-06
- Miljö: equinet-staging.johanlindengard.com (deploy b63m8rfon, PR #364)
- Fix: max-h-[90vh] overflow-y-auto på betalnings-ResponsiveDialogContent (PaymentDialog.tsx)

## VERDIKT: ✅ PASS

### Före (bug, desktop 1358×749)
- Dialog-höjd 891px > viewport 749, max-height: none, overflow-y: visible, EJ scrollbar
- Betala-knapp y=755 (under fold), inView: false → gick bara att klicka via evaluate

### Efter (desktop 1358×749)
- Dialog-höjd 674px (=90vh), max-height 674px, overflow-y: auto, scrollbar (scrollHeight 889 > clientHeight 672)
- Dialogen ryms i viewporten (top 37, bottom 712)
- **Betala klickbar med vanligt browser_click (INGEN evaluate)** — exakt det som timeoutade före fixen
- Betalning succeeded (booking 203a120c, invoice EQ-202606-VP5KYK)
- Kvitto: GET /receipt → 200, KVITTO + invoiceNumber

### Mobil (iPhone 390×844, Drawer)
- Drawer-innehåll scrollbart (overflow-y-auto max-h-[85vh], scrollHeight 997 > clientHeight 650)
- Betala-knapp nåbar via scroll (längst ned). Mobil var redan funktionell — desktop-fix rörde den ej (Drawerns data-variant max-h har högre specificitet).

### Gates
- npm run typecheck ✅
- eslint ✅
- npm run build ✅ (PR-verifiering)

## Artefakter
screenshots/: uxbug-before-desktop, uxfix-after-desktop, uxfix-after-mobile
