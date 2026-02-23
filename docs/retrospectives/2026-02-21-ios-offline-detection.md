# Retrospektiv: iOS offline-detektion -- probe istallet for blind restore

**Datum:** 2026-02-21
**Scope:** Fix for falska "online"-events pa iOS Safari + SW API cache connectivity notifier

---

## Resultat

- 5 andrade filer, 0 nya filer, 0 nya migrationer
- 8 nya tester (alla TDD, alla grona)
- 2247 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session (kort, fokuserad)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Hooks | `useOnlineStatus.ts` | `handleOnline` probar med HEAD istallet for att blint kalla `reportConnectivityRestored()` |
| SW | `sw.ts` | API cache-regel med `connectivityNotifier` for omedelbar offline-detektion vid misslyckade API-anrop |
| SW Matchers | `sw-matchers.ts` | Ny `apiCacheMatcher` for same-origin `/api/*` GET-requests |
| Tester | `useOnlineStatus.test.ts` | 1 uppdaterat + 3 nya tester for probe-beteendet |
| Tester | `sw.test.ts` | 5 nya tester for `apiCacheMatcher` |

## Vad gick bra

### 1. Tva fixar som kompletterar varandra
- **handleOnline probe**: Forhindrar att iOS falska online-events aterstaller status
- **apiCacheMatcher + connectivityNotifier**: SW fanger misslyckade API-requests och triggar omedelbar offline-detektion
- Tillsammans ger de robust offline-detektion pa alla plattformar

### 2. Minimal andring, maximal effekt
- Bara 5 filer, +157/-7 rader. Liten blast radius. Ingen ny arkitektur -- byggde pa befintliga patterns (`connectivityNotifier`, `probeConnectivity()`).

### 3. Bra testtackning for edge cases
- Tre separata probe-scenarion: lyckad probe (restores), misslyckad probe (stays offline), ingen probe nar redan online (undviker onodiga natverksanrop).

## Vad kan forbattras

### 1. iOS-testning bor ske tidigare
iOS Safari beter sig annorlunda an Chrome/Firefox for online/offline-events. Vi upptackte detta sent i offline-implementationen.

**Prioritet:** LAG -- offline-mode ar bakom feature flag, och denna fix ar nu pa plats.

## Patterns att spara

### Probe-before-restore for online-events
Lita ALDRIG blint pa browserns `online`-event for att aterstalla konnektivitet nar `fetchFailed` ar true. Skicka en HEAD-request forst och aterstall bara om proben lyckas. iOS Safari avfyrar falska online-events nar enheten fortfarande ar offline.

### SW connectivityNotifier pa API-cache
Lagg till `connectivityNotifier` plugin pa NetworkFirst-strategier for API-requests. Ger omedelbar offline-detektion nar API-anrop misslyckas, utan att vanta pa nasta polling-cykel.

## Larandeeffekt

**Nyckelinsikt:** iOS Safari avfyrar `online`-events aven nar natverk inte finns tillgangligt. Behandla `online`-eventet som en *hint* att proba, inte som bevis pa konnektivitet. Samma "trust but verify"-princip som for alla browser-events som signalerar natverksstatus.
