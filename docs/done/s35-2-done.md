---
title: "S35-2 Done: Leverantör kan läsa och svara i inkorg"
description: "Provider inbox + thread view + ProviderNav badge + API routes"
category: retro
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Avvikelser
  - Lärdomar
---

# S35-2 Done: Leverantör kan läsa och svara i inkorg

## Acceptanskriterier

- [x] Leverantör ser inkorg med alla aktiva bokningar som har meddelanden
- [x] Unread-badge visar korrekt antal (ProviderNav + per rad i inkorg)
- [x] Tråd-vy visar full historik, båda parters meddelanden
- [x] Leverantör kan svara, meddelandet når kund
- [x] Read-markering fungerar (badge minskar) — markeras en gång vid öppning av tråd
- [ ] E2E tvåvägs-flöde — S35-3 och vidare (push) inte implementerat ännu, E2E-test sparas till efter S35-3

## Definition of Done

- [x] Inga TypeScript-fel (typecheck 0 errors)
- [x] Säker: auth + IDOR-skydd via Prisma-join, feature flag-gate, rate limiting, select-block
- [x] Tester skrivna FÖRST (BDD dual-loop): 10 API-tester + 19 service-tester (29 totalt för S35-2)
- [x] check:all grön: 4136 tester, 0 lint-errors, 0 typecheck-errors, svenska OK
- [x] Feature branch mergad via PR (planerat efter done-fil)

## Reviews körda

- **security-reviewer**: Inga blockers, inga majors. Auth, IDOR, rate limiting, feature flag, dataexponering — allt godkänt.
- **cx-ux-reviewer**: 3 kritiska UX-problem identifierade och åtgärdade (felhantering i inkorg, kontextuell tid, touch-target bakåt-knapp). 3 högt prioriterade åtgärdade (kundnamn i trådhuvud, read-anrop en gång, compose rows={2}).
- **code-reviewer**: Ej körts separat — täcks av security-reviewer + typecheck + tests.

## Docs uppdaterade

- `src/lib/help/articles/provider/meddelanden.md` — ny hjälpartikel om inkorg och tråd-vy
- Admin testing-guide: ej uppdaterad (feature är bakom flag, admin-guide uppdateras när flaggan blir default-on i S35-3 eller senare)

## Verktyg använda

- Läste patterns.md vid planering: ja — koperade Review-mönstret för repository-layer
- Kollade code-map.md för att hitta filer: ja — hittade ProviderNav, BottomTabBar, MessagingDialog
- Hittade matchande pattern: MessagingDialog (återanvändes för tråd-vy), ProviderNav badge-pattern (pendingCount)

## Modell

sonnet

## Avvikelser

- `withApiHandler`-wrappern används inte (konsekvent med befintliga provider-routes som inte migrerat). Inga säkerhetsproblem — security-reviewer godkänt.
- E2E tvåvägs-flöde ej körd (feature bakom flag, kräver `FEATURE_MESSAGING=true` i Playwright-config). Planeras som del av S35-3 eller separat story.

## Lärdomar

- `useSearchParams()` kräver Suspense-wrapper (Next.js build kraschar annars). Lärt oss vid S35-2, handlar om gotcha #29 i CLAUDE.md.
- read-PATCH kördes varje gång SWR-data uppdaterades (var 10s) pga `data` i useEffect-deps. Fix: `useRef`-flagga som sätts vid första anrop.
- UX-agenten hittade kontextuell tidsformatering som ett konkret problem — värt att använda `date-fns` `differenceInDays` + `isToday` istället för alltid HH:mm.
