---
title: "Retrospektiv: Offline-härdning"
description: "Robusthetshärdning av offline-infrastrukturen: jitter, circuit breaker, kvothantering, tab-koordinering, konflikt-UI"
category: retro
status: active
last_updated: 2026-03-03
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - Lärandeeffekt
---

# Retrospektiv: Offline-härdning

**Datum:** 2026-03-03
**Scope:** Härda befintlig offline-infrastruktur utan att utöka scope (inga nya endpoints, inga kundsidor)

---

## Resultat

- 14 ändrade filer, 0 nya filer, 0 nya migrationer
- +869/-56 rader
- 29 nya tester (alla TDD, alla gröna)
- 3003 totala tester (inga regressioner, från 2974)
- Typecheck = 0 errors, Lint = 0 nya varningar
- Tid: ~1 session, 5 faser

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Lib/offline | `sync-engine.ts` | Jitter i backoff (±50%), circuit breaker (3 konsekutiva 5xx), max total retries (10), server error message i 409 |
| Lib/offline | `cache-manager.ts` | Kvotdetektering med `withQuotaRecovery`, datavalidering vid läsning, proaktiv stale-eviction (throttlad var 5 min) |
| Lib/offline | `offline-fetcher.ts` | Cache hit/miss/write/stale-loggning via debugLog, `maybeEvictStaleCache` fire-and-forget |
| Lib/offline | `tab-coordinator.ts` | Max sync duration (5 min), `safeBroadcast` felhantering, ACK-timeout höjd till 300ms |
| Hooks | `useOnlineStatus.ts` | Probe backoff (15s → 30s → 60s → 120s), probe-resultat-loggning |
| Hooks | `useMutationSync.ts` | `conflictCount` state (persistent via IndexedDB-query) |
| UI | `MutationQueueViewer.tsx` | Retry-knapp (failed), bekräftelsedialog (AlertDialog) vid discard |
| UI | `OfflineBanner.tsx` | Persistent error badge baserad på `conflictCount` (överlever sidbyte) |

## Vad gick bra

### 1. Detaljerad plan eliminerade gissningar
Planen specificerade exakta radnummer, funktionssignaturer och testfall. Varje fas var oberoende och verifierbar. Noll tvekan om vad som skulle implementeras -- bara TDD-cykeln RED → GREEN → REFACTOR.

### 2. TDD fångade buggar direkt
Circuit breaker-testet avslöjade att `consecutiveServerErrors` resettas korrekt vid `synced` OCH `conflict` (inte bara `synced`). Utan testet hade conflicts felaktigt ackumulerats som server errors.

### 3. Inga nya filer -- enbart härdning av befintlig kod
Alla 14 filer existerade redan. Principen "härda befintligt, utöka inte scope" höll genom hela sessionen. Inga nya abstraktioner eller moduler behövdes.

### 4. Fas-för-fas-verifiering förhindrade regressionskaskader
Varje fas verifierades med `test:run` + `typecheck` innan nästa påbörjades. Om en ändring i fas 3 (cache-manager) hade brutit fas 1 (offline-fetcher) hade det fångats direkt.

## Vad kan förbättras

### 1. maybeEvictStaleCache-beroende mellan faser
Offline-fetcher importerar `maybeEvictStaleCache` som skapas i fas 3, men jag försökte lägga till den redan i fas 1. Planen kunde ha varit tydligare om att denna import tillhör fas 3.

**Prioritet:** LÅG -- fångades snabbt, ingen tidsförlust.

### 2. Tab-coordinator-tester tog lång tid (6s)
Varje `acquireSyncLock` väntar 300ms (ACK-timeout). Med 15 tester som var och en skapar 1-3 coordinators blir det ~6s. Borde ha modat setTimeout i fler tester.

**Prioritet:** LÅG -- 6s är acceptabelt, men kan halveras med setTimeout-mock.

## Patterns att spara

### withQuotaRecovery-wrapper
Generisk recovery-wrapper för IndexedDB-skrivningar som hanterar `QuotaExceededError`:
1. Försök skriva
2. Om kvotfel: evict stale cache, försök igen
3. Om fortfarande kvotfel: ge upp tyst (graceful degradation)

Användbar för alla IndexedDB-skrivningar, inte bara `endpointCache.put`.

### Circuit breaker i sync-kö
Räkna konsekutiva server errors (5xx). Vid 3 i rad: pausa kön med `circuitBroken: true` i SyncResult. Reset vid varje lyckad sync eller conflict (4xx). Catch-block (oväntade fel) räknas INTE som server error.

### Probe backoff med eskalerande intervall
Byt `setInterval` mot rekursiv `setTimeout` med stigande delays (`[15s, 30s, 60s, 120s]`). Resettas vid `reportConnectivityRestored()`. Sparar batteri/data på mobil vid långvarig offline.

### Bekräftelsedialog för destruktiva offline-operationer
Discard av offlineändringar kräver `AlertDialog` med "Ja, ignorera" / "Avbryt". Retry-knapp (failed) behöver INTE bekräftelse (icke-destruktiv). Conflict-mutationer har INTE retry-knapp (servern har redan avvisat dem).

## Lärandeeffekt

**Nyckelinsikt:** Offline-robusthet handlar inte om nya features utan om att hantera kant-fall i befintlig infrastruktur: vad händer vid fulla diskar (kvotfel), kraschade tabs (hängande lås), mass-återanslutning (thundering herd) och oförståeliga konflikter (generiska "HTTP 409"). Varje härdning är en liten ändring (~10 rader) men kräver djup förståelse för felets kontext och rätt recovery-strategi.
