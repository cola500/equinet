---
title: "S37-2 Done: Query-param injection-fix (kundnamn/tjänst från API)"
description: "customerName och serviceName hämtas nu från autentiserat API istället för URL query-params"
category: plan
status: archived
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S37-2 Done: Query-param injection-fix

## Acceptanskriterier

- [x] Inga `useSearchParams()`-läsningar för kundnamn/tjänst i ThreadView
- [x] Data hämtas från API (customerName/serviceName i GET /api/bookings/[id]/messages-svar)
- [x] Felfallet (ogiltig booking) hanteras via 404 i loadBookingForMessaging
- [x] `npm run check:all` grön + (4165 tester)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod, error handling, ownership-check, ingen XSS/injection)
- [x] Tester skrivna FÖRST (RED: 2 nya assertions + 1 nytt fall-back-test), coverage grön

## Reviews körda

Kördes: security-reviewer

**Resultat:**
- Inga blockers
- Inga majors
- Minor 1: `userType`-cast saknar explicit guard (harmlös, fail-safe returnerar null -> 404)
- Minor 2: GET rate-limiting saknade try/catch för RateLimitServiceError — FIXAT i denna story
- Suggestion: withApiHandler-migration — noterad, ej i scope

## Docs uppdaterade

Ingen docs-uppdatering (säkerhetsfix av intern logik, inga synliga användarupplevelse-ändringar)

## Verktyg använda

- Läste patterns.md vid planering: nej (kände till messaging-domänen)
- Kollade code-map.md: nej (hittade filer via grep)
- Hittade matchande pattern: nej (direkt implementation av audit-fynd)

## Arkitekturcoverage

N/A — direkt fix av MAJOR-2 från S36-2-audit, inget designdokument.

## Modell

sonnet

## Lärdomar

Strategin att lägga customerName/serviceName i befintligt GET-svar (istället för ny endpoint) var rätt — ThreadView SWRar redan det endpointet, ingen extra nätverksförfrågan.

GET-routens rate-limiting saknade try/catch — fixades i samma story. Alltid dubbelkolla att nya GET-routes matchar POST-routens error handling-mönster.
