---
title: "S22-5 Done: Smoke-test registreringsflödet"
description: "E2E smoke-test av registrering, inloggning och alla sidor"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Testresultat
  - Definition of Done
  - Reviews
  - Avvikelser
---

# S22-5 Done: Smoke-test registreringsflödet

## Acceptanskriterier

- [x] Hela flodet testat (E2E smoke: 25 passed, 3 skipped, 0 fail)
- [x] Alla blockerande buggar fixade (inga hittade)
- [x] Resultat dokumenterat i done-filen

## Testresultat

E2E smoke-svit (1.0 min, chromium + mobile + cleanup):

| Test | Resultat |
|------|----------|
| Registrera ny kund | PASS |
| Registrera ny leverantör | PASS |
| Logga in som befintlig kund | PASS |
| Felmeddelande vid ogiltig inloggning | PASS |
| Logga ut | PASS |
| Losenordskrav-validering | PASS |
| Realtids losenordskrav-validering | PASS |
| Dashboard stat cards lankar | PASS |
| Provider profil: recurring bookings setting | PASS |
| Admin system-sida | PASS |
| Alla provider-sidor laddar | PASS |
| Alla kund-sidor laddar | PASS |
| Alla admin-sidor laddar | PASS |
| Samma tester pa mobil-viewport | PASS |
| Cleanup | PASS |

**Inga blockerande buggar hittades.** Registreringsflödet (registrering -> inloggning -> dashboard med onboarding-vy) fungerar korrekt.

## Definition of Done

- [x] E2E smoke 25/25 grona
- [x] Inga nya kodandringar behovdes

## Reviews

- Kordes: inga subagenter (testning, inte implementation)

## Avvikelser

- E2E-testerna verifierar registrering och inloggning men inte e-postverifiering (Supabase lokal dev skippar e-postverifiering som default).
- Onboarding welcome-vyn bekraftas indirekt via "all provider pages should load" -- men specifikt onboarding-flode ar inte E2E-testat annu.
