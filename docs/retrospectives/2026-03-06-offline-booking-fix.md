---
title: "Retrospektiv: Fix offline bokning stannar"
description: "Debug och fix av att manuell bokning inte fungerade offline"
category: retrospectives
status: completed
last_updated: 2026-03-06
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Fix offline bokning stannar

**Datum:** 2026-03-06
**Scope:** Debug och fix av att manuell bokning hangde vid offline

---

## Resultat

- 3 andrade filer, 0 nya filer, 0 nya migrationer
- +130/-4 rader
- 5 nya tester (alla TDD, alla grona)
- 3053 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~30 min

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Hook | `src/hooks/useOfflineGuard.ts` | Natverksfel-fallback i online-path: fangar TypeError/AbortError, anropar `reportConnectivityLoss()`, faller tillbaka till offline-koning |
| Hook (test) | `src/hooks/useOfflineGuard.test.ts` | 5 nya tester: fallback vid TypeError, AbortError, re-throw for non-network errors, re-throw utan offlineOptions, re-throw med flag off |
| UI | `src/components/calendar/ManualBookingDialog.tsx` | 10s AbortController-timeout pa fetch till `/api/bookings/manual` |

## Vad gick bra

### 1. Korrekt rotorsaksanalys fore implementation
Analysen identifierade tre hypoteser och rankade Hypotes 1 (navigator.onLine ljuger) som mest trolig. Koden bekraftade detta direkt -- `guardMutation` rad 41 kor `action()` utan nagon felhantering.

### 2. TDD fangade exakt ratt beteende
Att skriva 5 tester fore implementation klargjorde alla edge cases: fallback (TypeError, AbortError), re-throw (non-network, utan options, flag off). Implementationen blev 11 rader i hooken.

### 3. Minimal fix med maximal effekt
Fixen skyddar ALLA mutationer som anvander `guardMutation` med `offlineOptions` -- inte bara ManualBookingDialog. Framtida offline-mutationer far automatiskt samma fallback.

## Vad kan forbattras

### 1. Timeout borde vara generaliserat
10s timeout lades till i ManualBookingDialog specifikt. Andra mutationer (avbokning, schemaandringar) har ingen timeout. Overslag att flytta timeout-logiken till `guardMutation` sjalv.

**Prioritet:** LAG -- andra mutationer ar snabbare (PUT/DELETE) och mindre kansliga for hangande fetch.

## 5 Whys (Root-Cause Analysis)

### Problem: Manuell bokning hangde vid offline
1. Varfor? `handleSubmit` anropade `guardMutation` som kor `fetch()` direkt nar `isOnline === true`.
2. Varfor returnerade `isOnline` true? `navigator.onLine` rapporterar `true` aven nar natverket ar nere (iOS Safari, DevTools).
3. Varfor detekterade inte systemet felet? `reportConnectivityLoss()` anropas bara av SW (inte i dev), SWR fetcher (bara GET), och error.tsx (bara sidladdning). POST-mutationer hade ingen detektionsvag.
4. Varfor hade POST-mutationer ingen detektionsvag? `guardMutation` designades med antagandet att `isOnline` alltid ar korrekt -- online-path hade ingen felhantering.
5. Varfor antogs det? Ursprunglig implementation fokuserade pa explicit offline-koning (isOnline=false). Edge caset "online men natverket ar nere" testades aldrig.

**Atgard:** `guardMutation` fangar nu natverksfel i online-path och faller tillbaka till offline-koning. Dessutom 10s timeout i ManualBookingDialog for att hantera hangande fetch.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** `navigator.onLine` ar otillforlitlig -- designa alltid med "online men natverket ar nere" som ett explicit fall. Varje mutation-path som kor `fetch()` bor ha bade timeout och felhantering som kan trigga offline-fallback.
