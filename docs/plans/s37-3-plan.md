---
title: "S37-3: Slå på messaging-flag + rollout-observation"
description: "Sätt messaging defaultEnabled: true och dokumentera rollout-plan"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som berörs
---

# S37-3: Slå på messaging-flag

## Aktualitet verifierad

**Kommandon körda:** Verifierat att S37-1 och S37-2 är mergade (PR #209, #210). `npm run check:all` 4165 tester gröna.
**Resultat:** Förutsättningarna uppfyllda. Rollback-möjlighet finns via admin toggle (ingen migration).
**Beslut:** Fortsätt

## Approach

1. Sätt `defaultEnabled: true` i `feature-flag-definitions.ts`
2. Uppdatera feature-flag-tester som förväntar sig `false`
3. Skapa `docs/operations/messaging-rollout.md` med rollback + observation
4. Uppdatera README.md och feature-docs.md (docs-matris)

## Filer som berörs

- `src/lib/feature-flag-definitions.ts` — ändra defaultEnabled
- `src/lib/feature-flags.test.ts` — uppdatera om det finns test med messaging=false
- `src/app/api/feature-flags/route.test.ts` — uppdatera om relevant
- `docs/operations/messaging-rollout.md` — ny fil
- `README.md` — ny feature-rad
- `docs/guides/feature-docs.md` — ny rad
