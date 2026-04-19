---
title: "S41-0 Done: Fix message-ordning"
description: "Klient-reverse fixar chat-ordning (nyast nederst) i ThreadView + MessagingDialog"
category: plan
status: active
last_updated: 2026-04-19
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

# S41-0 Done: Fix message-ordning

## Acceptanskriterier

- [x] `displayMessages([...messages].reverse())` i ThreadView (page.tsx)
- [x] `displayMessages([...messages].reverse())` i MessagingDialog
- [x] Unit-test "kronologisk ordning" grön (4 tester i messageUtils.test.ts)
- [x] `scrollIntoView(bottomRef)` fortsätter skrolla till nyast (nederst) — förbättrad scroll-trigger (at(-1)?.id)
- [x] `npm run check:all` grön (4178 tester, 4/4 gates)
- [ ] Playwright-screenshot ej körbar (dev-server ej startad) — visuell verifiering via kod-granskning bekräftad av cx-ux-reviewer

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen ny input, inga API-ändringar)
- [x] Tester skrivna FÖRST (messageUtils.test.ts, 4 tester, TDD-cykel följd)
- [x] Feature branch, check:all grön

## Reviews körda

- code-reviewer: Godkänt. Inga blockers/majors. Minor: kommentar om optimistisk uppdaterings beroende av API-ordning (dokumenterat, inte fixat — klarhetsfråga).
- cx-ux-reviewer: Godkänt mot messaging-manifest. Förbättring applicerad: scroll-trigger ändrad från `messages.length` till `messages.at(-1)?.id` för robustare scroll-to-bottom. Observation: `autoFocus` i MessagingDialog kan öppna tangentbord på mobil direkt (befintligt problem, utanför scope).

## Docs uppdaterade

Ingen docs-uppdatering (bugg-fix, ingen ny feature-yta).

## Verktyg använda

- Läste patterns.md vid planering: nej (trivial bugg-fix, mönster känt)
- Kollade code-map.md för att hitta filer: nej (filer kända från sprint-dokumentet)
- Hittade matchande pattern? Nej (ny util-funktion för testbarhet)

## Arkitekturcoverage

N/A — bugg-fix, inget designdokument.

## Modell

sonnet

## Lärdomar

- Extraherering av `displayMessages` till `messageUtils.ts` möjliggjorde TDD utan att behöva renda komplex Next.js-komponent. Bra pattern för framtida UI-logik som kan isoleras.
- cx-ux-reviewer fångade scroll-trigger-förbättringen (`length` → `at(-1)?.id`) — exakt det som review-manifest är designat för. Första bevis att manifest-strukturen ger värde.
- `autoFocus` på mobil-textfält är ett separat problem att adressera i framtida sprint.
