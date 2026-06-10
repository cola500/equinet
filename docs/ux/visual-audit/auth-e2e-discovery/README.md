---
title: Auth E2E Discovery — test-skuld vs regression
description: Discovery 2026-06-10 av 8 failande auth-E2E-tester på PR #394 (staging→main). Slutsats: test-skuld (inaktuella tester efter demo-access/kundhem-routing), inte produktregression.
category: testing
status: active
last_updated: 2026-06-10
sections:
  - Sammanfattning
  - Rotorsak
  - Bevis
  - Fix
---

# Auth E2E Discovery — test-skuld vs regression

## Sammanfattning

PR #394 (staging→main, Workstream E) körde E2E för första gången mot stagings 179 commits
(E2E skippas på feature→staging-PR:er). 8 auth-tester i `e2e/auth.spec.ts` failade. Discovery
2026-06-10 fastställde: **test-skuld**, inte produktregression. Appens auth fungerar.

## Rotorsak

Demo-access-/kundhem-arbetet ändrade UI/routing som testerna inte uppdaterats för:

| Test | Förväntade (gammalt) | Faktiskt (nytt) |
|------|----------------------|-----------------|
| login as customer | redirect `/providers` | kund → `/dashboard` → **`/hem`** (`src/app/dashboard/page.tsx:21`) |
| logout | når `/providers` först | når `/hem` |
| register customer/provider | landing-länk "Kom igång/Börja" | landing-CTA heter **"Registrera dig gratis"** (`src/app/page.tsx:197`) |

## Bevis

- **Manuell login mot staging (= PR-koden):** `lisa.andersson@gmail.com` → landade på **`/hem`**
  (login fungerar). Se `auth-e2e-discovery-customer-login-hem.png`.
- **/hem-headern** har user-dropdown med menuitem **"Logga ut"** → logout-testets selektorer fungerar.
- **Statisk kod:** dashboard-routing → `/hem`; landing-CTA → "Registrera dig gratis".
- `test@example.com` seedas som customer i `seed-e2e.setup.ts` → login-testanvändaren finns.

## Fix

Test-only (`e2e/auth.spec.ts`, ingen produktkod):
- login/logout: förväntad redirect `/providers` → `/hem`.
- register: entry via `page.goto('/register')` (robust mot landing-copy).

Validering: lokal 3x-körning blockerades av lokalt Supabase-infra-problem (GoTrue 500 vid
user-creation, lokal schema up-to-date) — orelaterat fixen. Auktoritativ validering = CI:s
E2E-körning på PR:en (ren DB).
