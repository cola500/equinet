---
title: "S40-1: Feature flag smart_replies + unit-tests"
description: "Lägg till feature flag för smart-replies och TDD-tester för expandTemplate"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Syfte
  - Filer som ändras
  - Steg
  - Risker
---

# S40-1: Feature flag `smart_replies` + unit-tests

## Aktualitet verifierad

**Kommandon körda:** `grep "smart_replies" src/lib/feature-flag-definitions.ts`, `grep "useFeatureFlag" src/app/provider/messages/[bookingId]/page.tsx`
**Resultat:** Flaggan finns inte. Ingen feature flag-gating i page.tsx. Stämmer med sprint-spec.
**Beslut:** Fortsätt

## Syfte

Lägg till `smart_replies` feature flag (defaultEnabled: false) och gate SmartReplyChips bakom den. Skriv unit-tester för `expandTemplate`-funktionen (TDD).

## Filer som ändras

- `src/lib/feature-flag-definitions.ts` -- ny flagga
- `src/app/provider/messages/[bookingId]/page.tsx` -- feature flag gate
- `src/components/provider/messages/SmartReplyChips.test.tsx` -- ny testfil (TDD)
- `src/lib/feature-flags.test.ts` -- eventuell uppdatering om defaults påverkas
- `src/app/api/feature-flags/route.test.ts` -- eventuell uppdatering

## Steg

1. **RED**: Skriv `SmartReplyChips.test.tsx` med 5+ tester för `expandTemplate` (alla ska faila)
2. **GREEN**: `expandTemplate` finns redan i SmartReplyChips.tsx -- tester ska bli gröna direkt
3. **Feature flag**: Lägg till `smart_replies` i `feature-flag-definitions.ts`
4. **Gate**: Lägg till `useFeatureFlag("smart_replies")` i `ThreadView`, rendera chips villkorligt
5. **Verifiering**: `check:all` grön, feature-flag-tester fortfarande gröna

## Risker

- `useFeatureFlag` är en client-hook -- page.tsx är redan "use client", OK
- feature-flag-tester kan behöva uppdateras om de testar total antal flaggor
