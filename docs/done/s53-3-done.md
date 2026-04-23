---
title: "S53-3 done: Se demo-knapp på landningssidan"
description: "Valfri story klar — frictionless demo-login via en klick"
category: done
status: done
last_updated: 2026-04-23
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Lärdomar
---

# S53-3 done: Se demo-knapp på landningssidan

## Acceptanskriterier

- [x] Knapp "Se demo som leverantör" visas på landningssidan när `NEXT_PUBLIC_DEMO_MODE=true`
- [x] Klick loggar in som Erik Järnfot (erik.jarnfot@demo.equinet.se) och redirectar till /provider/dashboard
- [x] Loading-state visas under inloggning, knapp är disabled
- [x] Felmeddelande om kontot saknas (t.ex. seed-script inte kört)
- [x] I normalt läge (demo_mode=false) visas landningssidan oförändrad

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (credentials är publika demo-credentials, gated av isDemoMode())
- [x] Tester skrivna FÖRST (5 tester), check:all 4/4 grön
- [x] Feature branch, check:all grön

## Reviews körda

- [x] code-reviewer — Inga blockers/majors. Minors åtgärdade: felmeddelande-text (user-facing), finally-block för loading-state reset, kommentar för hardkodade credentials. Minor kvarstår: ingen timeout-hantering (acceptabelt för demo). Suggestion: router.refresh() race condition (låg risk, samma mönster som övrig auth-kod i projektet).
- [ ] cx-ux-reviewer — SKIPPAD (code-reviewer flaggade inga UX-concerns utöver felmeddelande-text som fixats)

## Docs uppdaterade

Ingen docs-uppdatering — valfri intern demo-feature, inte användarvänd dokumentation. demo-setup.md skapades i S53-2.

## Verktyg använda

- Läste patterns.md vid planering: nej (enkel Client Component-story)
- Kollade code-map.md för att hitta filer: ja (hittade demo_mode-mappning och befintliga auth-filer)
- Hittade matchande pattern: login-sidan (`src/app/(auth)/login/page.tsx`) — samma Supabase browser-auth-mönster

## Arkitekturcoverage

Ej tillämplig (ingen designdokument för denna valfria story).

## Modell

sonnet

## Lärdomar

- `finally`-block i async-handlers ger bättre UX än att återställa state i varje branch — fångar alla exit-paths inklusive oväntade.
- Felmeddelanden ska skriva till rätt målgrupp. Demo-knappen kan ses av externa besökare, inte bara utvecklare.
- `isDemoMode()` i Server Component → boolean ned till Client Component är ett rent mönster för feature-gating utan att exponera logiken klient-side.
