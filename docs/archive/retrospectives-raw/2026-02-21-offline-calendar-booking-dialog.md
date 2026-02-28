# Retrospektiv: Offline kalender-bokningsdialog

**Datum:** 2026-02-21
**Scope:** Fix for att kalender-bokningsdialogen visade offlinesida istallet for bokningsdetaljer

---

## Resultat

- 1 andrad fil, 1 ny fil (+200/-8 rader)
- 4 nya tester (TDD, alla grona)
- 2169 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI | `src/app/provider/calendar/page.tsx` | Offline-skydd: skippa `router.replace()` nar offline i `handleBookingClick` och `handleDialogClose` |
| Test | `src/app/provider/calendar/page.test.tsx` | 4 tester: verifiera att `router.replace` inte anropas offline men anropas online |

## Vad gick bra

### 1. Rotorsaksanalys identifierade exakt problemet
`router.replace()` med query-params triggar RSC-request. Offline failar detta, error boundary fangar felet. Dialogen styrs av lokal state och behover inte URL-uppdatering for att fungera -- URL:en ar bara for deep-linking.

### 2. Minimal fix med maximal effekt
Bara 3 rader produktionskod andrades: destructure `isOnline` + tva `if (isOnline)`-guards. Ingen ny komplexitet, inga nya beroenden.

### 3. TDD RED-fas avslojde korrekt beteende
De tva offline-testerna failade korrekt i RED (router.replace anropades trots offline), medan de tva online-testerna passerade direkt (bekraftade att befintligt beteende var korrekt).

## Vad kan forbattras

### 1. Full-page rendering i tester ar fragilt
Att rendera hela `ProviderCalendarPage` med 15+ mockade dependencies var problemfyllt -- React state-uppdateringar flushades inte korrekt i testmiljon. Losningen blev att fokusera pa `mockReplace`-anrop istallet for dialog-state. Framtida page-tester bor anvanda samma approach: testa side-effects (API-anrop, router-anrop) istallet for intern state.

**Prioritet:** MEDEL -- pattern ar dokumenterat, men att extrahera handler-logik till custom hooks skulle gora tester enklare.

## Patterns att spara

### Testa page-komponent via side-effects, inte intern state
Nar en page-komponent har manga mockade dependencies, testa `router.replace`/`router.push`/`fetch`-anrop istallet for att verifiera React-state. Mocka sub-komponenter att exponera callbacks (t.ex. `onBookingClick`) och verifiera att ratt side-effects utloses.

### Offline-skydd for router.replace
`router.replace()` och `router.push()` i Next.js App Router triggar RSC-requests. Offline failar dessa. Guard med `if (isOnline)` fran `useOfflineGuard` nar URL-uppdateringen bara ar for deep-linking/back-navigering och inte for att visa nytt innehall.

## 5 Whys (Root-Cause Analysis)

### Problem: React state-uppdateringar syntes inte i tester trots att event handlers kordes
1. Varfor? `data-open` attributet uppdaterades inte efter `fireEvent.click`
2. Varfor? React re-renderade inte komponenten efter `setDialogOpen(true)`
3. Varfor? Full-page rendering med 15+ mocks och Suspense-boundary skapar komplex render-pipeline
4. Varfor? Testmiljon (jsdom + vitest) hanterar inte alla React 18 batching-scenarion identiskt med en riktig browser
5. Varfor? React Testing Library ar designat for enklare komponenttester; komplexa page-komponenter med manga dependencies ar i gransomradet

**Atgard:** Fokusera page-tester pa side-effects (router-anrop, fetch-anrop) istallet for intern state. Dokumenterat som pattern.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** `router.replace()` i Next.js App Router ar INTE en lokal URL-uppdatering -- den triggar en RSC-request. I offline-scenarion maste alla `router.replace()`/`router.push()` som bara ar for URL-sync (inte for att ladda nytt innehall) skyddas med en online-check.
