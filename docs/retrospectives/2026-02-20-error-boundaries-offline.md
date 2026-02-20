# Retrospektiv: Error boundaries for offline-navigering

**Datum:** 2026-02-20
**Scope:** Client-side error boundaries som skyddsnat mot blank skarm vid offline-navigering

---

## Resultat

- 0 andrade filer, 3 nya filer, 0 nya migrationer
- 6 nya tester (alla TDD, alla grona)
- 2063 totala tester (upp fran 2037, inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~0.5 session (liten, fokuserad implementation)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| UI (Error boundary) | `src/app/provider/error.tsx` | Offline-medveten error boundary for provider-sidor |
| UI (Error boundary) | `src/app/error.tsx` | Global error boundary som fallback for alla sidor |
| Test | `src/app/provider/error.test.tsx` | 6 unit-tester: offline-UI, online-UI, reset, loggning |

## Vad gick bra

### 1. Minimal, fokuserad implementation
Tre filer, 6 tester, ingen overengineering. Error boundaries ar ett val-testat Next.js-monster -- vi behovde inte uppfinna nagot nytt.

### 2. TDD fangade designbeslut tidigt
Att skriva testerna forst tvingade oss att definiera beteendet explicit: "offline = offline-UI, online = generisk error-UI, loggning bara for non-offline-fel". Utan TDD hade vi kanske implementerat och sedan funderat pa dessa fall.

### 3. Inline markup istallet for komponentimport
Planen motiverade varfor error.tsx INTE ska importera ProviderLayout eller tunga komponenter -- en error boundary som sjalv kraschar ger ingen nytta. Enkla div:ar + Button ar sakrast.

## Vad kan forbattras

### 1. Duplication mellan provider/error.tsx och app/error.tsx
De tva filerna ar nastan identiska (skiljer sig pa en rad text). Kan extraheras till en delad komponent, men risken med delade beroenden i error boundaries motiverar dupliceringen -- om den delade komponenten kraschar tar den ner bada.

**Prioritet:** LAG -- medveten tradeoff, dupliceringen ar minimal (< 80 rader)

### 2. Inga tester for globala error.tsx
Bara provider/error.tsx har unit-tester. Globala error.tsx ar nastan identisk och testar samma logik, men saknar formella tester. Acceptabelt for nu men kan laggas till vid behov.

**Prioritet:** LAG -- identisk logik, lag risk

## Patterns att spara

### Error boundary med online-status-check
```
error.tsx: useOnlineStatus() -> offline? visa WifiOff-UI : visa generisk error-UI
```
Monstret: error.tsx renderas UTANFOR sidans komponenttrad, sa hall den enkel (inline markup, minimala imports). Anvand `useOnlineStatus()` for att skilja offline-fel fran riktiga buggar.

### Inline markup i error boundaries
Importera ALDRIG layout-komponenter (ProviderLayout etc.) i error.tsx. Om error boundary:n kraschar av en import visar Next.js sin inbyggda error-overlay (dev) eller blank sida (prod) -- exakt det problem vi forsaker losa.

## Larandeeffekt

**Nyckelinsikt:** Error boundaries ar det viktigaste klient-side skyddsnatet for offline-navigering. Service Worker-strategier (networkTimeoutSeconds, RSC-fallback) hjalper, men kan inte fanga alla scenarier (Safari Private Browsing stodjer inte SW). En enkel error.tsx med online-check ger en bra UX-fallback oavsett SW-stod.
