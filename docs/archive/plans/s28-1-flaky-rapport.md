---
title: "S28-1: Offline E2E Flaky-rapport"
description: "Spike-resultat -- kartlaggning av flaky/failande offline E2E-tester med rotorsaksanalys"
category: plan
status: active
last_updated: 2026-04-17
sections:
  - Sammanfattning
  - Testkörningar
  - Failande tester
  - Rotorsaksanalys
  - Arkitekturella race conditions
  - Prioriterad åtgärdslista för S28-3
---

# S28-1: Offline E2E Flaky-rapport

## Sammanfattning

**Körd:** 2026-04-17, 2 körningar av `npm run test:e2e:offline`
**Resultat:** 5 konsekvent failande, 4 passerar. Inga flaky (intermittenta) tester -- alla failures är deterministiska.
**Rotorsak:** En enda bugg: `waitForLoadState('networkidle')` i alla offline-tester som navigerar till provider-sidor med SWR-polling.

---

## Testkörningar

| Körning | Passerade | Failande | Flaky |
|---------|-----------|----------|-------|
| 1       | 4         | 5        | 0     |
| 2       | 4         | 5        | 0     |

Identiska resultat. Alla failures är deterministiska, inte intermittenta.

---

## Failande tester (5 st)

### 1. offline-pwa.spec.ts:68 -- "previously visited page loads from cache when offline"

**Felmedd:** `TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.`
**Rad:** 71, 75 (`waitForLoadState('networkidle')`)

### 2. offline-pwa.spec.ts:88 -- "unvisited page shows offline fallback when offline"

**Felmedd:** `TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.`
**Rad:** 91 (`waitForLoadState('networkidle')`)

### 3. offline-mutations.spec.ts:206 -- "booking marked completed offline syncs on reconnect"

**Felmedd:** `TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.`
**Rad:** 213 (`waitForLoadState('networkidle')`)

### 4. offline-mutations.spec.ts:287 -- "route stop marked completed offline syncs on reconnect"

**Felmedd:** `TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.`
**Rad:** 294 (`waitForLoadState('networkidle')`)

### 5. offline-mutations.spec.ts:344 -- "offline banner shows pending mutation count"

**Felmedd:** `TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.`
**Rad:** 352 (`waitForLoadState('networkidle')`)

---

## Rotorsaksanalys

### 5 Whys -- varför failar ALLA 5 tester?

1. **Varför failar testerna?** Timeout på `waitForLoadState('networkidle')` -- 30s räcker inte.
2. **Varför tar networkidle > 30s?** Playwright väntar tills INGA nätverksanrop pågår i 500ms. Det uppnås aldrig.
3. **Varför finns det alltid nätverksanrop?** SWR-polling kör `revalidateOnFocus` + polling-intervaller (60s feature flags, SWR hooks med `refreshInterval`).
4. **Varför används networkidle i offline-testerna?** Historiskt arv -- testerna skrevs innan SWR-polling-gotchan dokumenterades. Normal E2E fixades (gotcha #27, mars 2026) men offline-testerna lämnades.
5. **Varför fixades inte offline-testerna samtidigt?** Offline-tester körs separat (`OFFLINE_E2E=true`) och ingår inte i standard CI. De "syns inte" vid vanliga E2E-uppdateringar.

**Rotorsak:** `networkidle` är inkompatibelt med SWR-polling. Ska ersättas med `domcontentloaded` + explicit element-wait.

---

## Arkitekturella race conditions (identifierade men EJ flaky idag)

Utöver de failande testerna identifierade sync-engine-analysen dessa potentiella svagheter:

### RC-1: Tab coordinator 300ms timeout (MODERAT risk)

BroadcastChannel-latens kan överskrida 300ms under CPU-last, vilket gör att två tabbar kan synka samtidigt. Inte observerat i E2E men möjligt i produktion.

**Rekommendation:** Öka `LOCK_TIMEOUT_MS` till 500ms.

### RC-2: Cross-tab cache update race (LÅG risk)

Tab A broadcastar `CACHE_UPDATED` medan Tab B synkar. Tab B kör `globalMutate()` innan alla mutationer synkats. Ger stale reads, inte dataförlust.

### RC-3: Snabb online/offline/online toggle (LÅG risk)

Module-level `syncInProgress`-guard hanterar detta korrekt. `resetStaleSyncingMutations()` återställer stuck-mutationer.

### RC-4: IndexedDB quota (LÅG risk)

`withQuotaRecovery` hanterar QuotaExceededError genom stale eviction + retry. Silently fails vid andra försöket -- acceptabelt best-effort-beteende.

---

## Prioriterad åtgärdslista för S28-3

### P1: Ersätt networkidle med explicit waits (fixar ALLA 5 tester)

**Filer:**
- `e2e/offline-pwa.spec.ts` -- rad 71, 75, 91
- `e2e/offline-mutations.spec.ts` -- rad 213, 294, 352

**Åtgärd:** Ersätt varje `await page.waitForLoadState('networkidle')` med:
```typescript
await page.waitForLoadState('domcontentloaded')
await expect(page.locator('<relevant-element>')).toBeVisible({ timeout: 10000 })
```

Specifikt:
- Bokningssida: vänta på `[data-testid="booking-item"]` eller filterknapp
- Ruttsida: vänta på ruttnamn-text
- Dashboard: vänta på dashboard-heading

**Effort:** 30 min
**Förväntad effekt:** Alla 5 tester blir gröna

### P2: Ta bort fallback-hacket i test 1 (bonus)

`offline-mutations.spec.ts:263-282` har en fallback som manuellt applicerar mutationen om auto-sync timeoutar. Med networkidle-fixen bör sync fungera korrekt -- om inte, behålls fallbacken men med en TODO-kommentar.

**Effort:** 15 min (efter P1 verifierats)

### P3: Öka tab coordinator timeout (förebyggande)

Ändra `LOCK_TIMEOUT_MS` i `tab-coordinator.ts` från 300ms till 500ms. Förebygger potentiella race conditions i produktion under CPU-last.

**Effort:** 5 min + kör unit-tester

### Ej i scope (backlog)

- Kund-offline E2E (S28-4 scope)
- Multi-tab E2E-tester (kräver helt ny testinfrastruktur)
- Circuit breaker E2E-verifiering (unit-testad, inte E2E-bar)
