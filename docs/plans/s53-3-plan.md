---
title: "S53-3: Se demo-knapp på landningssidan"
description: "Plan för att lägga till en frictionless demo-login-knapp på landningssidan"
category: plan
status: in_progress
last_updated: 2026-04-23
sections:
  - Approach
  - Filer
  - Steg
  - Risker
---

# S53-3: Se demo-knapp på landningssidan

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story)
**Resultat:** S53-3 finns i sprint-53.md som valfri story, ej implementerad.
**Beslut:** Fortsätt

## Approach

Browser-side Supabase auth — ingen ny API-route. Knappen anropar
`supabase.auth.signInWithPassword()` med Erik Järnfots demo-credentials,
precis som den vanliga login-sidan gör. På success: redirect till
`/provider/dashboard`.

Credentials hardkodas i klientkoden — acceptabelt eftersom de är avsedda
att vara offentliga demo-credentials.

Gate: knappen renderas enbart när `isDemoMode()` returnerar `true`
(d.v.s. `NEXT_PUBLIC_DEMO_MODE=true` är satt).

## Filer

- **Ny**: `src/components/landing/DemoLoginButton.tsx` — Client Component
- **Ändrad**: `src/app/page.tsx` — importerar `isDemoMode` + renderar knappen i Hero

## Steg

1. Skriv test (RED): `src/components/landing/DemoLoginButton.test.tsx`
   - Renderar knapp
   - Vid klick: anropar `signInWithPassword` med demo-credentials
   - Visar laddningsindikator under inloggning
   - Visar felmeddelande vid auth-error
2. Implementera `DemoLoginButton.tsx` (GREEN)
3. Uppdatera `src/app/page.tsx` — lägg till knapp i Hero-sektionen
4. `npm run check:all`
5. Code review

## Risker

- Demo-seed måste ha körts: om Erik Järnfot inte finns ger Supabase 400.
  Hanteras med felmeddelande ("Demo-kontot hittades inte — kör seed-scriptet").
- `page.tsx` är Server Component: `isDemoMode()` fungerar där (läser env-var).
