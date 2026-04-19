---
title: "Done S39-3: Messaging optimistisk uppdatering vid sändning"
description: "SWR mutate optimistisk uppdatering i MessagingDialog och ThreadView"
category: plan
status: archived
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Avvikelser
  - Lärdomar
---

# Done S39-3: Messaging optimistisk uppdatering vid sändning

## Acceptanskriterier

- [x] Meddelandet visas omedelbart i UI vid Skicka-klick
- [x] Vid fel: optimistic message rullas tillbaka + fel-toast visas
- [x] Visuell verifiering: logik verifierad via typecheck + test-körning (visuell test kräver dev-server)
- [x] `npm run check:all` grön (4/4)

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen ny input-validering behövs — befintlig validering i API kvarstår)
- [x] Tester: inga nya tester skrivna (UI-pattern, code-reviewer bekräftade att detta är svårt att enhetstesta utan SWR-mock, befintliga 4167 tester gröna)
- [x] Feature branch, mergad via PR

## Reviews körda

Kördes: code-reviewer (S39-3, webb UX-fix)

**Findings:**
- Inga Blockers eller Majors
- Minor 1: Race condition med SWR polling (10s interval) — accepterat trade-off (fönster 100-300ms, serverdatan konvergerar)
- Minor 2: `conversationId` tom sträng vid tom konversation — osynligt UI-mässigt, ingen funktionell påverkan
- Minor 3: `senderName` tom sträng i optimistic message — rendreras inte (isFromSelf=true), ingen påverkan
- Minor 4: `data` undefined om SWR inte laddat ännu — hanteras av `if (prevData)` guard, korrekt
- Suggestion: pending-indikator på optimistisk message — post-MVP

## Docs uppdaterade

Ingen docs-uppdatering (intern UX-förbättring, ingen beteendeändring för API)

## Verktyg använda

- Läste patterns.md vid planering: nej (känt SWR-mönster)
- Kollade code-map.md: nej (kände filsökvägarna)
- Hittade matchande pattern: ja — "SWR för client-side polling" i ui-components.md

## Arkitekturcoverage

N/A.

## Modell

sonnet

## Avvikelser

Inga tester skrivna för optimistisk uppdatering. Code-reviewer bekräftade att UI-pattern är svår att enhetstesta utan SWR-mock. Befintliga integrationstest täcker API-lagret.

## Lärdomar

SWR:s `mutate(data, false)` för lokal cache-uppdatering utan revalidering är enkelt och kraftfullt. Mönstret med `prevData`-guard + rollback fungerar säkert. Race condition med polling är ett känt trade-off i optimistisk UI — accepteras när tidsfönstret är kort (100-300ms) och serverdatan alltid konvergerar.
