---
title: "Offline & Sync Learnings"
description: "Lärdomar från offline PWA-implementationen: SWR, sync-kö, circuit breaker, probe backoff"
category: rule
status: active
last_updated: 2026-04-17
tags: [offline, pwa, sync, swr]
paths:
  - "src/lib/offline/*"
  - "src/sw.ts"
  - "src/hooks/useOnlineStatus*"
  - "src/hooks/useMutationSync*"
---

# Offline & Sync Learnings

- **Offline-aware SWR**: Byt global fetcher i `SWRProvider` villkorligt (feature flag). Mönstret: network-first -> write-through IndexedDB -> catch -> read cache -> throw.
- **SW tsconfig-isolation**: `src/sw.ts` MÅSTE exkluderas från BÅDA `tsconfig.json` OCH `tsconfig.typecheck.json`.
- **Error boundaries för offline**: `error.tsx` med `useOnlineStatus()`. Importera ALDRIG layout-komponenter i error.tsx.
- **useSession vs navigator.onLine race condition**: `useSession()` rapporterar `"unauthenticated"` ~2s FÖRE `navigator.onLine` ändras. Utför ALDRIG destruktiva operationer baserat på "unauthenticated + online".
- **Offline-navigeringsskydd**: Blockera `Link`-klick med `e.preventDefault()` + `toast.error()` när offline.
- **router.replace() triggar RSC-request**: Guard med `if (isOnline)` när URL-uppdateringen bara är för deep-linking.
- **Sequence over concurrency vid reconnect**: `revalidateOnReconnect: false` i SWRProvider, sync först -> `globalMutate()` sedan.
- **Exponentiell backoff med jitter**: `getRetryDelay` applicerar ±50% jitter för att undvika thundering herd. Retry-After-header respekteras utan jitter.
- **Circuit breaker i sync-kö**: 3 konsekutiva 5xx-failures -> pausa kön med `circuitBroken: true`. Resettas vid `synced` eller `conflict`.
- **Max total retries**: Mutation med `retryCount >= 10` markeras `failed` utan fetch-försök.
- **Modul-nivå guard för async hooks**: `let syncInProgress = false` på modul-nivå istället för `useRef` -- överlever komponent-ommountering.
- **iOS Safari falska online-events**: Proba med HEAD-request först, återställ bara om proben lyckas.
- **Probe backoff**: Recovery-probes eskalerar `[15s, 30s, 60s, 120s]` vid upprepade misslyckanden.
- **withQuotaRecovery**: Wrappa IndexedDB-skrivningar -- vid `QuotaExceededError`: evict stale cache, försök igen, ge upp tyst.
- **Tab-koordinering max duration**: Sync-lås som hållits > 5 min släpps automatiskt (hängande tab).
- **guardMutation nätverksfel-fallback**: Online-path fångar TypeError/AbortError, anropar `reportConnectivityLoss()`, faller tillbaka till offline-köning.
- **networkidle + SWR-polling = timeout**: `waitForLoadState('networkidle')` resolverar ALDRIG i sidor med SWR-polling. Använd `domcontentloaded` + explicit element-wait i E2E.
- **CSP blockerar lokal Supabase i prod-build**: `isDev`-flaggan i next.config.ts baseras på NODE_ENV vid BUILD-tid. Detektera `NEXT_PUBLIC_SUPABASE_URL` localhost istället.
- **Serwist reloadOnOnline: false**: Default `true` laddar om sidan vid online-event, avbryter sync engine:n. Inaktivera om appen har egen reconnection-logik.
- **iOS ignoreTTL-parameter > global isOffline**: Passera `ignoreTTL: Bool` till SharedDataManager cache-metoder istället för global mutable state. Undviker thread-safety.
- **iOS PendingActionStore retryAll() vid app resume**: scenePhase .active + isConnected triggar retry. Dubbelanrop (resume + nätverksbyte) är safe pga retryCount-guard.
