---
title: "S15-4 Done: Smoke-test produktion"
description: "Smoke-test av alla sidor i produktion, RLS-bugg hittad och fixad"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Smoke-test resultat
  - Bugg hittad och fixad
  - Definition of Done
  - Reviews
  - Lardomar
---

# S15-4 Done: Smoke-test produktion

## Acceptanskriterier

- [x] Login med befintligt konto (Supabase Auth)
- [x] Dashboard laddar med data
- [x] Bokningar laddar med kunddata (efter RLS-fix)
- [x] Kunder laddar
- [x] Tjänster laddar (17 tjänster)
- [x] Kalender laddar
- [x] Recensioner laddar (tom, forvantat)
- [x] RLS: provider ser bara sin data

## Smoke-test resultat

| Sida | Status | Notering |
|------|--------|----------|
| Login | OK | Supabase Auth, custom claims i JWT |
| Dashboard | OK | 17 tjänster, grafer |
| Kalender | OK | Veckovy med tider |
| Bokningar | OK (efter fix) | 21 bokningar med kundinfo |
| Tjänster | OK | 17 tjänster |
| Kunder | OK | Kundlista med bokningsdata |
| Recensioner | OK | Tom lista (forvantat) |
| Health | OK | `database: connected` |

## Bugg hittad och fixad

**Problem:** Bokningssidan kraschade med `Cannot read properties of null (reading 'firstName')`.

**Rotorsak:** `User`-tabellen hade RLS aktiverat men saknade SELECT-policy for `authenticated`-rollen.
Supabase-klientens LEFT JOIN mot User returnerade null for alla kund-falt.

**Fix:** Migration `20260404150000_user_read_policies`:
- `user_provider_read`: Providers kan lasa User-data for kunder de har bokningar med
- `user_self_read`: Anvandare kan lasa sin egen data

**Applicerad direkt pa prod via SQL** (ingen redeploy behovdes -- RLS ar database-niva).

## Definition of Done

- [x] Alla sidor testade i produktion
- [x] RLS-bugg fixad och verifierad
- [x] Migration skapad och applicerad

## Reviews

- Kordes: code-reviewer (enda relevanta -- RLS-policy, ingen app-kod)

## Lardomar

1. **RLS blockerar LEFT JOINs tyst**: Supabase returnerar null for relationer dar
   RLS nekar access, istallet for att ge fel. Resulterar i client-side TypeError.

2. **Smoke-test avsloja RLS-lucka**: Unit-tester (som kor via Prisma/service_role)
   ser inte RLS-problem. Bara reella Supabase-klient-anrop avslöjar det.

3. **Alla joinade tabeller behover policies**: Nar en query joinar flera tabeller
   behover VARJE tabell en SELECT-policy for `authenticated`. Annars returnerar
   joinen null.
