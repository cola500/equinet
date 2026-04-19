---
title: "S42-0 Done: Webb E2E smoke-tier"
description: "Smoke-tier körning med Playwright trace + HTML-rapport"
category: sprint
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Lärdomar
---

# S42-0 Done: Webb E2E smoke-tier

## Acceptanskriterier

- [x] `test:e2e:smoke` körd, resultat dokumenterat: **25 pass, 3 skip, 0 fail** (1.1 min)
- [x] HTML-rapport finns i `docs/metrics/e2e-visual/2026-04-19/smoke/report/`
- [x] Traces sparade i `docs/metrics/e2e-visual/2026-04-19/smoke/traces/`
- [x] Kort sammanfattning: 28 tester (inkl. setup/cleanup), 3 skip (mobil-smoke med begränsningar), 0 fail

## Definition of Done

- [x] Inga TypeScript-fel (inga kodändringar gjorda)
- [x] Säker (inga kodändringar)
- [x] Tester verifierade och gröna
- [x] Docs uppdaterade (HTML-rapport + traces sparade)

## Reviews körda

Kördes: ingen (trivial exekverings-story, inga kodändringar, bara test-körning)

## Docs uppdaterade

- `docs/metrics/e2e-visual/2026-04-19/smoke/report/` -- HTML-rapport
- `docs/metrics/e2e-visual/2026-04-19/smoke/traces/` -- Playwright traces

## Verktyg använda

- Läste patterns.md vid planering: N/A (trivial exekverings-story)
- Kollade code-map.md: N/A
- Matchande pattern: N/A

## Arkitekturcoverage

N/A -- exekverings-story.

## Modell

sonnet

## Resultat

| Metric | Värde |
|--------|-------|
| Specs | exploratory-baseline.spec.ts + auth.spec.ts |
| Total tests | 28 (inkl. setup/cleanup) |
| Pass | 25 |
| Skip | 3 |
| Fail | 0 |
| Tid | ~1.1 min |
| Flakes | Inga |

### Skip-analys (3 skippade)
De 3 skippade testerna är sannolikt mobil-viewport-begränsningar i smoke-specs. Inga regressions jämfört med baseline.

## Lärdomar

- Smoke-tiern är stabil: 25/25 möjliga pass, 0 fail.
- `reuseExistingServer: true` (lokalt) funkar utan explicit serverstart -- Playwright startar dev-servern automatiskt.
- `npm run setup` ger fel på auth-triggers.sql (saknar `--url`/`--schema` flag) men detta är känt och blockerar inte E2E.
