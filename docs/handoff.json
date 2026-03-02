# E2E-tester för Offline-Härdning

## Context

Offline-härdningen (Fas 0-6) är implementerad och committad på branch `feature/offline-hardening` (commit `914ddea`). 2972 unit-tester gröna, +54 nya. Nu behövs E2E-tester för att verifiera att de nya funktionerna fungerar i en riktig browser-miljö med service worker, IndexedDB, och BroadcastChannel.

**Vad som implementerats:**
- Multi-tab sync-lock via BroadcastChannel (`tab-coordinator.ts`)
- MutationQueueViewer (Sheet med pending/failed/conflict mutations + dismiss)
- Klickbar OfflineBanner (error-state öppnar MutationQueueViewer)
- StaleDataBanner (visas när cachad data >4h, `_isStale`-flagga)
- Per-mutation 30s timeout (AbortController)
- Data-integritet (corrupt mutation-detection, DB health check, getCacheStats)

---

## Vad som INTE behöver E2E-tester (redan väl täckt av unit-tester)

| Feature | Varför E2E onödigt |
|---------|-------------------|
| Tab-coordinator lock-logik | 11 unit-tester med MockBroadcastChannel |
| Per-mutation timeout (30s) | Kräver 30s väntan eller fragil time-mock |
| Corrupt mutation-detection | Ren funktion, 5 unit-tester |
| DB health check | Bevisas implicit av alla offline-tester |
| StaleDataBanner-komponent | Prop-driven, INTE ännu kopplad till layout |
| Exponentiell backoff/Retry-After | Timing-beroende, 4 unit-tester |
| SWR-key-filtrering efter sync | Ren funktion, ej assertbar i E2E |

---

## 3 nya E2E-tester (prioritetsordning)

Ny fil: `e2e/offline-hardening.spec.ts`
Spec-tag: `offline-hardening`

### Test 1 (HIGHEST): Konflikt -> error banner -> MutationQueueViewer -> dismiss

**Varför E2E:** Korsar 5 lager: IndexedDB queue -> sync-engine -> riktig API (400) -> OfflineBanner error -> MutationQueueViewer Sheet. Ingen unit-test kan verifiera hela kedjan.

**Seed:** En `confirmed` bokning (`bookingForConflict`).

**Steg:**
1. Login som provider, vänta på SW
2. Besök `/provider/bookings`, filtrera "Bekräftade", verifiera bokningen syns
3. `context.setOffline(true)`
4. **Medan browsern är offline**: Uppdatera bokningen till `completed` via Prisma (simulerar att annan enhet ändrat data)
5. Klicka "Markera som genomförd" i UI -> toast "sparas offline"
6. `context.setOffline(false)` -> sync försöker PUT completed->completed -> server ger 400
7. `waitForMutationsSynced(page)` -> verifiera att mutation har status `conflict`
8. Assert: Röd error-banner synlig med text `/kunde inte synkas/`
9. Klicka error-bannern -> Sheet öppnas
10. Assert: "Ändringsköer" title, "Bokning" entityType, "Konflikt" badge, "HTTP 400" error
11. Klicka "Ignorera" (dismiss-knapp)
12. Assert: "Inga väntande ändringar"

**Trick:** Prisma körs i Node.js test-processen (alltid online) -- `context.setOffline()` påverkar bara browsern. Så vi kan ändra DB "bakom ryggen" på användaren medan hen är offline.

### Test 2 (HIGH): Lyckad sync -> reconnected-banner -> försvinner

**Varför E2E:** Befintliga test 3 kollar bara pending count offline. Inget test verifierar reconnection-livscykeln: "Återansluten" -> synced count -> banner försvinner.

**Seed:** En `confirmed` bokning (`bookingForSuccess`).

**Steg:**
1. Login, SW, besök bokningar, gå offline
2. Markera bokning som genomförd offline
3. `context.setOffline(false)`
4. Assert: "Återansluten" synlig (`timeout: 5000`)
5. `waitForMutationsSynced` -> alla synced
6. Verifiera serverstatus via `verifyBookingStatusInDB`

### Test 3 (MEDIUM-HIGH): Multi-tab -- mutation synkar korrekt med två flikar

**Varför E2E:** Enda sättet att verifiera att BroadcastChannel faktiskt fungerar mellan riktiga browser-tabs. Unit-tester använder mock.

**Feasibility:** Playwright's `context.newPage()` skapar en ny flik i samma BrowserContext. BroadcastChannel fungerar inom samma kontext = funkar!

**Seed:** En `confirmed` bokning (`bookingForMultiTab`).

**Steg:**
1. Tab A: login, SW, besök bokningar
2. `context.setOffline(true)`
3. Tab A: markera bokning som genomförd offline
4. Tab B: `context.newPage()`, navigera till bokningar
5. Tab B: verifiera mutation synlig i IndexedDB (shared)
6. `context.setOffline(false)` -> en av flikarna syncar
7. `waitForMutationsSynced` i Tab A eller B
8. `verifyBookingStatusInDB` -> completed exakt en gång (ingen dubblett)

**Flakiness:** MEDIUM -- acceptera att *endera* flik kan processa. Verifiera server-state (korrekthetsgarantin).

---

## Seed-strategi

```typescript
const SPEC_TAG = 'offline-hardening'

test.beforeAll(async () => {
  await cleanupSpecData(SPEC_TAG)
  bookingForConflict = await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', ... })
  bookingForSuccess = await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', ... })
  bookingForMultiTab = await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', ... })
})

test.afterAll(async () => {
  await cleanupSpecData(SPEC_TAG)
})
```

**Hjälpfunktion:** `clearMutationQueue(page)` -- rensar IndexedDB pendingMutations innan varje test:
```typescript
async function clearMutationQueue(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.open('equinet-offline')
    req.onsuccess = () => {
      const db = req.result
      try {
        const tx = db.transaction('pendingMutations', 'readwrite')
        tx.objectStore('pendingMutations').clear()
        tx.oncomplete = () => { db.close(); resolve() }
      } catch { db.close(); resolve() }
    }
    req.onerror = () => resolve()
  }))
}
```

---

## Konfiguration

**Inga ändringar behövs i `playwright.config.ts`** -- befintliga `offline-chromium`-projektet matchar redan `offline-.*\.spec\.ts`.

**Skip-guard i testfilen:**
```typescript
test.skip(!process.env.OFFLINE_E2E, 'Requires production build (npm run test:e2e:offline)')
```

---

## Befintliga helpers att återanvända (från `e2e/offline-mutations.spec.ts`)

| Helper | Beskrivning |
|--------|-------------|
| `loginAsProvider(page)` | Loggar in som test-provider |
| `waitForServiceWorker(page)` | Väntar på aktiv SW |
| `waitForMutationsSynced(page)` | Pollar IndexedDB tills alla mutations nått terminal-state |
| `readMutationFromIndexedDB(page)` | Läser pending mutations direkt från IndexedDB |
| `verifyBookingStatusInDB(id, status)` | Verifierar bokning i databasen |

**Dessa bör extraheras till en delad hjälpfil** `e2e/setup/offline-helpers.ts` eftersom de nu används av 2+ spec-filer.

---

## Verifiering

```bash
# Kör bara nya E2E-tester
OFFLINE_E2E=true npx playwright test offline-hardening

# Kör alla offline E2E (regression)
OFFLINE_E2E=true npx playwright test offline-

# Full suite
npm run test:e2e:offline
```

---

## Risker och mitigeringar

| Risk | Mitigation |
|------|------------|
| Bokning syns inte i filter | Unika hästnamn per test + exact text-matchning |
| SW inte redo | `waitForServiceWorker(page)` i varje test |
| IndexedDB-rester från tidigare test | `clearMutationQueue(page)` i varje tests setup |
| Multi-tab timing | Acceptera att endera flik processar; verifiera server-state |
| Reconnected-banner försvinner innan assert | `toBeVisible({ timeout: 5000 })` |
| Sheet-animering fördröjer | `toBeVisible({ timeout: 3000 })` |

---

## Kritiska filer

| Fil | Roll |
|-----|------|
| `e2e/offline-mutations.spec.ts` | Pattern + helpers att följa/extrahera |
| `e2e/setup/seed-helpers.ts` | `seedBooking`, `cleanupSpecData` |
| `src/components/provider/OfflineBanner.tsx` | Klickbar error-banner (role="alert") |
| `src/components/provider/MutationQueueViewer.tsx` | Sheet med mutations |
| `src/lib/offline/tab-coordinator.ts` | BroadcastChannel-koordinering |
| `playwright.config.ts` | offline-chromium projekt, feature flags |

---

## Handoff (för ny session)

Spara följande som `docs/handoff.json` och instruera nästa session med: "Implementera E2E-testerna enligt docs/handoff.json"

```json
{
  "task": "Implementera E2E-tester för offline-härdningen",
  "branch": "feature/offline-hardening",
  "lastCommit": "914ddea",
  "plan": ".claude/plans/immutable-floating-crane.md",
  "status": "Unit-tester klara (2972, +54 nya). E2E-plan godkänd. Implementation kvar.",
  "whatToDo": [
    "Läs planen i .claude/plans/immutable-floating-crane.md",
    "Extrahera offline-helpers från e2e/offline-mutations.spec.ts till e2e/setup/offline-helpers.ts",
    "Skapa e2e/offline-hardening.spec.ts med 3 tester enligt planen",
    "Test 1: Konflikt-flöde (högst prio) -- error banner -> MutationQueueViewer -> dismiss",
    "Test 2: Lyckad sync -> reconnected-banner",
    "Test 3: Multi-tab mutation sync",
    "Kör: OFFLINE_E2E=true npx playwright test offline-hardening"
  ],
  "keyFiles": {
    "plan": ".claude/plans/immutable-floating-crane.md",
    "existingE2E": "e2e/offline-mutations.spec.ts",
    "seedHelpers": "e2e/setup/seed-helpers.ts",
    "playwrightConfig": "playwright.config.ts",
    "offlineBanner": "src/components/provider/OfflineBanner.tsx",
    "mutationQueueViewer": "src/components/provider/MutationQueueViewer.tsx",
    "tabCoordinator": "src/lib/offline/tab-coordinator.ts"
  },
  "notes": [
    "Offline E2E kräver produktion-build: npm run build:pwa && npm run start:pwa (port 3001)",
    "OFFLINE_E2E=true krävs för att aktivera offline-chromium projektet i Playwright",
    "Prisma körs i Node test-process (alltid online) -- context.setOffline() påverkar bara browser",
    "Använd unika hästnamn per test för att undvika selector-konflikter",
    "clearMutationQueue(page) behövs innan varje test"
  ]
}
```
