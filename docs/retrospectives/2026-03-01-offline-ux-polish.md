# Retrospektiv: UX-polish offline-upplevelse

**Datum:** 2026-03-01
**Scope:** Forbattra kommunikationen till leverantorer som arbetar offline -- tydligare feedback, visuellt inaktiverade kontroller, och varningsmeddelanden.

---

## Resultat

- 19 andrade filer, 0 nya filer, 0 nya migrationer
- 2821 totala tester (inga regressioner)
- 2 commits: offline CRUD-expansion + UX-polish
- Typecheck = 0 errors
- Tid: 2 sessioner (CRUD-expansion + UX-polish)

## Vad som byggdes

### Commit 1: Offline CRUD-expansion (81583d8)

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI | `calendar/page.tsx` | Optimistiska uppdateringar for statusandringar, avbokning, anteckningar |
| UI | `ManualBookingDialog.tsx` | Offline-aware ny bokning med guardMutation + optimistic update |
| UI | `BookingDetailDialog.tsx` | Offline-aware anteckningar och avbokning |
| UI | `DayExceptionDialog.tsx` | Offline-guard for tillganglighetsundantag |
| UI | `PendingSyncBadge.tsx` | Ny komponent: visar synk-status per bokning |
| Hooks | `useOfflineGuard.ts` | Ny hook: wrappa mutation med offline-fallback till queue |
| Hooks | `usePendingMutation.ts` | Ny hook: lyssna pa pending mutations per entity |
| Hooks | `useMutationSync.ts` | Forbattrad sync-motor med stale recovery |
| Lib | `mutation-queue.ts` | Utokad med entityType/entityId for optimistiska uppdateringar |
| Lib | `offline-fetcher.ts` | Cachebara endpoints utokade |
| Lib | `sync-engine.ts` | Forbattrad felhantering |
| Lib | `db.ts` | Uppdaterat IndexedDB-schema |
| Test | 6 testfiler | Tester for alla nya hooks och forbattrad offline-logik |

### Commit 2: UX-polish (f0f68c6)

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI | `PendingSyncBadge.tsx` | Badge-text: "Vantar pa synk" -> "Sparad lokalt" |
| UI | `ManualBookingDialog.tsx` | Offline-notice flyttad ovanfor fold, recurring-switch disabled offline |
| UI | `BookingDetailDialog.tsx` | Avbokningsvarning offline, stavfel fixade |
| UI | `QuickNoteButton.tsx` | Visuellt disabled offline med forklarande title |
| Test | `PendingSyncBadge.test.tsx` | Uppdaterat test for ny badge-text |

## Vad gick bra

### 1. UX-granskningen fangade riktiga problem
CX-UX-reviewer-agenten identifierade 6 konkreta UX-luckor som alla hade direkt paverkan pa anvandares trygghetskansla. Inget var overengineering -- varje fix adresserade ett scenario dar leverantorer i falt skulle bli osekra.

### 2. Minimal kod, stor effekt
UX-polishen var +30/-18 rader over 5 filer. Inga nya beroenden, inga nya komponenter, inga arkitekturella andringar. Befintliga hooks (`useOfflineGuard`, `useOnlineStatus`) ateranvandes direkt.

### 3. TDD-grundarbetet bar frukt
Alla 2821 tester passerade utan regressioner trots 19 andrade filer. Den befintliga testsviten fangade inga oavsiktliga sidoeffekter.

## Vad kan forbattras

### 1. Stavfel borde fangas tidigare
Tva stavfel ("Klicka for" -> "Klicka for", "Lagg" -> "Lagg") hade legat i koden sedan tidigare sessioner. `check:swedish`-skriptet varnar bara for markdown-filer, inte TSX.

**Prioritet:** LAG -- manuell granskning racker, men en TSX-utvidgning av check:swedish vore vardefull pa sikt.

### 2. Recurring-blockering borde vara server-side ocksa
Recurring-switch ar nu disabled i UI:t offline, men det finns redan en toast-guard i `handleSubmit`. Dock saknas en explicit server-side guard for recurring+offline -- det forlitar sig pa att booking-series-endpointen inte ar cachebar.

**Prioritet:** LAG -- defense in depth ar onskvert men nuvarande client-side guard ar tillracklig.

## Patterns att spara

### Offline UI-feedback-checklista
For varje UI-kontroll som inte fungerar offline:
1. `disabled={!isOnline}` pa interaktiva element
2. Dynamisk `title` som forklarar varfor (for hover/screenreaders)
3. Forklarande text under/bredvid elementet ("Kraver internetanslutning")
4. Offline-notice hogst upp i dialoger (ovanfor fold)
5. Varningsmeddelande i destruktiva dialoger ("Kunden notifieras nar du ar online igen")

### Badge-text for optimistiska uppdateringar
"Sparad lokalt" > "Vantar pa synk". Anvandaren bryr sig om sin data ar saker -- inte om den tekniska synk-processen.

## Larandeeffekt

**Nyckelinsikt:** Teknisk korrekthet (mutation queue, optimistiska uppdateringar, synk-motor) ar nodvandig men inte tillracklig for en bra offline-upplevelse. Anvandaren maste kunna **se** att systemet fungerar -- disabled states, forklarande texter och trygghetsgivande badges ar lika viktiga som den underliggande infrastrukturen.
