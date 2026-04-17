---
title: "Sprint 28: Offline PWA -- stabilisering och expansion"
description: "Fånga offline-flakiness systematiskt, lägg i standard CI, utöka till kundsidan och stärka iOS"
category: sprint
status: draft
last_updated: 2026-04-17
tags: [sprint, offline, pwa, e2e, ios, flaky]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 28: Offline PWA -- stabilisering och expansion

## Sprint Overview

**Mål:** Fånga all offline-flakiness systematiskt, gör E2E-offline-smoke till en del av standard CI, stärk iOS-offlineupplevelsen, och utöka offline-stöd till kundsidan.

**Bakgrund:** Offline PWA-arkitekturen är mogen men historiskt flaky. Serwist-uppgraderingar kräver manuell verifiering varje gång eftersom offline-E2E kräver separat setup (`OFFLINE_E2E=true` + prod build på port 3001). Kundsidan saknar helt offline-stöd. iOS har NetworkMonitor men ingen background sync.

**Princip:** Fix rotorsaker, inte symptom. 5 Whys per flaky-test. Lägg till i standard CI så regressioner fångas automatiskt.

---

## Sessionstilldelning

### Session 1 (Opus, huvudrepo)
Webb-stories -- kräver djup förståelse av Service Worker, IndexedDB och race conditions:
- **S28-1** Spike: Kartlägg flaky-scenarier
- **S28-2** Offline E2E i standard CI-smoke
- **S28-3** Fix flaky-rotorsaker
- **S28-4** Kund-offline (fas 4) -- om tid finns

### Session 2 (Sonnet, worktree)
iOS-stories + docs -- mekaniskt och isolerat:
- **S28-5** iOS offline-verifiering + förbättringar
- **S28-6** Uppdatera offline-pwa.md dokumentation

**Session 1 SKA INTE röra:** `ios/*`, `docs/architecture/offline-pwa.md`
**Session 2 SKA INTE röra:** `src/lib/offline/*`, `src/hooks/useOnline*`, `e2e/offline-*.spec.ts`, `.github/workflows/*`

---

## Stories

### S28-1: Spike -- kartlägg flaky-scenarier

**Domän:** webb
**Effort:** 2-3h
**Roll:** fullstack

Innan vi fixar något, måste vi veta exakt vad som är flaky. Läs retros, granska E2E-testerna, identifiera rotorsaker.

**Undersök:**
1. Läs `docs/retrospectives/` för alla offline-relaterade retros (grep "offline")
2. Kör `npm run test:e2e:offline` 5 gånger i rad -- vilka tester är flaky?
3. Läs `e2e/offline-pwa.spec.ts` och `e2e/offline-mutations.spec.ts` -- vilka setup-hacks finns?
4. Granska `src/lib/offline/sync-engine.ts` -- vilka kända race conditions?
5. Kolla Sentry (eller mock-data) för offline-fel i prod

**Output:**
- `docs/plans/s28-1-flaky-rapport.md` med:
  - Lista av flaky-tester med exakt felmeddelande
  - Rotorsaksanalys (5 Whys) per scenario
  - Prioriterad åtgärdslista för S28-3

**Acceptanskriterier:**
- [ ] Rapport skriven med minst 5 flaky-scenarier dokumenterade
- [ ] Varje scenario har rotorsak identifierad (inte bara symptom)
- [ ] S28-3 har konkret åtgärdslista

---

### S28-2: Offline E2E i standard CI-smoke

**Domän:** webb + infra
**Effort:** 3h
**Roll:** fullstack

Offline E2E kräver idag `OFFLINE_E2E=true` + prod build på port 3001. Det betyder att Serwist-uppgraderingar inte fångas automatiskt.

**Implementation:**
- Lägg till `offline-smoke` job i `.github/workflows/quality-gates.yml`
- Kör `npm run test:e2e:offline` i CI (med prod build)
- Cache Playwright browsers mellan jobb
- Markera ENABLE_OFFLINE_MODE=true i env
- Måste passera för merge till main (branch protection)

**Alternativ om det tar för mycket CI-tid:**
- Kör bara ett fåtal kritiska offline-scenarier som smoke
- Full offline-suite körs nattligen

**Acceptanskriterier:**
- [ ] Offline-smoke kör i CI vid varje PR
- [ ] Minst 5 kritiska offline-flöden testas (login, dashboard-cache, mutation queue, sync, reconnect)
- [ ] CI-tid ökar med max 5 minuter
- [ ] Branch protection uppdaterad att kräva offline-smoke

---

### S28-3: Fix flaky-rotorsaker

**Domän:** webb
**Effort:** 1-2 dagar
**Roll:** fullstack

Baserat på S28-1 spike -- fix rotorsaker, inte symptom. För varje flaky-scenario: skriv tester som reproducerar, fix rotorsak, verifiera att testen passerar 5 gånger i rad.

**Kända kandidater (verifieras i S28-1):**
- useSession vs navigator.onLine race (2s skew) -- guard finns men flaky?
- Mutation queue "stuck syncing" -- stale recovery körs, men fortfarande flaky?
- Reconnect-race mellan SWR-revalidation och mutation sync
- Service Worker cache-invalidation vid deploy
- IndexedDB quota-recovery i Chrome vs Safari
- Circuit breaker false positives

**Regel:** Fixa INTE ett flaky-test genom `test.retry(3)`. Hitta rotorsaken. Om det verkligen är en timing-issue, dokumentera varför.

**Acceptanskriterier:**
- [ ] Alla flaky-scenarier från S28-1 åtgärdade
- [ ] E2E offline-suite kör grönt 5 gånger i rad
- [ ] Ingen ny `test.retry()` tillagd
- [ ] Nya gotchas dokumenterade i `.claude/rules/offline-learnings.md`

---

### S28-4: Kund-offline (fas 4) -- OM TID FINNS

**Domän:** webb
**Effort:** 1-2 dagar
**Roll:** fullstack

Idag har kunder ingen offline-upplevelse. 8 kundmutationer varnar bara att de är offline, de köas inte. Om S28-1 till S28-3 är klara tidigare -- utöka offline-stöd till kundsidan.

**Scope (minimum):**
- Kundens bokningslista cachas
- Kundens hästar cachas
- Nya bokningar köas offline
- Avbokning köas offline

**Acceptanskriterier:**
- [ ] Kundens bokningslista fungerar offline
- [ ] Ny bokning kan skapas offline och synkas online
- [ ] E2E-test för kundens offline-flöde
- [ ] `npm run check:all` grön

**Om tid INTE finns:** Flytta till backlog. Sprinten är värd det även utan detta.

---

### S28-5: iOS offline-verifiering + förbättringar

**Domän:** ios
**Effort:** 0.5-1 dag
**Roll:** fullstack

iOS har NetworkMonitor (NWPathMonitor) + offline-banner, men beror på webbens Service Worker för cache. Verifiera att hybrid-upplevelsen fungerar offline och identifiera förbättringar.

**Undersök:**
1. Starta iOS-app, stäng av nätverk (Airplane mode)
2. Verifiera: offline-banner triggas, cached data visas, mutation queue fungerar
3. Återaktivera nätverk -- verifiera sync
4. Widget: visas senaste cachade booking även offline?
5. Vad händer vid kall app-start offline?

**Förbättringar att överväga:**
- Native cache för widget-data (SharedDataManager)
- Native retry vid app-resume
- Bättre felmeddelanden vid offline JWT-expiry

**Output:**
- `docs/done/s28-5-done.md` med observationer + implementerade förbättringar
- Eventuella nya iOS-tester (XCTest för ViewModels som hanterar offline)

**Acceptanskriterier:**
- [ ] Offline-upplevelse verifierad manuellt i simulator
- [ ] Minst 1 förbättring implementerad eller dokumenterat varför inte
- [ ] iOS-tester passerar

---

### S28-6: Uppdatera offline-pwa.md dokumentation

**Domän:** docs
**Effort:** 1h
**Roll:** fullstack

Efter S28-1 till S28-5: uppdatera `docs/architecture/offline-pwa.md` med:
- Nya flaky-learnings (från S28-1/S28-3)
- Kund-offline (om S28-4 kördes)
- iOS-observationer (från S28-5)
- CI-integration (från S28-2)

**Acceptanskriterier:**
- [ ] offline-pwa.md uppdaterad
- [ ] `npm run docs:validate` grön
- [ ] Nya gotchas i `.claude/rules/offline-learnings.md`

---

## Exekveringsplan

```
Session 1 (Opus, huvudrepo):
  S28-1 (spike, 2-3h) -> S28-2 (CI, 3h) -> S28-3 (fixes, 1-2d) -> S28-4 (kund-offline, OM TID FINNS)

Session 2 (Sonnet, worktree):
  S28-5 (iOS, 0.5-1d) -> S28-6 (docs, 1h)
```

**Total effort:** ~3-5 dagar session 1, ~1-1.5 dag session 2. Elapsed: ~3-5 dagar parallellt.

## Definition of Done (sprintnivå)

- [ ] Alla flaky-scenarier från S28-1 åtgärdade (rotorsaker, inte symptom)
- [ ] Offline-smoke körs i standard CI på varje PR
- [ ] E2E offline-suite kör grönt 5 gånger i rad lokalt
- [ ] iOS offline-upplevelse verifierad
- [ ] `docs/architecture/offline-pwa.md` uppdaterad
- [ ] `npm run check:all` grön
- [ ] Serwist-uppgraderingar kräver INTE längre manuell verifiering (CI fångar regressioner)
