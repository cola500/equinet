---
title: "S36-2 Done"
description: "Visuell verifiering av S35 messaging-flöde -- audit och inline-fixar"
category: guide
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Inline-fixar
  - Backlog-findings
  - Lärdomar
---

# S36-2 Done -- Visuell verifiering av S35 messaging-flöde

## Acceptanskriterier

- [x] Alla 4-5 messaging-vyer visuellt granskade med Playwright MCP
- [x] cx-ux-reviewer körd på nyckelkomponenter
- [x] Push-notifikations-trigger verifierad i dev-loggar
- [x] Audit-rapport skriven (`docs/retrospectives/2026-04-18-messaging-ux-audit.md`)
- [x] Findings triagerade (minors fixade inline, majors i backlog)
- [x] Beslut om flag-rollout dokumenterat

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga nya säkerhetsrisker introducerade, befintliga förbättrades)
- [x] `npm run check:all` 4/4 gröna (4163 tester)
- [x] Feature branch, mergad via PR

## Reviews körda

- cx-ux-reviewer: kördes på MessagingDialog, ThreadView, InboxPage, ProviderNav. 2 blockers, 5 majors, 7 minors, 3 suggestions identifierade.
- code-reviewer: trivial story (audit + inline-fixar, ingen ny affärslogik) -- inline check tillräcklig.
- security-reviewer: ej körd (inga nya routes eller auth-ändringar).

## Docs uppdaterade

- `docs/retrospectives/2026-04-18-messaging-ux-audit.md` -- skapad (audit-rapport med alla findings, push-verifiering, rollout-beslut)

## Verktyg använda

- Läste patterns.md vid planering: N/A (audit-story, inget nytt implementerat)
- Kollade code-map.md: ja -- för att lokalisera messaging-filer
- Hittade matchande pattern: nej (audit är inte implementation)

## Arkitekturcoverage

Ej tillämpligt -- S36-2 är en audit-story utan designdokument.

## Modell

`sonnet`

## Inline-fixar

| Fix | Fil |
|-----|-----|
| BLOCKER-1: VoiceTextarea i provider thread | `src/app/provider/messages/[bookingId]/page.tsx` |
| BLOCKER-2: Loading-indikator i provider thread + dialog | `src/app/provider/messages/[bookingId]/page.tsx`, `MessagingDialog.tsx` |
| MAJOR-3: Grön badge (ej röd) i inkorg | `src/app/provider/messages/page.tsx` |
| MAJOR-5: useRef-guard för read-marking | `src/components/customer/bookings/MessagingDialog.tsx` |
| MINOR-1: aria-live + aria-label | `src/components/customer/bookings/MessagingDialog.tsx` |
| MINOR-6: autoFocus på Textarea | `src/components/customer/bookings/MessagingDialog.tsx` |
| char-räknare dold under 1800 tecken | `src/components/customer/bookings/MessagingDialog.tsx` |

## Backlog-findings

- MAJOR-1: Suspense skeleton i ThreadView
- MAJOR-2: Hämta kundnamn/tjänst från API (ej query-params)
- MINOR-2: aria-label på ProviderNav messaging-badge
- MINOR-3: Optimistisk uppdatering vid sändning
- MINOR-4: Pending-state på MessagingSection-knapp
- SUGGESTION-1: Pagination för långa trådar
- SUGGESTION-2: Läskvitton
- SUGGESTION-3: Typing indicator

## Lärdomar

- **VoiceTextarea + onKeyDown**: VoiceTextarea exponerar inte `onKeyDown` — Cmd+Enter-genvägen faller bort när man migrerar. Antingen utöka VoiceTextarea-propparna eller acceptera förlusten. Dokumenterat.
- **Read-marking pattern**: ThreadView hade rätt useRef-guard från start; MessagingDialog missade det. Vid nästa liknande komponent: kopiera `readCalledRef`-mönstret direkt.
- **Push-verifiering i dev**: Kan bara verifiera trigger + DB-insert, inte faktisk delivery. Acceptabelt — unit-tester täcker `MessageNotifier`.
- **cx-ux-reviewer är bra på att hitta aria-brister**: Identifierade 3 tillgänglighetsbrister som inte syntes vid kodgranskning. Kör tidigt i flödet.
