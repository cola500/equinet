---
title: "S4-1 Produktionsdeploy + verifiering -- Done"
description: "Verifiering av att equinet-app.vercel.app kör senaste koden med fungerande kärnflöde"
category: plan
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S4-1 Produktionsdeploy + verifiering -- Done

## Acceptanskriterier

- [x] equinet-app.vercel.app visar senaste koden (v0.2.0, commit 21168b15)
- [x] Login fungerar (provider@example.com -> omdirigering till /provider/dashboard)
- [x] Kärnflödet (dashboard -> bokningar -> kunder -> tjänster) fungerar utan fel
- [x] `npm run migrate:status` visar inga pending migrationer (31 lokalt = 31 Supabase)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (validering, error handling)
- [x] N/A -- operations-story, inga nya tester
- [x] Docs uppdaterade (status.md)

## Verifieringsresultat

| Sida | Status | Detaljer |
|------|--------|----------|
| Login | OK | Email + lösenord -> redirect till dashboard |
| Dashboard | OK | Välkomstmeddelande, 9 förfrågningar, statistikgrafer, snabblänkar |
| Bokningar | OK | 9 bokningar med fullständiga detaljer, statusfilter |
| Kunder | OK | Tom lista med korrekt empty state |
| Tjänster | OK | 1 tjänst (Hovslagning Standard, 800 kr, 60 min) |
| Migrationer | OK | 31/31 synkade |

### Console errors

2 st 404-fel -- båda är feature flag-gated routes (`/api/routes/my-routes`, `/api/route-orders/available`). Förväntat beteende när route-flaggan är avaktiverad.

## Avvikelser

Inga avvikelser. Allt fungerar som förväntat.

## Lardomar

- **Playwright MCP for prod-verifiering**: Snabbt och effektivt att verifiera hela kärnflödet via Playwright MCP istället för manuell genomklickning. Accessibility snapshot ger detaljerad vy av vad som renderas utan att behöva screenshots.
- **Feature flag 404:or i console**: Routes som är feature flag-gated returnerar 404 som syns som console errors. Inte ett problem, men värt att notera att SWR-fetcher anropar dessa endpoints oavsett flaggstatus (klienten pollar alla endpoints).
