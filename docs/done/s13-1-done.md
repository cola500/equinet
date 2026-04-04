---
title: "S13-1 Done: Byt huvudlogin till Supabase Auth"
description: "Login-sidan migrerad från NextAuth till Supabase signInWithPassword"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lärdomar
---

# S13-1 Done: Byt huvudlogin till Supabase Auth

## Acceptanskriterier

- [x] `/login` använder Supabase `signInWithPassword()` istället för NextAuth `signIn("credentials")`
- [x] `/supabase-login` (PoC-sida) borttagen
- [x] `/api/auth/web-login` (NextAuth pre-check route) borttagen
- [x] callbackUrl-stöd bevarats (med open redirect-skydd)
- [x] demo-mode beteende bevarats
- [x] searchParams toasts bevarats (registered/verified)
- [x] `requestMobileTokenForNative()` bevarats (behövs tills S13-4)
- [x] Tester uppdaterade

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (callbackUrl valideras, inga öppna redirects)
- [x] Unit tests skrivna (13 st), alla gröna
- [x] 3982 totala tester, alla gröna
- [x] check:all: typecheck + test + lint + swedish -- 4/4 gröna

## Reviews

Kördes: code-reviewer (enda relevanta -- ingen ny API route, ingen UI-layout-ändring)

## Avvikelser

- Retry-logiken (`useRetry`) behölls men anpassades till Supabase-anrop istället för NextAuth.
  Den extraherade `loginWithSupabase()`-funktionen återanvänds av både `handleSubmit` och retry-callbacken.
- Rate limiting: Web-login-routens custom rate limiting (5 per 15 min per email) försvinner.
  Supabase har inbyggd rate limiting. Ingen åtgärd behövs.

## Lärdomar

- **Enkel migrering**: Bytet var rakt fram -- SupabaseLoginForm (PoC) hade redan bevisat mönstret.
  Huvudarbetet var att bevara `/login`-sidans extra features (callbackUrl, retry, demo-mode, toasts)
  som PoC-sidan inte hade.
- **Nettoresultat**: -385 rader kod (677 borttagna, 292 tillagda inkl tester).
  Tvåstegsprocessen (web-login pre-check + NextAuth signIn) ersatt av ett enda Supabase-anrop.
