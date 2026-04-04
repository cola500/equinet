---
title: "S13-1: Byt huvudlogin till Supabase Auth"
description: "Ersätt NextAuth signIn med Supabase signInWithPassword på /login"
category: plan
status: active
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Approach
  - Filer som ändras
  - Filer som tas bort
  - Risker
---

# S13-1: Byt huvudlogin till Supabase Auth

## Bakgrund

`/login` använder idag en tvåstegsprocess:
1. `POST /api/auth/web-login` -- validerar credentials via AuthService
2. `signIn("credentials")` -- skapar NextAuth-session

`/supabase-login` (S12-1 PoC) använder `supabase.auth.signInWithPassword()` direkt.

Uppgiften: `/login` ska använda Supabase-auth istället för NextAuth.
`/supabase-login` tas bort (ersätts av nya `/login`).

## Approach

### Fas 1: RED -- Tester först

Uppdatera/skriv tester för `/login` som verifierar:
- Supabase `signInWithPassword()` anropas (inte NextAuth `signIn`)
- EMAIL_NOT_CONFIRMED-hantering fungerar
- callbackUrl-stöd finns kvar
- demo-mode beteende bevaras
- useSearchParams toasts (registered/verified) bevaras
- Laddningsstate (disabled button)
- Generiskt fel vid nätverksfel

### Fas 2: GREEN -- Byt login-logik

1. **`src/app/(auth)/login/page.tsx`**: Ersätt handleSubmit:
   - Ta bort `fetch("/api/auth/web-login")` + `signIn("credentials")`
   - Lägg till `createSupabaseBrowserClient()` + `signInWithPassword()`
   - Behåll: callbackUrl, demo-mode, searchParams-toasts, retry-logik
   - Behåll: `requestMobileTokenForNative()` (iOS-widget, behövs tills S13-4)
   - Ta bort: `import { signIn } from "next-auth/react"`

2. **Felhantering**: Mappa Supabase-fel till UI:
   - `"not confirmed"` -> EMAIL_NOT_VERIFIED (visa resend-länk)
   - Övriga auth-fel -> "Ogiltig email eller lösenord"
   - Network/throw -> "Något gick fel"

### Fas 3: Ta bort `/supabase-login`

1. Ta bort `src/app/(auth)/supabase-login/` (page.tsx, SupabaseLoginForm.tsx, page.test.tsx)
2. Feature-flaggan `supabase_auth_poc` behöver INTE tas bort nu (andra filer refererar den)

### Fas 4: Ta bort `/api/auth/web-login`

1. Ta bort `src/app/api/auth/web-login/route.ts` + `route.test.ts`
2. Denna route används BARA av gamla `/login` -- ingen annan konsument

### Fas 5: VERIFY

- `npx vitest run src/app/(auth)/login`
- `npm run typecheck`
- `npm run check:all`

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/app/(auth)/login/page.tsx` | Byt från NextAuth till Supabase auth |
| `src/app/(auth)/login/page.test.tsx` | Ny testfil (finns inte idag!) |

## Filer som tas bort

| Fil | Anledning |
|-----|-----------|
| `src/app/(auth)/supabase-login/page.tsx` | Ersätts av uppdaterade `/login` |
| `src/app/(auth)/supabase-login/SupabaseLoginForm.tsx` | Ersätts av uppdaterade `/login` |
| `src/app/(auth)/supabase-login/page.test.tsx` | Testerna flyttas/anpassas till `/login` |
| `src/app/api/auth/web-login/route.ts` | Ej längre behövd (NextAuth pre-check) |
| `src/app/api/auth/web-login/route.test.ts` | Tillhörande tester |

## Filer som INTE ändras (viktigt)

- `middleware.ts` -- behåller dual-auth (NextAuth + Supabase) tills S13-2
- `src/lib/auth.ts` -- tas bort i S13-2
- `src/app/api/auth/[...nextauth]/route.ts` -- tas bort i S13-2
- `src/lib/native-bridge.ts` -- `requestMobileTokenForNative()` behövs tills S13-4

## Risker

| Risk | Mitigation |
|------|-----------|
| Retry-logik i gamla login komplexare | Behåll useRetry-pattern, anpassa till Supabase-anrop |
| callbackUrl kan tappas | Testa explicit i unit test |
| requestMobileTokenForNative behövs fortfarande | Behåll anropet, iOS-appen använder det tills S13-4 |
| Supabase rate limiting skiljer sig från custom | Supabase har inbyggd rate limiting, web-login-routens custom rate limit försvinner |
